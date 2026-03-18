import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

const names = [
    "Merve'nin Sohbet Yuvası 🎀",
    "Selin ile Gece Kahvesi ☕",
    "Ece'nin Müzik Köşesi 🎵",
    "Aslı ile Dertleşelim 🕯️",
    "Melis'in Parti Odası ✨",
    "Ceren ile Dedikodu Time 💅",
    "İrem'in Kitap Kulübü 📚",
    "Zeynep ile Oyun Odası 🎮",
    "Buse'nin Karaoke Sahnesi 🎤",
    "Gizemli Oda 🌙",
    "Ayşe'nin Yemek Tarifleri 🍳",
    "Fatma ile El Emeği 🧶",
    "Hatice'nin Bahçesi 🌸",
    "Emine ile Sabah Şekeri ☀️",
    "Derya'nın Dalış Odası 🌊",
    "Pınar'ın Piknik Alanı 🧺",
    "Deniz ile Mavi Oda 💙",
    "Gül'ün Gül Bahçesi 🌹",
    "Lale'nin Renkli Dünyası 🌈",
    "Bahar Geldi! 🍃"
];

const seedFakeRooms = async () => {
    console.log('Seeding fake rooms...');
    for (const name of names) {
        const id = 'bot_room_' + Math.random().toString(36).slice(2, 9);
        await db.collection('rooms').doc(id).set({
            name: name,
            ownerName: name.split(' ')[0],
            ownerUid: 'bot_user_' + id,
            ownerAvatar: '',
            viewerCount: Math.floor(Math.random() * 50) + 120, // 120-170 viewers
            seatedCount: 8,
            isBot: true,
            isLocked: true, // Belki girilemez olsun diye
            level: 50, // Max level
            maxSeats: 8,
            category: 'Sohbet',
            updated: admin.firestore.FieldValue.serverTimestamp(),
            created: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    console.log('Done!');
};

seedFakeRooms();
