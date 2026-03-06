import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * LOVEMATCH REBORN V9 - ULTIMATE STABILITY & ROOMS
 * OneSignal Config
 */
const ONESIGNAL_APP_ID = "dac0906c-e76a-46d4-bf59-4702ddc2cf70";
const ONESIGNAL_REST_API_KEY = "os_v2_app_3laja3hhnjdnjp2zi4bn3qwpocfn5sibyqje2v4lpp5m7ngh3owopcmcmqmpjcc4uc5vfatd5n5ypp2kvbepgnq75z3sihqivdsslfy";

async function sendOneSignalPush(targetUserId, title, body, data = {}) {
    if (!ONESIGNAL_REST_API_KEY || ONESIGNAL_REST_API_KEY.includes('BURAYA')) {
        console.warn('[OneSignal] ⚠️ REST API Key ayarlanmamış, bildirim gönderilemedi.');
        return;
    }

    try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_external_user_ids: [targetUserId],
                headings: { "en": title, "tr": title },
                contents: { "en": body, "tr": body },
                data: data
            })
        });
        const result = await response.json();
        console.log('[OneSignal] Push status:', result);
    } catch (e) {
        console.error('[OneSignal] Push failed:', e.message);
    }
}

const PORT = 4000;
const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());
app.use(helmet({
    contentSecurityPolicy: false, // Vite/HMR için bazen kapatılır, dev ortamda rahatlık sağlar
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // IP başına 15 dakikada 500 istek
    message: { error: 'Çok fazla istek gönderdiniz, lütfen bekleyin.' }
});
app.use('/rooms', limiter); // Sadece kritik rotalara limit koyalım

// ─── STATİK DOSYA SUNUMU ───
// React build çıktısını serve et (dist klasörü)
app.use(express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.html') || path.endsWith('sw.js')) {
            // HTML ve Service Worker asla cache'lenmemeli!
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else {
            // JS, CSS ve Asset'ler 1 yıl cache'lenebilir (Vite bundle isimlerine hash ekler)
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));
// Public klasörü
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d', // İkon vb. için 7 gün
}));

const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling']
});

// GÜVENLİK ADIMI 1: Socket Authentication (Kimlik Doğrulama)
// İstemci bağlanırken token göndermek zorunda kalacak, token yoksa soket bağlantısı red edilecek.
io.use((socket, next) => {
    // Normalde burada PocketBase token'ı (`socket.handshake.auth.token`) doğrulanır. 
    // Ön taraftan auth objesi olarak token geldiğinde bu kısım o token'ın varlığını kontrol eder.
    if (socket.handshake.auth && socket.handshake.auth.token) {
        // İleri güvenlikte: jwt.verify(token) yapılabilir
        return next();
    }
    // Geriye dönük uyumluluk veya misafirler için şimdilik geçici izin veriyoruz, tam kilitleme için Error dönülür.
    // return next(new Error('Authentication Error: Token missing'));
    return next();
});

const users = new Map();
const rooms = new Map();
const moderatorStatus = new Map(); // Global mod status tracking: { uid: { username, avatar, lastSeen, currentRoomId } }

// --- MODELS ---
// --- ODA KATILIMCI LİMİTİ (Sese değil, odaya giren toplam kişi sayısı) ---
// Takipçi < 20  → LV1 → Maks 25 kişi
// Takipçi 20-99 → LV2 → Maks 55 kişi
// Takipçi 100+  → LV3 → Sınırsız
const BOOST_MAX_VIEWERS = { 1: 25, 2: 55, 3: Infinity };
const BOOST_LEVEL_NAMES = { 1: 'Standart', 2: 'Gelişmiş', 3: 'Premium' };
const BOOST_THRESHOLDS = { 1: 0, 2: 20, 3: 100 };
// Ses koltuğu: LV1 max 8, LV2 max 12, LV3 max 16
const BOOST_MAX_SEATS_BY_LEVEL = { 1: 8, 2: 12, 3: 16 };
// Varsayılan ROOM_SEAT_COUNT artık dinamik - aşağıdaki constant kaldırıldı

function calcBoostLevel(followerCount) {
    if (followerCount >= 100) return 3;
    if (followerCount >= 20) return 2;
    return 1;
}

class Room {
    constructor(id, name, ownerUid, ownerName, ownerAvatar, seatCount = 8) {
        this.id = id;
        this.name = name;
        this.ownerUid = ownerUid;
        this.ownerName = ownerName;
        this.ownerAvatar = ownerAvatar;
        this.viewers = new Map();
        this.followers = new Map();
        this.boostLevel = 1;
        // seatCount: başlangıçta verilen koltuk sayısı, LV1'de max 8
        const validSeatCount = Math.min(Math.max(seatCount || 8, 1), BOOST_MAX_SEATS_BY_LEVEL[1]);
        this.maxSeatCount = validSeatCount; // sabit - sadece LV upgrade ile değişir
        this.seats = new Array(validSeatCount).fill(null);
        this.lockedSeats = new Array(validSeatCount).fill(false);
        this.admins = new Set([ownerUid]);
        this.mutedUsers = new Set();
        this.blockedUsers = new Set();
        this.messages = [];
        this.layout = 'grid'; // Sabit 4x4 grid
        this.activity = new Map(); // Lider rozeti için aktivite takibi
        // Oda takipçi sistemi: { uid, username, avatar }
        this.createdAt = Date.now();
        this.isSleeping = false;
        this.isDummy = false; // Sahte oda kontrolü
        this.announcement = ""; // Yeni: Duyuru panosu metni
        this.slowMode = false; // Yeni: Yavaş mod
        this.chatDisabled = false; // Yeni: Chat kapatma
    }

    // Takıpçi sayısına göre boost seviyesini güncelle
    // Koltuk sayısı da yeni seviyeye göre maksimuma çıkabilir (kullanıcı seçimine göre)
    updateBoostFromFollowers() {
        const newLevel = calcBoostLevel(this.followers.size);
        if (newLevel !== this.boostLevel) {
            this.boostLevel = newLevel;
            // Koltuk expand: maxSeatCount, yeni seviye limitine çıkarabilir
            // Ama mevcut koltuk sayısını yeniden seçmeyi admin'e bırakıyoruz
            console.log(`[BOOST-AUTO] ${this.name} → LV${newLevel} (${this.followers.size} takıpçi, maks koltuk: ${BOOST_MAX_SEATS_BY_LEVEL[newLevel]})`);
            return true;
        }
        return false;
    }

    addMessage(type, user, content) {
        const msg = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            user: user ? { socketId: user.id, username: user.username, avatar: user.avatar, uid: user.uid, color: user.color } : null,
            content,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        this.messages.push(msg);
        if (this.messages.length > 90) this.messages.shift();

        // Track activity
        if (user && user.uid) {
            this.activity.set(user.uid, (this.activity.get(user.uid) || 0) + 1);
        }

        return msg;
    }

    getLeader() {
        let leader = null;
        let maxAct = -1;
        this.activity.forEach((act, uid) => {
            if (act > maxAct) {
                maxAct = act;
                leader = uid;
            }
        });
        return leader;
    }

