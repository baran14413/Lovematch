const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { Server } = require("socket.io");
const http = require('http');
const fetch = require('node-fetch');
const PocketBase = require('pocketbase/cjs');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// PocketBase Configuration
const PB_URL = 'https://lovemtch.shop';
const pb = new PocketBase(PB_URL);

// OneSignal Configuration
const ONESIGNAL_APP_ID = "dac0906c-e76a-46d4-bf59-4702ddc2cf70";
const ONESIGNAL_REST_API_KEY = "os_v2_app_3laja3hhnjdnjp2zi4bn3qwpocfn5sibyqje2v4lpp5m7ngh3owopcmcmqmpjcc4uc5vfatd5n5ypp2kvbepgnq75z3sihqivdsslfy";

/**
 * Send OneSignal Push Notification
 */
async function sendOneSignalPush(targetUserId, title, body, data = {}) {
    if (!ONESIGNAL_REST_API_KEY) return;
    try {
        await fetch("https://onesignal.com/api/v1/notifications", {
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
    } catch (e) {
        console.error('[OneSignal] Push failed:', e.message);
    }
}

// --- BOOST CONFIGS ---
const BOOST_THRESHOLDS = { 1: 0, 2: 20, 3: 100 };

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
        this.maxSeatCount = Math.min(Math.max(seatCount || 8, 1), 16);
        this.seats = new Array(this.maxSeatCount).fill(null);
        this.lockedSeats = new Array(this.maxSeatCount).fill(false);
        this.admins = new Set([ownerUid]);
        this.mutedUsers = new Set();
        this.blockedUsers = new Set();
        this.messages = [];
        this.createdAt = Date.now();
        this.announcement = "";
        this.slowMode = false;
        this.chatDisabled = false;
        this.backgroundUrl = null;
    }

    addMessage(type, user, content) {
        const msg = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            user: user ? { username: user.username, avatar: user.avatar, uid: user.uid, color: user.color } : null,
            content,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        this.messages.push(msg);
        if (this.messages.length > 50) this.messages.shift();
        return msg;
    }

    updateBoostFromFollowers() {
        const count = this.followers.size;
        const newLevel = calcBoostLevel(count);
        if (newLevel !== this.boostLevel) {
            this.boostLevel = newLevel;
            return true;
        }
        return false;
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
            blockedUsers: Array.from(this.blockedUsers),
            viewerCount: this.viewers.size,
            seatedCount: this.seats.filter(Boolean).length,
            messages: this.messages,
            boostLevel: this.boostLevel,
            maxSeatCount: this.maxSeatCount,
            followerCount: this.followers.size,
            nextBoostAt: this.boostLevel === 1 ? 20 : (this.boostLevel === 2 ? 100 : null),
            announcement: this.announcement,
            slowMode: this.slowMode,
            chatDisabled: this.chatDisabled,
            backgroundUrl: this.backgroundUrl,
            createdAt: this.createdAt
        };
    }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: '/socket.io'
});

const users = new Map();
const rooms = new Map();

