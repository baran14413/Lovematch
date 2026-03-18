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

// Admin Delete Room
app.delete('/admin/rooms/:id', async (req, res) => {
    try {
        await db.collection('rooms').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).send(e.message); }
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
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                included_segments: ["All"], // Tüm kullanıcılara
                headings: { "en": "Sistem Duyurusu", "tr": "Sistem Duyurusu" },
                contents: { "en": message, "tr": message },
                android_channel_id: "system_notifications"
            })
        });
        const d = await response.json();
        res.json({ success: true, response: d, recipientCount: d.recipients || 0 });
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