    get snapshot() {
        return {
            id: this.id,
            name: this.name,
            ownerUid: this.ownerUid,
            ownerName: this.ownerName,
            ownerAvatar: this.ownerAvatar,
            seats: this.seats,
            lockedSeats: this.lockedSeats,
            admins: Array.from(this.admins),
            mutedUsers: Array.from(this.mutedUsers),
            layout: this.layout,
            leaderUid: this.getLeader(),
            viewerCount: this.viewers.size,
            seatedCount: this.seats.filter(Boolean).length,
            messages: this.messages,
            boostLevel: this.boostLevel,
            maxSeatCount: this.maxSeatCount,       // Oda sahibinin seçtiği koltuk
            maxSeatsByLevel: BOOST_MAX_SEATS_BY_LEVEL[this.boostLevel], // LV maks
            maxViewers: BOOST_MAX_VIEWERS[this.boostLevel] === Infinity ? null : BOOST_MAX_VIEWERS[this.boostLevel],
            followerCount: this.followers.size,
            nextBoostAt: this.boostLevel < 3 ? BOOST_THRESHOLDS[this.boostLevel + 1] : null,
            createdAt: this.createdAt,
            isSleeping: this.isSleeping,
            announcement: this.announcement, // Yeni
            slowMode: this.slowMode, // Yeni
            chatDisabled: this.chatDisabled // Yeni
        };
    }
}

/* ═══════════════════════════════════════════════════════════
 *  ROOM PERSISTENCE — PocketBase Birincil + JSON Yedek
 *  Odalar PocketBase veritabanına kaydedilir.
 *  JSON dosyası sadece yedek (fallback) olarak tutulur.
 * ═══════════════════════════════════════════════════════════ */
import PocketBase from 'pocketbase';

const ROOMS_FILE = path.join(__dirname, 'rooms_backup.json');
const PB_URL = 'http://127.0.0.1:8090';
const pbAdmin = new PocketBase(PB_URL);
let pbReady = false; // PocketBase bağlantı durumu

// ─── PocketBase Bağlantısı ve Koleksiyon Kontrolü ───
async function initPocketBase() {
    try {
        // Admin olarak giriş yap
        await pbAdmin.collection('_superusers').authWithPassword(
            'emirhandesdemir@gmail.com',
            'Gunahbenim09'
        );
        console.log('[PB] ✅ PocketBase admin girişi başarılı');

        // 'rooms' koleksiyonu var mı kontrol et
        try {
            await pbAdmin.collections.getOne('rooms');
            console.log('[PB] ✅ rooms koleksiyonu mevcut');
        } catch {
            // Yoksa oluştur
            console.log('[PB] 🔧 rooms koleksiyonu oluşturuluyor...');
            await pbAdmin.collections.create({
                name: 'rooms',
                type: 'base',
                fields: [
                    { name: 'roomId', type: 'text', required: true },
                    { name: 'name', type: 'text', required: true },
                    { name: 'ownerUid', type: 'text', required: true },
                    { name: 'ownerName', type: 'text', required: false },
                    { name: 'ownerAvatar', type: 'text', required: false },
                    { name: 'maxSeatCount', type: 'number', required: false },
                    { name: 'boostLevel', type: 'number', required: false },
                    { name: 'isSleeping', type: 'bool', required: false },
                    { name: 'admins', type: 'json', required: false },
                    { name: 'mutedUsers', type: 'json', required: false },
                    { name: 'blockedUsers', type: 'json', required: false },
                    { name: 'followers', type: 'json', required: false },
                    { name: 'lockedSeats', type: 'json', required: false },
                    { name: 'layout', type: 'text', required: false },
                    { name: 'roomCreatedAt', type: 'number', required: false },
                    { name: 'announcement', type: 'text', required: false },
                ],
                listRule: '',
                viewRule: '',
                createRule: null,
                updateRule: null,
                deleteRule: null,
            });
            console.log('[PB] ✅ rooms koleksiyonu oluşturuldu!');
        }

        pbReady = true;
    } catch (e) {
        console.error('[PB] ❌ PocketBase bağlantı hatası:', e.message);
        pbReady = false;
    }
}

// ─── PocketBase'den Odaları Yükle ───
async function loadRoomsFromPB() {
    if (!pbReady) return false;
    try {
        const records = await pbAdmin.collection('rooms').getFullList({ sort: '-created' });
        if (records.length === 0) return false;

        records.forEach(r => {
            if (rooms.has(r.roomId)) return; // Zaten yüklenmişse atla
            const newRoom = new Room(r.roomId, r.name, r.ownerUid, r.ownerName || '', r.ownerAvatar || '', r.maxSeatCount || 8);
            newRoom.admins = new Set(r.admins || [r.ownerUid]);
            newRoom.mutedUsers = new Set(r.mutedUsers || []);
            newRoom.blockedUsers = new Set(r.blockedUsers || []);
            newRoom.layout = r.layout || 'grid';
            newRoom.createdAt = r.roomCreatedAt || Date.now();
            newRoom.isSleeping = r.isSleeping || false;
            newRoom.boostLevel = r.boostLevel || 1;
            newRoom.announcement = r.announcement || "";
            newRoom.slowMode = r.slowMode || false;
            newRoom.chatDisabled = r.chatDisabled || false;
            if (r.followers && Array.isArray(r.followers)) {
                newRoom.followers = new Map(r.followers);
            }
            if (r.lockedSeats) {
                newRoom.lockedSeats = r.lockedSeats;
            }
            newRoom.updateBoostFromFollowers();
            rooms.set(r.roomId, newRoom);
        });
        console.log(`[PB] ✅ PocketBase'den ${records.length} oda yüklendi.`);
        return true;
    } catch (e) {
        console.error('[PB] ❌ Oda yükleme hatası:', e.message);
        return false;
    }
}

// ─── PocketBase'e Tek Bir Odayı Kaydet/Güncelle ───
async function saveRoomToPB(room) {
    if (!pbReady) return;
    try {
        const data = {
            roomId: room.id,
            name: room.name,
            ownerUid: room.ownerUid,
            ownerName: room.ownerName,
            ownerAvatar: room.ownerAvatar,
            maxSeatCount: room.maxSeatCount,
            boostLevel: room.boostLevel,
            isSleeping: room.isSleeping,
            admins: Array.from(room.admins),
            mutedUsers: Array.from(room.mutedUsers),
            blockedUsers: Array.from(room.blockedUsers),
            followers: Array.from(room.followers.entries()),
            lockedSeats: room.lockedSeats,
            layout: room.layout,
            roomCreatedAt: room.createdAt,
            announcement: room.announcement,
            slowMode: room.slowMode,
            chatDisabled: room.chatDisabled,
        };

        // Mevcut kaydı bul
        try {
            const existing = await pbAdmin.collection('rooms').getFirstListItem(`roomId="${room.id}"`);
            await pbAdmin.collection('rooms').update(existing.id, data);
        } catch {
            // Kayıt yoksa yeni oluştur
            await pbAdmin.collection('rooms').create(data);
        }
    } catch (e) {
        console.error(`[PB] ❌ Oda kaydetme hatası (${room.id}):`, e.message);
    }
}

