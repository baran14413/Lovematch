import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

// Initialize Firebase Admin (Only once!)
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: "lovmatch-3a64b"
    });
}
const db = admin.firestore();

// 1v1 Matching Pool (In-memory for speed, could be Firestore-backed for persistence)
let matchingPool = [];

// Bad words list (Default list, from Firestore eventually)
let bad_words_list = ['sexs', 'yarak', 'am', 'meme', 'sik', 'göt', 'piç', 'yavşak', 'oruspu', 'kahpe'];

// Load bad words from Firestore
const loadBadWords = async () => {
    try {
        const docSnap = await db.collection('settings').doc('filters').get();
        if (docSnap.exists) {
            bad_words_list = docSnap.data().badWords || bad_words_list;
        } else {
            // Create default
            await db.collection('settings').doc('filters').set({ badWords: bad_words_list });
        }
    } catch (e) {
        console.warn('[Settings] Filters load error:', e.message);
    }
};
loadBadWords();

// Text filter helper
const filterText = (text) => {
    if (!text) return '';
    let filtered = text;
    bad_words_list.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
};

// Push Notification Helper
const sendPush = async (userIds, title, body, data = {}) => {
    const ONESIGNAL_APP_ID = "dac0906c-e76a-46d4-bf59-4702ddc2cf70";
    const ONESIGNAL_REST_API_KEY = "os_v2_app_3laja3hhnjdnjp2zi4bn3qwpocfn5sibyqje2v4lpp5m7ngh3owopcmcmqmpjcc4uc5vfatd5n5ypp2kvbepgnq75z3sihqivdsslfy";

    const payload = {
        app_id: ONESIGNAL_APP_ID,
        headings: { "en": title, "tr": title },
        contents: { "en": body, "tr": body },
        data: data,
        android_channel_id: "system_notifications"
    };

    if (userIds === "All") {
        payload.included_segments = ["All"];
    } else {
        payload.include_external_user_ids = Array.isArray(userIds) ? userIds : [userIds];
    }

    try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify(payload)
        });
        const resData = await response.json();
        console.log('[OneSignal] Push Response:', resData);
        return resData;
    } catch (e) {
        console.error('[OneSignal] Push Error:', e);
        return null;
    }
};


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '1y',
    setHeaders: (res, path) => {
        if (path.endsWith('.html') || path.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

app.use(express.json());

// Admin Login Route
app.post('/admin/login', (req, res) => {
    const { key } = req.body;
    const ADMIN_KEY = "Gunahbenim09";
    if (key === ADMIN_KEY) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Geçersiz anahtar' });
    }
});

// Real Stats for Admin Dashboard
app.get('/admin/stats', async (req, res) => {
    try {
        const usersSnap = await db.collection('users').count().get();
        const roomsSnap = await db.collection('rooms').get();
        const postsSnap = await db.collection('posts').count().get();

        let roomsList = [];
        let totalViewers = 0;
        let usersInSeats = 0;
        let activeRooms = 0;

        roomsSnap.forEach(doc => {
            const data = doc.data();
            totalViewers += (data.viewerCount || 0);
            usersInSeats += (data.seatedCount || 0);
            if (data.viewerCount > 0 || data.seatedCount > 0) activeRooms++;
        });

        res.json({
            success: true,
            totalSockets: usersSnap.data().count, // Roughly estimate online as total users or use another metric
            totalRooms: roomsSnap.size,
            activeRooms: activeRooms,
            sleepingRooms: roomsSnap.size - activeRooms,
            usersInSeats: usersInSeats,
            totalViewers: totalViewers,
            totalPosts: postsSnap.data().count,
            uptime: process.uptime(),
            memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            rssMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
            nodeVersion: process.version,
            pid: process.pid,
            platform: process.platform,
            maxCapacity: 1000,
            maxVoice: 100
        });
    } catch (e) {
        console.error('[Admin API] Stats failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin Rooms List
app.get('/admin/rooms', async (req, res) => {
    try {
        const snap = await db.collection('rooms').orderBy('viewerCount', 'desc').limit(50).get();
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(list);
    } catch (e) { res.status(500).send(e.message); }
});

// Admin Users List & Search
app.get('/admin/users', async (req, res) => {
    const { search } = req.query;
    try {
        let q = db.collection('users').limit(50);
        if (search) {
            // Simple prefix search for username
            q = q.where('username', '>=', search).where('username', '<=', search + '\uf8ff');
        } else {
            q = q.orderBy('updated', 'desc');
        }
        const snap = await q.get();
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(list);
    } catch (e) {
        console.error('[Admin API] Users search failed:', e);
        res.status(500).send(e.message);
    }
});

// Admin Delete Room & Notify Owner
app.delete('/admin/rooms/:id', async (req, res) => {
    try {
        const roomDoc = await db.collection('rooms').doc(req.params.id).get();
        if (roomDoc.exists) {
            const roomData = roomDoc.data();
            const ownerUid = roomData.ownerUid;
            const roomName = roomData.name || 'İsimsiz';

            if (ownerUid) {
                const notifyMsg = `${roomName} isimli odanız silindi. Bunun yanlış olduğunu düşünüyorsanız bematchstudio@gmail.com adresinden bizimle iletişime geçin.`;

                // 1. In-App Notification (In Firestore)
                await db.collection('notifications').add({
                    user: ownerUid,
                    title: 'Odanız Silindi ⚠️',
                    body: notifyMsg,
                    type: 'error', // Red color in UI
                    read: false,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });

                // 2. Push Notification (FCM)
                await sendPush(ownerUid, 'Odanız Silindi ⚠️', notifyMsg, { type: 'room_deleted' });
            }
        }
        await db.collection('rooms').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).send(e.message); }
});

// Admin Filter Get & Update
app.get('/admin/filters', (req, res) => {
    res.json({ success: true, badWords: bad_words_list });
});

app.post('/admin/filters', async (req, res) => {
    const { badWords } = req.body;
    if (!Array.isArray(badWords)) return res.status(400).send('badWords must be an array');
    bad_words_list = badWords;
    await db.collection('settings').doc('filters').set({ badWords: badWords });
    res.json({ success: true });
});

// --- Matchmaking Periodic Check ---
setInterval(async () => {
    if (matchingPool.length >= 2) {
        const u1 = matchingPool.shift();
        const u2 = matchingPool.shift();
        const roomId = '1v1_' + Math.random().toString(36).slice(2, 9);

        console.log(`[1v1] Matched ${u1.name} and ${u2.name}`);

        // Notify both via Firestore (They are listening to their 'notifications' or specialized '1v1' events)
        // Here we can use the 'signaling' collection as a transport for these UI events too
        const matchEvent = {
            type: '1v1_matched',
            roomId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('signaling').add({ fromUid: 'system', toUid: u1.uid, signalType: '1v1_matched', roomId, partner: u2 });
        await db.collection('signaling').add({ fromUid: 'system', toUid: u2.uid, signalType: '1v1_matched', roomId, partner: u1 });
    }
}, 3000);

// Endpoint to join pool
app.post('/api/1v1/join', (req, res) => {
    const { uid, name, avatar } = req.body;
    if (!uid) return res.status(400).send('uid required');
    if (!matchingPool.find(u => u.uid === uid)) {
        matchingPool.push({ uid, name, avatar });
    }
    res.json({ success: true, queueSize: matchingPool.length });
});

app.post('/api/1v1/leave', (req, res) => {
    const { uid } = req.body;
    matchingPool = matchingPool.filter(u => u.uid !== uid);
    res.json({ success: true });
});

// Admin Kick User (From socket/online status)
app.delete('/admin/users/:id', async (req, res) => {
    try {
        // Here we could update an 'isBanned' or 'lastKicked' flag
        // For now, let's just return success as dummy kick
        res.json({ success: true });
    } catch (e) { res.status(500).send(e.message); }
});

// Admin Broadcast (FCM Activation via OneSignal)
app.post('/admin/broadcast', async (req, res) => {
    const { message } = req.body;
    const ONESIGNAL_APP_ID = "dac0906c-e76a-46d4-bf59-4702ddc2cf70";
    const ONESIGNAL_REST_API_KEY = "os_v2_app_3laja3hhnjdnjp2zi4bn3qwpocfn5sibyqje2v4lpp5m7ngh3owopcmcmqmpjcc4uc5vfatd5n5ypp2kvbepgnq75z3sihqivdsslfy";

    if (!message) return res.status(400).json({ success: false, message: 'Mesaj boş olamaz' });

    try {
        const d = await sendPush("All", "Sistem Duyurusu", message, { type: 'broadcast' });
        res.json({ success: true, response: d, recipientCount: d?.recipients || 0 });
    } catch (e) {
        console.error('[Broadcast] Failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Fallback all routes to index.html for Single Page Application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[App Hosting] Lovematch Static UI Sunucusu ${PORT} portunda başarıyla çalışıyor!`);
});