io.on("connection", (socket) => {
    socket.on('auth', (data) => {
        users.set(socket.id, { id: socket.id, ...data });
        socket.emit('auth_ok', { socketId: socket.id, ...data });
    });

    socket.on('join_room', async (roomId) => {
        const user = users.get(socket.id);
        if (!user) return;

        let room = rooms.get(roomId);
        if (!room) {
            try {
                const roomDoc = await db.collection('rooms').doc(roomId).get();
                if (roomDoc.exists) {
                    const data = roomDoc.data();
                    room = new Room(roomId, data.name, data.ownerUid, data.ownerName, data.ownerAvatar, data.maxSeatCount);
                    rooms.set(roomId, room);
                } else {
                    return socket.emit('err', 'Oda bulunamadı');
                }
            } catch (e) {
                return socket.emit('err', 'Oda yüklenirken hata oluştu');
            }
        }

        if (room.blockedUsers.has(user.uid)) {
            return socket.emit('err', 'Bu odadan engellendiniz');
        }

        socket.join(roomId);
        user.currentRoomId = roomId;
        room.viewers.set(socket.id, user);

        socket.emit('room_snapshot', room.snapshot);
        socket.to(roomId).emit('user_joined_room', { socketId: socket.id, username: user.username });

        const sysMsg = room.addMessage('system_chat', { username: 'Sistem' }, `${user.username} odaya katıldı 👋`);
        io.to(roomId).emit('msg', sysMsg);
    });

    socket.on('send_msg', (text) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        if (room.chatDisabled && !room.admins.has(user.uid)) {
            return socket.emit('err', 'Bu odada mesaj yazma kapalıdır.');
        }

        const msg = room.addMessage('chat', user, text);

        const mentions = text.match(/@(\w+)/g);
        if (mentions) {
            msg.mentions = mentions.map(m => m.substring(1));
        }

        io.to(room.id).emit('msg', msg);
    });

    socket.on('take_seat', (index) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room || index < 0 || index >= room.maxSeatCount) return;

        if (room.lockedSeats[index] && !room.admins.has(user.uid)) return socket.emit('err', 'Bu koltuk kilitli');
        if (room.seats[index]) return socket.emit('err', 'Koltuk dolu');

        const oldSeatIndex = room.seats.findIndex(s => s?.socketId === socket.id);
        if (oldSeatIndex !== -1) room.seats[oldSeatIndex] = null;

        room.seats[index] = {
            socketId: socket.id,
            uid: user.uid,
            username: user.username,
            avatar: user.avatar,
            color: user.color || '#8b5cf6',
            isSpeaking: 0
        };
        io.to(room.id).emit('seats_sync', room.seats);
    });

    socket.on('leave_seat', () => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        const index = room.seats.findIndex(s => s?.socketId === socket.id);
        if (index !== -1) {
            room.seats[index] = null;
            io.to(room.id).emit('seats_sync', room.seats);
        }
    });

    socket.on('speaking_state', (volume) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room) return;

        if (room.mutedUsers.has(user.uid)) volume = 0;

        const index = room.seats.findIndex(s => s?.socketId === socket.id);
        if (index !== -1) {
            room.seats[index].isSpeaking = volume;
            io.to(room.id).emit('seats_sync', room.seats);
        }
    });

    socket.on('webrtc_signal', (data) => {
        const targetSocket = io.sockets.sockets.get(data.to);
        if (targetSocket) {
            targetSocket.emit('webrtc_signal', { from: socket.id, signal: data.signal, type: data.type });
        }
    });

    socket.on('request_offer', (data) => {
        if (data.to) {
            io.to(data.to).emit('request_offer', { from: socket.id });
        }
    });

    socket.on('follow_room', ({ targetRoomId }) => {
        const user = users.get(socket.id);
        if (!user) return;
        const room = rooms.get(targetRoomId);
        if (!room) return;

        room.followers.set(user.uid, { uid: user.uid, username: user.username, followedAt: Date.now() });
        const boosted = room.updateBoostFromFollowers();

        io.to(room.id).emit('room_updated', room.snapshot);
        if (boosted) io.to(room.id).emit('boost_level_up', { level: room.boostLevel });
    });

    // Admin Panel & Room Controls
    socket.on('update_announcement', (text) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room || !room.admins.has(user.uid)) return;

        room.announcement = text;
        io.to(room.id).emit('announcement_updated', text);
        const sysMsg = room.addMessage('system_chat', { username: 'Sistem' }, `Oda duyurusu güncellendi 📢`);
        io.to(room.id).emit('msg', sysMsg);
    });

    socket.on('update_room_name', (name) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room || !room.admins.has(user.uid)) return;

        room.name = name;
        io.to(room.id).emit('room_updated', room.snapshot);
    });

    socket.on('update_slow_mode', (enabled) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room || !room.admins.has(user.uid)) return;

        room.slowMode = enabled;
        io.to(room.id).emit('room_updated', room.snapshot);
    });

    socket.on('update_chat_disabled', (disabled) => {
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room || !room.admins.has(user.uid)) return;

        room.chatDisabled = disabled;
        io.to(room.id).emit('room_updated', room.snapshot);
    });

    socket.on('admin_action', (data) => {
        const { action, targetUid, targetSocketId, seatIndex } = data;
        const user = users.get(socket.id);
        if (!user || !user.currentRoomId) return;
        const room = rooms.get(user.currentRoomId);
        if (!room || !room.admins.has(user.uid)) return;

        switch (action) {
            case 'lock_seat':
                if (seatIndex !== undefined) {
                    room.lockedSeats[seatIndex] = !room.lockedSeats[seatIndex];
                    if (room.lockedSeats[seatIndex] && room.seats[seatIndex]) room.seats[seatIndex] = null;
                }
                break;
            case 'mute':
                if (targetUid) {
                    if (room.mutedUsers.has(targetUid)) room.mutedUsers.delete(targetUid);
                    else room.mutedUsers.add(targetUid);
                }
                break;
            case 'kick':
                if (targetSocketId) {
                    const targetSocket = io.sockets.sockets.get(targetSocketId);
                    if (targetSocket) {
                        targetSocket.emit('err', 'Odadan atıldınız');
                        targetSocket.leave(room.id);
                    }
                }
                break;
            case 'block':
                if (targetUid) {
                    room.blockedUsers.add(targetUid);
                    if (targetSocketId) {
                        const ts = io.sockets.sockets.get(targetSocketId);
                        if (ts) ts.leave(room.id);
                    }
                }
                break;
            case 'toggle_mod':
                if (targetUid && targetUid !== room.ownerUid) {
                    if (room.admins.has(targetUid)) room.admins.delete(targetUid);
                    else room.admins.add(targetUid);
                }
                break;
            case 'change_layout':
                if (seatIndex !== undefined && [8, 12, 16].includes(seatIndex)) {
                    const newSeats = new Array(seatIndex).fill(null);
                    const newLocked = new Array(seatIndex).fill(false);
                    for (let i = 0; i < Math.min(room.seats.length, seatIndex); i++) {
                        newSeats[i] = room.seats[i];
                        newLocked[i] = room.lockedSeats[i];
                    }
                    room.seats = newSeats;
                    room.lockedSeats = newLocked;
                    room.maxSeatCount = seatIndex;
                }
                break;
        }
        io.to(room.id).emit('room_updated', room.snapshot);
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user && user.currentRoomId) {
            const room = rooms.get(user.currentRoomId);
            if (room) {
                room.viewers.delete(socket.id);
                const seatIndex = room.seats.findIndex(s => s?.socketId === socket.id);
                if (seatIndex !== -1) room.seats[seatIndex] = null;
                io.to(room.id).emit('seats_sync', room.seats);
                io.to(room.id).emit('user_left_room', socket.id);
            }
        }
        users.delete(socket.id);
    });
});

exports.api = functions.https.onRequest(app);