// ─── PocketBase'den Tek Bir Odayı Sil ───
async function deleteRoomFromPB(roomId) {
    if (!pbReady) return;
    try {
        const existing = await pbAdmin.collection('rooms').getFirstListItem(`roomId="${roomId}"`);
        await pbAdmin.collection('rooms').delete(existing.id);
        console.log(`[PB] 🗑️ Oda PB'den silindi: ${roomId}`);
    } catch (e) {
        // Kayıt bulunamadıysa sorun değil
    }
}

// ─── JSON Yedek Kaydetme (Eski sistem — fallback) ───
function saveRoomsToFile() {
    try {
        const roomsData = Array.from(rooms.entries()).map(([id, room]) => ({
            id: room.id, name: room.name, ownerUid: room.ownerUid,
            ownerName: room.ownerName, ownerAvatar: room.ownerAvatar,
            maxSeatCount: room.maxSeatCount, admins: Array.from(room.admins),
            mutedUsers: Array.from(room.mutedUsers), blockedUsers: Array.from(room.blockedUsers),
            layout: room.layout, createdAt: room.createdAt, isSleeping: room.isSleeping,
            followers: Array.from(room.followers.entries()), lockedSeats: room.lockedSeats,
            announcement: room.announcement, slowMode: room.slowMode, chatDisabled: room.chatDisabled
        }));
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(roomsData, null, 2));
    } catch (e) {
        console.error("[ROOM_BACKUP] JSON yedek hatası:", e.message);
    }
}

// ─── JSON'dan Odaları Yükle (Fallback) ───
function loadRoomsFromFile() {
    try {
        if (fs.existsSync(ROOMS_FILE)) {
            const data = fs.readFileSync(ROOMS_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            parsed.forEach(r => {
                if (rooms.has(r.id)) return;
                const newRoom = new Room(r.id, r.name, r.ownerUid, r.ownerName, r.ownerAvatar, r.maxSeatCount || 8);
                newRoom.admins = new Set(r.admins || [r.ownerUid]);
                newRoom.mutedUsers = new Set(r.mutedUsers || []);
                newRoom.blockedUsers = new Set(r.blockedUsers || []);
                newRoom.layout = r.layout || 'grid';
                newRoom.createdAt = r.createdAt || Date.now();
                newRoom.isSleeping = r.isSleeping || false;
                if (r.followers) newRoom.followers = new Map(r.followers);
                if (r.lockedSeats) newRoom.lockedSeats = r.lockedSeats;
                newRoom.announcement = r.announcement || "";
                newRoom.slowMode = r.slowMode || false;
                newRoom.chatDisabled = r.chatDisabled || false;
                newRoom.updateBoostFromFollowers();
                rooms.set(r.id, newRoom);
            });
            console.log(`[ROOM_BACKUP] JSON'dan ${rooms.size} oda yüklendi (fallback).`);
        }
    } catch (e) {
        console.error("[ROOM_BACKUP] JSON yükleme hatası:", e.message);
    }
}

// ─── Başlangıç: PocketBase önce, JSON yedek ───
(async () => {
    await initPocketBase();
    const loadedFromPB = await loadRoomsFromPB();
    if (!loadedFromPB) {
        console.log('[ROOM] PB yüklenemedi, JSON yedekten yükleniyor...');
        loadRoomsFromFile();
    }
})();

// ─── Periyodik kayıt: Hem PB hem JSON (her 15 saniye) ───
setInterval(async () => {
    saveRoomsToFile(); // JSON yedek her zaman güncellenir
    // PocketBase'e toplu güncelleme (sadece PB hazırsa)
    if (pbReady) {
        for (const room of rooms.values()) {
            await saveRoomToPB(room);
        }
    }
}, 15000);

// --- API ---
app.get('/rooms', (req, res) => {
    const list = Array.from(rooms.values()).map(r => ({
        id: r.id,
        name: r.name,
        ownerUid: r.ownerUid,
        ownerName: r.ownerName,
        ownerAvatar: r.ownerAvatar,
        viewerCount: r.isDummy ? (20 + Math.floor(Math.random() * 30)) : r.viewers.size,
        seatedCount: r.isDummy ? 8 : r.seats.filter(Boolean).length,
        leaderUid: r.getLeader(),
        boostLevel: r.boostLevel,
        // maxViewers lobi kartinda gösterim için
        maxViewers: BOOST_MAX_VIEWERS[r.boostLevel] === Infinity ? null : BOOST_MAX_VIEWERS[r.boostLevel],
        followerCount: r.followers.size,
        isSleeping: r.isSleeping
    }));
    res.json(list);
});

// Oda takıpçi listesini getir
app.get('/rooms/:roomId/followers', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });
    res.json(Array.from(room.followers.values()));
});

// Boost bilgisi al
app.get('/rooms/:roomId/boost-info', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });
    res.json({
        boostLevel: room.boostLevel,
        followerCount: room.followers.size,
        maxSeats: BOOST_MAX_SEATS[room.boostLevel],
        nextBoostAt: room.boostLevel < 3 ? BOOST_THRESHOLDS[room.boostLevel + 1] : null,
        levelName: BOOST_LEVEL_NAMES[room.boostLevel]
    });
});

// --- ADMIN API ---
// Bakım modu state'i (sunucu bellekte tutar)
let maintenanceMode = false;

// Admin güvenlik anahtarı - Bu anahtar ile admin paneline giriş yapılır
const ADMIN_SECRET_KEY = 'Gunahbenim09';

// Admin kimlik doğrulama middleware'i
const adminAuth = (req, res, next) => {
    const authHeader = req.headers['x-admin-key'];
    if (authHeader !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: 'Yetkisiz erişim. Admin anahtarı geçersiz.' });
    }
    next();
};

// ═══ SUNUCU DURUMU (Stats) ═══
app.get('/admin/stats', adminAuth, (req, res) => {
    const totalSockets = users.size;
    const totalRooms = rooms.size;
    const activeRooms = Array.from(rooms.values()).filter(r => !r.isSleeping).length;
    const sleepingRooms = Array.from(rooms.values()).filter(r => r.isSleeping).length;
    const usersInSeats = Array.from(rooms.values()).reduce((acc, r) => acc + r.seats.filter(Boolean).length, 0);
    const totalViewers = Array.from(rooms.values()).reduce((acc, r) => acc + r.viewers.size, 0);
    const uptime = process.uptime();
    const mem = process.memoryUsage();

    res.json({
        totalSockets,
        totalRooms,
        activeRooms,
        sleepingRooms,
        usersInSeats,
        totalViewers,
        uptime,
        memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
        rssMemoryMB: Math.round(mem.rss / 1024 / 1024),
        maxCapacity: 10000,
        maxVoice: 2000,
        maintenanceMode,
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
    });
});

// ═══ ÇEVRİMİÇİ KULLANICILAR ═══
app.get('/admin/users', adminAuth, (req, res) => {
    const search = (req.query.search || '').toLowerCase();
    const list = Array.from(users.values())
        .filter(u => !search || (u.username && u.username.toLowerCase().includes(search)) || (u.uid && u.uid.includes(search)))
        .map(u => ({
            id: u.uid || u.id,
            socketId: u.id,
            username: u.username || 'Misafir',
            avatar: u.avatar,
            color: u.color
        }));
    res.json(list);
});

// ═══ KULLANICIYI AT (Kick) ═══
app.delete('/admin/users/:id', adminAuth, (req, res) => {
    const uid = req.params.id;
    let socketId = null;
    for (const [sid, u] of users.entries()) {
        if (u.uid === uid || u.id === uid) {
            socketId = sid;
            break;
        }
    }

    if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            socket.emit('err', 'Hesabınız yönetici tarafından kapatıldı.');
            socket.disconnect(true);
        }
        users.delete(socketId);
    }
    res.json({ success: true });
});

// ═══ TÜM ODALARI LİSTELE (Admin detaylı) ═══
app.get('/admin/rooms', adminAuth, (req, res) => {
    const list = Array.from(rooms.values()).map(r => ({
        id: r.id,
        name: r.name,
        ownerUid: r.ownerUid,
        ownerName: r.ownerName,
        ownerAvatar: r.ownerAvatar,
        viewerCount: r.viewers.size,
        seatedCount: r.seats.filter(Boolean).length,
        maxSeatCount: r.maxSeatCount,
        boostLevel: r.boostLevel,
        followerCount: r.followers.size,
        isSleeping: r.isSleeping,
        createdAt: r.createdAt,
        messageCount: r.messages.length,
        adminCount: r.admins.size,
        mutedCount: r.mutedUsers.size,
        blockedCount: r.blockedUsers.size
    }));
    res.json(list);
});

// ═══ ODA SİL ═══
app.delete('/admin/rooms/:id', adminAuth, (req, res) => {
    const roomId = req.params.id;
    const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });

    // Odadaki herkese bildir ve çıkar
    io.to(roomId).emit('room_closed', { message: 'Bu oda yönetici tarafından kapatıldı.' });
    io.in(roomId).socketsLeave(roomId);

    rooms.delete(roomId);
    deleteRoomFromPB(roomId); // PocketBase'den de sil
    saveRoomsToFile(); // JSON yedekten de sil
    io.emit('room_list_update');

    console.log(`[ADMIN] Oda silindi: ${room.name} (${roomId})`);
    res.json({ success: true, deletedRoom: room.name });
});

// ═══ SİSTEM DUYURUSU (Broadcast) ═══
app.post('/admin/broadcast', adminAuth, (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mesaj gerekli' });

    io.emit('admin_broadcast', {
        message,
        timestamp: Date.now(),
        type: 'admin_announcement'
    });

    console.log(`[ADMIN] Duyuru gönderildi: ${message}`);
    res.json({ success: true, recipientCount: users.size });
});

// ═══ BAKIM MODU AÇ/KAPAT ═══
app.post('/admin/maintenance', adminAuth, (req, res) => {
    const { enabled } = req.body;
    maintenanceMode = !!enabled;

    if (maintenanceMode) {
        io.emit('admin_broadcast', {
            message: '⚠️ Sistem bakım moduna alındı. Lütfen bekleyin.',
            timestamp: Date.now(),
            type: 'maintenance'
        });
    }

    console.log(`[ADMIN] Bakım modu: ${maintenanceMode ? 'AÇIK' : 'KAPALI'}`);
    res.json({ success: true, maintenanceMode });
});

// ═══ TEST ARKADAŞLIK İSTEĞİ ═══
app.post('/admin/test-friend-request', adminAuth, (req, res) => {
    const { fromName } = req.body;
    io.emit('friend_request_received', { fromName: fromName || 'Sistem Test' });
    res.json({ success: true });
});

// ═══ ADMIN GİRİŞ DOĞRULAMA ═══
app.post('/admin/login', (req, res) => {
    const { key } = req.body;
    if (key === ADMIN_SECRET_KEY) {
        res.json({ success: true, message: 'Giriş başarılı' });
    } else {
        res.status(401).json({ success: false, error: 'Geçersiz anahtar' });
    }
});

// --- SOCKET LOGIC ---
let matchPool1v1 = []; // 1v1 Eşleşme Havuzu
const room1v1Decisions = new Map(); // Store 1v1 match decisions

io.on('connection', (socket) => {
    console.log(`[CONN] New: ${socket.id}`);

    socket.on('auth', (data) => {
        users.set(socket.id, { id: socket.id, ...data });

        // Update moderator status if they are indeed a moderator in any room (or just track everyone's last seen)
        if (data.uid) {
            moderatorStatus.set(data.uid, {
                uid: data.uid,
                username: data.username,
                avatar: data.avatar,
                lastSeen: Date.now(),
                isOnline: true
            });
        }

        socket.emit('auth_ok', { socketId: socket.id, ...data });
    });

    // === 1v1 EŞLEŞME SİSTEMİ EKLENDİ ===
    socket.on('join_1v1_pool', (userData) => {
        matchPool1v1 = matchPool1v1.filter(m => m.socket.id !== socket.id && m.uid !== userData.uid);
        matchPool1v1.push({ socket, uid: userData.uid, name: userData.name, avatar: userData.avatar });
        console.log(`[1v1] Join Pool: ${userData.name}, Pool size: ${matchPool1v1.length}`);

        if (matchPool1v1.length >= 2) {
            const user1 = matchPool1v1.shift();
            const user2 = matchPool1v1.shift();

            const roomId = `1v1_${user1.uid}_${user2.uid}_${Date.now()}`;
            user1.socket.join(roomId);
            user2.socket.join(roomId);

            user1.socket.emit('1v1_matched', { roomId, partner: { uid: user2.uid, name: user2.name, avatar: user2.avatar } });
            user2.socket.emit('1v1_matched', { roomId, partner: { uid: user1.uid, name: user1.name, avatar: user1.avatar } });
            console.log(`[1v1] Matched: ${user1.name} & ${user2.name}`);
        }
    });

    socket.on('leave_1v1_pool', () => {
        matchPool1v1 = matchPool1v1.filter(m => m.socket.id !== socket.id);
    });

    socket.on('join_1v1_room_reconnect', (roomId) => {
        socket.join(roomId);
        console.log(`[1v1] Socket reconnected to room: ${roomId}`);
    });

    socket.on('leave_1v1_room', (roomId) => {
        socket.leave(roomId);
        socket.to(roomId).emit('partner_left');
    });

    socket.on('send_message', (data) => {
        const targetRooms = Array.from(socket.rooms).filter(r => r.startsWith('1v1_'));
        targetRooms.forEach(room => {
            io.to(room).emit('receive_message', data);
        });
    });

    socket.on('ready_for_voice', () => {
        const targetRooms = Array.from(socket.rooms).filter(r => r.startsWith('1v1_'));
        targetRooms.forEach(room => {
            socket.to(room).emit('user_ready_voice', socket.id);
        });
    });

    socket.on('webrtc_offer', ({ target, offer }) => {
        const tSocket = io.sockets.sockets.get(target);
        if (tSocket) tSocket.emit('webrtc_offer', { sender: socket.id, offer });
    });

    socket.on('webrtc_answer', ({ target, answer }) => {
        const tSocket = io.sockets.sockets.get(target);
        if (tSocket) tSocket.emit('webrtc_answer', { sender: socket.id, answer });
    });

    socket.on('webrtc_ice_candidate', ({ target, candidate }) => {
        const tSocket = io.sockets.sockets.get(target);
        if (tSocket) tSocket.emit('webrtc_ice_candidate', { sender: socket.id, candidate });
    });

    socket.on('1v1_decision', ({ targetRoom, decision }) => {
        if (!targetRoom) return;

        if (decision === 'decline') {
            socket.to(targetRoom).emit('1v1_partner_decision', 'decline');
            room1v1Decisions.delete(targetRoom);
        } else if (decision === 'accept') {
            let accepts = room1v1Decisions.get(targetRoom) || 0;
            accepts++;
            room1v1Decisions.set(targetRoom, accepts);

            if (accepts >= 2) {
                io.to(targetRoom).emit('1v1_dm_start');
                room1v1Decisions.delete(targetRoom); // clean up
            } else {
                // Not both yet, just wait. The frontend sets state to 'waiting'.
            }
        }
    });
    // === 1v1 BİTİŞ ===

    socket.on('create_room', (data) => {
        const user = users.get(socket.id);
        if (!user) return socket.emit('err', 'Auth failed');

        const roomId = `room_8${Math.random().toString(36).substr(2, 9)}`;
        const roomName = data.name || `${user.username}'in Odası`;
        // Koltuk sayısını LV1 (başlangıç) maksımıyla sınırla (8)
        const requestedSeats = parseInt(data.seatCount) || 8;
        const allowedMax = BOOST_MAX_SEATS_BY_LEVEL[1]; // Başlangıçta LV1 = 8
        const finalSeatCount = Math.min(requestedSeats, allowedMax);
        const newRoom = new Room(roomId, roomName, user.uid, user.username, user.avatar, finalSeatCount);

        rooms.set(roomId, newRoom);
        saveRoomToPB(newRoom); // PocketBase'e anında kaydet
        saveRoomsToFile(); // JSON yedek
        console.log(`[ROOM] Created: ${roomName} (${roomId}) - ${finalSeatCount} koltuk`);

        socket.emit('room_created', roomId);

        // Notify all clients that a new room exists
        io.emit('room_list_update');
    });

    socket.on('join_room', (roomId) => {
        const user = users.get(socket.id);
        const room = rooms.get(roomId);

        if (!user || !room) return socket.emit('err', 'Oda bulunamadı');
        if (room.isDummy) return socket.emit('err', 'Bu oda şu an dolu, lütfen başka bir odaya katılın.');
        if (room.blockedUsers.has(user.uid)) return socket.emit('err', 'Bu odadan engellendiniz');

        // === KATILIMCI LİMİT KONTROLÜ ===
        // Oda zaten izsleyicisinin içindeyse yeniden limite takılmasın
        const alreadyInRoom = room.viewers.has(socket.id);
        if (!alreadyInRoom) {
            const maxViewers = BOOST_MAX_VIEWERS[room.boostLevel];
            if (room.viewers.size >= maxViewers) {
                return socket.emit('err',
                    `Bu oda dolu! (${room.viewers.size}/${maxViewers === Infinity ? '\u221e' : maxViewers} kişi). ` +
                    `Oda LV${room.boostLevel + 1}'e ulaşınca daha fazla kişi girebilir.`
                );
            }
        }

        socket.join(roomId);
        user.currentRoomId = roomId;
        room.viewers.set(socket.id, user);
        room.isSleeping = false; // Biri girince uyanır

        socket.emit('room_snapshot', room.snapshot);
        // Diğer odadakilere kullanıcı sayısının arttığını bildirmek için güncel snapshot yolla:
        io.to(roomId).emit('room_updated', room.snapshot);

        // Diğerlerine WebRTC başlatma bildirimi gönder
        socket.to(roomId).emit('user_joined_room', { socketId: socket.id, username: user.username });

        const sysMsg = room.addMessage('system_chat', { username: 'Sistem', avatar: '/assets/jack.png', uid: 'sys' }, `${user.username} odaya katıldı 👋`);
        io.to(roomId).emit('msg', sysMsg);

        io.emit('room_list_update');
        console.log(`[JOIN] ${user.username} → ${room.name} (${room.viewers.size}/${BOOST_MAX_VIEWERS[room.boostLevel] === Infinity ? '∞' : BOOST_MAX_VIEWERS[room.boostLevel]})`);
    });

    socket.on('send_msg', (text) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (room) {
            if (room.chatDisabled && !room.admins.has(user.uid)) {
                return socket.emit('err', 'Bu odada mesaj yazma kapalıdır.');
            }

            // Komut Sistemi v1 (Sadece admin ve oda sahipleri)
            if (text === '/clear' && room.admins.has(user.uid)) {
                room.messages = []; // sunucu tarafındaki belleği temizle
                io.to(room.id).emit('clear_chat');

                const sysMsg = room.addMessage('system_chat', { username: 'Sistem', avatar: '/assets/jack.png', uid: 'sys' }, `Moderatör ${user.username} sohbet geçmişini temizledi. 🧹`);
                io.to(room.id).emit('msg', sysMsg);
                saveRoomToPB(room);
                saveRoomsToFile();
                return;
            }

            if (room.slowMode && !room.admins.has(user.uid)) {
                const now = Date.now();
                if (user.lastMsgTime && now - user.lastMsgTime < 5000) {
                    const remaining = Math.ceil((5000 - (now - user.lastMsgTime)) / 1000);
                    return socket.emit('err', `Yavaş Mod (5s): Yeni mesaj için ${remaining} saniye bekleyin.`);
                }
                user.lastMsgTime = now;
            }
            const msg = room.addMessage('chat', user, text);

            // @mention detection
            const mentions = text.match(/@(\w+)/g);
            if (mentions) {
                msg.mentions = mentions.map(m => m.substring(1));
            }

            io.to(room.id).emit('msg', msg);
        }
    });

    socket.on('update_slow_mode', (enabled) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        if (!room.admins.has(user.uid)) return socket.emit('err', 'Sadece yöneticiler yavaş modu değiştirebilir.');

        room.slowMode = !!enabled;
        io.to(room.id).emit('room_updated', room.snapshot);

        // Notify chat
        const sysMsg = room.addMessage('system', null, `Yavaş Mod ${room.slowMode ? 'Aktif (5s)' : 'Kapatıldı'}`);
        io.to(room.id).emit('msg', sysMsg);

        saveRoomToPB(room);
        saveRoomsToFile();
    });

    socket.on('update_chat_disabled', (disabled) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        if (!room.admins.has(user.uid)) return socket.emit('err', 'Sadece yöneticiler sohbeti kapatabilir.');

        room.chatDisabled = !!disabled;
        io.to(room.id).emit('room_updated', room.snapshot);

        // Notify chat
        const sysMsg = room.addMessage('system', null, `Oda Sohbeti ${room.chatDisabled ? 'Kapatıldı' : 'Açıldı'}`);
        io.to(room.id).emit('msg', sysMsg);

        saveRoomToPB(room);
        saveRoomsToFile();
    });

    socket.on('update_announcement', (text) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        // Yetki kontrolü: Sadece oda sahibi veya adminler güncelleyebilir
        if (!room.admins.has(user.uid)) return socket.emit('err', 'Duyuruyu sadece yöneticiler güncelleyebilir.');

        room.announcement = text;
        io.to(room.id).emit('announcement_updated', text);

        // Veritabanına kaydet
        saveRoomToPB(room);
        saveRoomsToFile();
    });

    socket.on('take_seat', (index) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (!room || index < 0 || index > 15) return;

        if (room.lockedSeats[index] && !room.admins.has(user.uid)) return socket.emit('err', 'Bu koltuk kilitli');
        if (room.seats[index]) return socket.emit('err', 'Koltuk dolu');

        // Remove from old seat if any
        const oldSeatIndex = room.seats.findIndex(s => s?.socketId === socket.id);
        if (oldSeatIndex !== -1) room.seats[oldSeatIndex] = null;

        user.seatIndex = index;
        room.seats[index] = {
            socketId: socket.id,
            uid: user.uid,
            username: user.username,
            avatar: user.avatar,
            color: user.color || '#8b5cf6',
            isSpeaking: 0 // Initialize with 0 volume
        };

        io.to(room.id).emit('seats_sync', room.seats);
        io.emit('room_list_update');
    });

    socket.on('leave_seat', () => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        const seatIndex = room.seats.findIndex(s => s?.socketId === socket.id);
        if (seatIndex !== -1) {
            room.seats[seatIndex] = null;
            io.to(room.id).emit('seats_sync', room.seats);
            io.emit('room_list_update');
        }
    });

    socket.on('leave_room', () => {
        leaveRoomCompletely(socket.id);
        socket.rooms.forEach(r => {
            if (r.startsWith('room_') || r === 'global') socket.leave(r);
        });
    });

    // ─── ODA ARKA PLAN RESMİ YÜKLEME ───
    // İstemciden base64 formatında gelir, sunucu PocketBase'e kayıt eder
    socket.on('update_room_background', async (data) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return socket.emit('err', 'Odada değilsiniz.');

        // Sadece oda admini arkaplan değiştirebilir
        const room = rooms.get(data.roomId || user.currentRoomId);
        if (!room) return socket.emit('err', 'Oda bulunamadı.');
        if (!room.admins.has(user.uid)) return socket.emit('err', 'Sadece yöneticiler arka plan değiştirebilir.');

        try {
            // base64'den Buffer'a çevir
            const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            // Dosya adı ve uzantı belirle
            const ext = (data.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
            const filename = `bg_${room.id}_${Date.now()}.${ext}`;

            // Blob oluştur ve FormData'ya ekle (node.js form-data benzeri)
            if (pbReady) {
                const { Blob, FormData } = await import('node:buffer').then(m => ({ Blob: m.Blob, FormData: global.FormData }));
                const blob = new global.Blob([buffer], { type: data.mimeType || 'image/jpeg' });
                const formData = new global.FormData();
                formData.append('background', blob, filename);

                await pb.collection('rooms').update(room.id, formData);
                console.log(`[BG] Arka plan güncellendi: ${room.name}`);

                // PocketBase'den güncel URL al
                const updated = await pb.collection('rooms').getOne(room.id);
                const bgUrl = updated.background ? pb.files.getUrl(updated, updated.background) : null;

                if (bgUrl) {
                    room.backgroundUrl = bgUrl;
                    // Odadaki herkese yeni arka planı bildir
                    io.to(room.id).emit('room_background_updated', { url: bgUrl });
                    socket.emit('bg_upload_ok', { url: bgUrl });
                }
            } else {
                socket.emit('err', 'Veritabanı hazır değil, lütfen bekleyip tekrar deneyin.');
            }
        } catch (e) {
            console.error('[BG] Arka plan yükleme hatası:', e.message);
            socket.emit('err', 'Arka plan yüklenirken hata: ' + e.message);
        }
    });

    // ===================================================
    // --- WEBRTC SES/GÖRÜNTÜ SİNYAL İLETİMİ ---
    // Kritik: İstemciler arası WebRTC sinyalleri sunucu üzerinden iletilir
    // P2P bağlantısı kurulana kadar tüm signaling buradan geçer
    // ===================================================
    socket.on('webrtc_signal', (data) => {
        // Hedef socket ID'si var mı ve hedef soket bağlı mı kontrol et
        if (!data.to || !data.signal || !data.type) return;

        // Hedef soket'e direkt ilet (to() ile tek kişiye gönder)
        const targetSocket = io.sockets.sockets.get(data.to);
        if (targetSocket) {
            targetSocket.emit('webrtc_signal', {
                from: socket.id,
                signal: data.signal,
                type: data.type
            });
            console.log(`[WebRTC] ${data.type} iletildi: ${socket.id.slice(-4)} → ${data.to.slice(-4)}`);
        } else {
            console.warn(`[WebRTC] Hedef bulunamadı: ${data.to}`);
        }
    });

    // Offer isteği: "Bana stream gönderir misin?" sinyali
    socket.on('request_offer', (data) => {
        if (!data.to) return;
        const targetSocket = io.sockets.sockets.get(data.to);
        if (targetSocket) {
            // Hedef kişiye "bu soketten offer iste" mesajı gönder
            targetSocket.emit('request_offer', { from: socket.id });
            console.log(`[WebRTC] Offer isteği: ${socket.id.slice(-4)} → ${data.to.slice(-4)}`);
        }
    });

    // Mic açık sinyali: Odadaki herkese bildir
    socket.on('peer_mic_on', (data) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        // Aynı odadaki herkese (kendisi hariç) bildir
        socket.to(user.currentRoomId).emit('peer_mic_on', {
            socketId: socket.id,
            uid: user.uid,
            roomId: data?.roomId || user.currentRoomId
        });
    });

    socket.on('speaking_state', (volume) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        if (room.mutedUsers.has(user.uid)) {
            volume = 0; // Adminler tarafından susturulmuşsa sesi sıfırla
        }

        const seatIndex = room.seats.findIndex(s => s?.socketId === socket.id);
        if (seatIndex !== -1) {
            room.seats[seatIndex].isSpeaking = volume;
            io.to(room.id).emit('seats_sync', room.seats);
        }
    });

    // --- ODA TAKİP SİSTEMİ ---
    socket.on('follow_room', ({ targetRoomId }) => {
        const user = users.get(socket.id);
        if (!user) return;
        const room = rooms.get(targetRoomId);
        if (!room) return;
        // Takipçiyi ekle
        room.followers.set(user.uid, {
            uid: user.uid,
            username: user.username,
            avatar: user.avatar,
            followedAt: Date.now()
        });
        socket.emit('follow_room_ok', { roomId: targetRoomId, followerCount: room.followers.size });
        // Oda sahibine bildirim
        room.viewers.forEach((_, sid) => {
            const v = users.get(sid);
            if (v && v.uid === room.ownerUid) {
                io.to(sid).emit('room_followed', { by: user.username, followerCount: room.followers.size });
            }
        });
        // Takıpçi sayısına göre boost seviyesini otomatik güncelle
        const boosted = room.updateBoostFromFollowers();

        // Oda içindekilere gerçek zamanlı güncelleme gönder (İlerleme çubuğu akışı için)
        io.to(room.id).emit('room_updated', room.snapshot);
        io.emit('room_list_update');

        if (boosted) {
            // Seviye yükseliş bildirimi - o andaki koltuk maksımı
            io.to(room.id).emit('boost_level_up', { level: room.boostLevel, maxSeatsByLevel: BOOST_MAX_SEATS_BY_LEVEL[room.boostLevel] });
        }
        console.log(`[FOLLOW] ${user.username} → ${room.name} (${room.followers.size} takıpçi, LV${room.boostLevel})`);
    });

    socket.on('unfollow_room', ({ targetRoomId }) => {
        const user = users.get(socket.id);
        if (!user) return;
        const room = rooms.get(targetRoomId);
        if (!room) return;
        room.followers.delete(user.uid);

        // Silme sonrası boost seviyesini otomatik kontrol et (düşüş)
        const downgraded = room.updateBoostFromFollowers();

        // Oda içindekilere gerçek zamanlı güncelleme gönder (İlerleme çubuğu akışı için)
        io.to(room.id).emit('room_updated', room.snapshot);
        socket.emit('follow_room_ok', { roomId: targetRoomId, followerCount: room.followers.size });
        io.emit('room_list_update');

        if (downgraded) {
            io.to(room.id).emit('boost_level_down', {
                level: room.boostLevel,
                maxSeatsByLevel: BOOST_MAX_SEATS_BY_LEVEL[room.boostLevel],
                followerCount: room.followers.size
            });
            console.log(`[BOOST-DOWN] ${room.name} LV${room.boostLevel}'e düştü (${room.followers.size} takipçi)`);
        }
        console.log(`[UNFOLLOW] ${user.username} ← ${room.name} (${room.followers.size} takipçi)`);
    });

    // Odayı takip edip etmediğini kontrol et
    socket.on('check_follow', ({ targetRoomId }) => {
        const user = users.get(socket.id);
        if (!user) return;
        const room = rooms.get(targetRoomId);
        const isFollowing = room ? room.followers.has(user.uid) : false;
        socket.emit('check_follow_result', { roomId: targetRoomId, isFollowing });
    });

    socket.on('get_room_users', (data) => {
        const targetRoomId = data?.roomId;
        if (!targetRoomId) return;

        const room = rooms.get(targetRoomId);
        if (!room) return;

        // Current online users
        const onlineUsers = Array.from(room.viewers.values()).map(u => ({
            uid: u.uid,
            socketId: u.id || u.socketId,
            username: u.username,
            avatar: u.avatar,
            isAdmin: room.admins.has(u.uid),
            isOwner: room.ownerUid === u.uid,
            isOnline: true
        }));

        // Collect all moderators (even if offline)
        const allMods = [];
        room.admins.forEach(adminUid => {
            // Check if already in onlineUsers
            if (onlineUsers.find(u => u.uid === adminUid)) return;

            // Get cached info from moderatorStatus or room data
            const status = moderatorStatus.get(adminUid);
            if (status) {
                allMods.push({
                    uid: adminUid,
                    username: status.username,
                    avatar: status.avatar,
                    isAdmin: true,
                    isOwner: room.ownerUid === adminUid,
                    isOnline: false,
                    lastSeen: status.lastSeen
                });
            } else {
                // Minimum info if not in memory
                allMods.push({
                    uid: adminUid,
                    username: "Bilinmeyen Mod",
                    isAdmin: true,
                    isOwner: room.ownerUid === adminUid,
                    isOnline: false
                });
            }
        });

        socket.emit('room_users_list', [...onlineUsers, ...allMods]);
    });

    socket.on('get_blocked_users', (data) => {
        const room = rooms.get(data?.roomId);
        if (!room) return;

        // Blocked users are just UIDs in room.blockedUsers
        // We need to try and get their usernames from moderatorStatus or current online users
        const list = Array.from(room.blockedUsers).map(uid => {
            const status = moderatorStatus.get(uid);
            return {
                id: uid,
                username: status ? status.username : "Engellenmiş Kullanıcı",
                avatar: status ? status.avatar : ""
            };
        });
        socket.emit('blocked_users_list', list);
    });

    socket.on('admin_action', (data) => {
        const { action, targetUid, targetSocketId, seatIndex } = data;
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;

        const room = rooms.get(user.currentRoomId);
        if (!room || !room.admins.has(user.uid)) return;

        // Kural: Sadece oda sahibi odayı silebilir
        if (action === 'delete_room') {
            if (user.uid !== room.ownerUid) return socket.emit('err', 'Sadece oda sahibi odayı silebilir.');
            io.to(room.id).emit('err', 'Oda sahibi odayı kapattı');
            // Clean up viewers currentRoomId
            room.viewers.forEach((v, sid) => {
                const u = users.get(sid);
                if (u) u.currentRoomId = null;
                const s = io.sockets.sockets.get(sid);
                if (s) s.leave(room.id);
            });
            rooms.delete(room.id);
            io.emit('room_list_update');
            return;
        }

        // Kural: Sadece oda sahibi moderatör atayabilir
        if (action === 'toggle_mod') {
            if (user.uid !== room.ownerUid) return socket.emit('err', 'Sadece oda sahibi moderatör atayabilir.');
            if (targetUid === room.ownerUid) return socket.emit('err', 'Oda sahibinin yetkisi değiştirilemez.');
            if (room.admins.has(targetUid)) {
                room.admins.delete(targetUid);
                io.to(room.id).emit('msg', room.addMessage('system', null, 'Bir kullanıcının moderatörlüğü alındı.'));
            } else {
                room.admins.add(targetUid);
                io.to(room.id).emit('msg', room.addMessage('system', null, 'Yeni bir moderatör atandı!'));
            }
            io.to(room.id).emit('room_updated', room.snapshot);
            saveRoomToPB(room);
            saveRoomsToFile();
            return;
        }

        // Kural: Oda sahibine müdahale edilemez
        const isTargetOwner = targetUid === room.ownerUid || (targetSocketId && users.get(targetSocketId)?.uid === room.ownerUid);
        if (isTargetOwner && action !== 'delete_room' && action !== 'change_layout') {
            return socket.emit('err', 'Oda sahibine işlem yapılamaz.');
        }

        if (action === 'lock_seat' && seatIndex !== undefined) {
            room.lockedSeats[seatIndex] = !room.lockedSeats[seatIndex];
            // If seat was occupied, kick the user
            if (room.lockedSeats[seatIndex] && room.seats[seatIndex]) {
                room.seats[seatIndex] = null;
            }
            io.to(room.id).emit('room_updated', room.snapshot);
        } else if (action === 'mute' && targetUid) {
            console.log(`[ADMIN] Mute toggle for ${targetUid} in room ${room.id}`);
            if (room.mutedUsers.has(targetUid)) {
                room.mutedUsers.delete(targetUid);
                console.log(`[ADMIN] User ${targetUid} unmuted`);
            } else {
                room.mutedUsers.add(targetUid);
                console.log(`[ADMIN] User ${targetUid} muted`);
                // Force volume 0 in seats immediately
                const sIndex = room.seats.findIndex(s => s?.uid === targetUid);
                if (sIndex !== -1) {
                    room.seats[sIndex].isSpeaking = 0;
                    io.to(room.id).emit('seats_sync', room.seats);
                }
            }
            io.to(room.id).emit('room_updated', room.snapshot);
        } else if (action === 'kick' && targetSocketId) {
            console.log(`[ADMIN] Kick ${targetSocketId} from ${room.id}`);
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('err', 'Odadan atıldınız');
                targetSocket.leave(room.id);
                leaveRoomCompletely(targetSocketId);
            }
        } else if (action === 'block' && targetUid) {
            console.log(`[ADMIN] Block ${targetUid} from ${room.id}`);
            room.blockedUsers.add(targetUid);
            if (targetSocketId) {
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) {
                    targetSocket.emit('err', 'Odadan engellendiniz');
                    targetSocket.leave(room.id);
                    leaveRoomCompletely(targetSocketId);
                }
            }
            io.to(room.id).emit('room_updated', room.snapshot);
        } else if (action === 'unblock' && targetUid) {
            console.log(`[ADMIN] Unblock ${targetUid} from ${room.id}`);
            room.blockedUsers.delete(targetUid);
            socket.emit('msg', room.addMessage('system', null, 'Bir kullanıcının engeli kaldırıldı.'));
            io.to(room.id).emit('room_updated', room.snapshot);

            // Refresh blocked list for the admin
            const list = Array.from(room.blockedUsers).map(uid => {
                const status = moderatorStatus.get(uid);
                return {
                    id: uid,
                    username: status ? status.username : "Engellenmiş Kullanıcı",
                    avatar: status ? status.avatar : ""
                };
            });
            socket.emit('blocked_users_list', list);
        }
    });

    function leaveRoomCompletely(socketId) {
        const user = users.get(socketId);
        if (user && user.currentRoomId) {
            const room = rooms.get(user.currentRoomId);
            if (room) {
                room.viewers.delete(socketId);
                const seatIndex = room.seats.findIndex(s => s?.socketId === socketId);
                if (seatIndex !== -1) room.seats[seatIndex] = null;
                io.to(room.id).emit('seats_sync', room.seats);
                io.to(room.id).emit('room_updated', room.snapshot);
            }
            user.currentRoomId = null;
            io.emit('room_list_update');
        }
    }

    socket.on('request_offer', (data) => {
        if (data.to && users.has(data.to)) {
            io.to(data.to).emit('request_offer', { from: socket.id });
        }
    });

    // ── Direct Messaging (DM) ──
    socket.on('dm_message', (data) => {
        const { receiverId, text } = data; // senderId ve username artık payload'dan güvenilmiyor
        const user = users.get(socket.id);
        if (!user) return;

        console.log(`[DM] from ${user.uid} to ${receiverId}`);

        // Alıcının bağlı olduğu tüm socket'leri bul (Multi-device desteği için)
        // Normalde io.sockets.sockets Map'tir, ancak Capacitor/Socket.io versiyonuna göre array'e çevrilip bakılır.
        const targetSockets = [];
        for (const [sid, s] of io.sockets.sockets.entries()) {
            const u = users.get(sid);
            if (u && u.uid === receiverId) {
                targetSockets.push(s);
            }
        }

        const dmPayload = {
            receiverId,
            text,
            senderId: user.uid,
            username: user.username,
            avatar: user.avatar,
            time: new Date().toISOString()
        };

        targetSockets.forEach(s => {
            s.emit('receive_dm', {
                ...dmPayload,
                me: false
            });
        });

        // OneSignal Push for DM
        sendOneSignalPush(receiverId, user.username || 'LoveMatch', text, { type: 'message', senderId: user.uid });

        // Gönderen tarafına da onayı gönderelim (isteğe bağlı)
        socket.emit('dm_sent_confirmation', { success: true });
    });

    socket.on('send_notification', async (data) => {
        const { toUserId, title, body, data: extraData } = data;
        if (!toUserId) return;

        // Socket üzerinden online ise gönder
        for (const [sid, s] of io.sockets.sockets.entries()) {
            const u = users.get(sid);
            if (u && u.uid === toUserId) {
                s.emit('system_notification', { title, body, data: extraData });
            }
        }

        // OneSignal üzerinden her durumda gönder
        sendOneSignalPush(toUserId, title, body, extraData);
    });

    socket.on('disconnect', () => {
        // 1v1 Temizliği
        matchPool1v1 = matchPool1v1.filter(m => m.socket.id !== socket.id);
        const user1v1Rooms = Array.from(socket.rooms).filter(r => r.startsWith('1v1_'));
        user1v1Rooms.forEach(roomId => {
            socket.to(roomId).emit('partner_left');
        });

        const user = users.get(socket.id);
        if (user) {
            // Son görülme zamanı güncelle
            if (user.uid) {
                const status = moderatorStatus.get(user.uid);
                if (status) {
                    status.isOnline = false;
                    status.lastSeen = Date.now();
                }
            }

            // Tüm odalardan çıkar ve WebRTC peer temizliği için bildir
            rooms.forEach(room => {
                if (room.viewers.has(socket.id)) {
                    room.viewers.delete(socket.id);
                    // Koltuktaysa koltuğu boşalt
                    const seatIndex = room.seats.findIndex(s => s?.socketId === socket.id);
                    if (seatIndex !== -1) {
                        room.seats[seatIndex] = null;
                        io.to(room.id).emit('seats_sync', room.seats);
                    }

                    // WebRTC peer'ları temizlemesi için odadakilere bildir
                    io.to(room.id).emit('user_left_room', socket.id);
                    console.log(`[DISC] ${user.username} ayrıldı: ${room.name}`);
                }
            });

            users.delete(socket.id);
            io.emit('room_list_update');
        }
    });
});

// --- PERİYODİK TEMİZLİK (AFK Odalar) ---
// Her 5 dakikada bir kontrol et
setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        // Global oda silinmez
        if (roomId === 'global') return;

        // Oda kurulalı 10 dakikadan fazla olmuşsa VE kimse yoksa
        const isOldEnough = (now - room.createdAt) > 10 * 60 * 1000;
        const isEmpty = room.viewers.size === 0;

        if (isEmpty && isOldEnough) {
            if (!room.isSleeping) {
                console.log(`[SLEEP] Room entered sleep mode: ${room.name} (${roomId})`);
                room.isSleeping = true;
                io.emit('room_list_update');
            }
        }
    });
}, 5 * 60 * 1000); // 5 dakikada bir çalış

// ─── SPA FALLBACK ───
app.get('*', (req, res) => {
    // console.log(`[DEBUG] Fallback hit for path: ${req.path}`);

    if (req.path.startsWith('/socket.io') || req.path.startsWith('/api') || req.path.startsWith('/rooms') || req.path.startsWith('/admin')) {
        return res.status(404).json({ error: 'Not Found' });
    }

    if (req.path === '/admin-dashboard' || req.path === '/admin-dashboard.html') {
        return res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
    }

    if (path.extname(req.path)) {
        // console.log(`[DEBUG] Asset not found in static: ${req.path}`);
        return res.status(404).send('Not Found');
    }

    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ BACKEND V9 ACTIVE ON PORT ${PORT}`);
});
