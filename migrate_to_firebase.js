/**
 * =========================================================================
 *  LOVEMATCH - A'DAN Z'YE FIREBASE TAŞIMA SCRIPT (VDS SÜRÜMÜ)
 *  PocketBase -> Firestore Göçü
 * =========================================================================
 */

const admin = require('firebase-admin');
const PocketBase = require('pocketbase/cjs');

// Initialize Firebase Admin (Using project defaults)
admin.initializeApp({
    projectId: 'lovematch-67f1d'
});
const db = admin.firestore();
const auth = admin.auth();

// PocketBase Configuration
const PB_URL = 'http://127.0.0.1:8090'; // Local access on VDS
const pb = new PocketBase(PB_URL);

async function migrate() {
    console.log("🚀 Göç işlemi başlatılıyor...");

    try {
        await pb.admins.authWithPassword('admin@lovematch.com', 'lovematchadmin123');
        console.log("✅ PocketBase admin girişi başarılı.");
    } catch (e) {
        console.error("❌ PocketBase girişi başarısız! Lütfen şifreyi kontrol edin.");
        return;
    }

    // 1. KULLANICILARI TAŞI
    console.log("\n--- 👥 Kullanıcılar Taşınıyor ---");
    try {
        const users = await pb.collection('users').getFullList();
        for (const u of users) {
            console.log(`> İşleniyor: ${u.username} (${u.email})`);

            // Firebase Auth'ta kullanıcı var mı?
            let firebaseUser;
            try {
                firebaseUser = await auth.getUserByEmail(u.email);
            } catch (e) {
                // Yoksa oluştur (Şifreler PB'den ham alınamadığı için geçici şifre veriyoruz)
                firebaseUser = await auth.createUser({
                    uid: u.id, // ID uyumluluğu için aynısını kullanıyoruz
                    email: u.email,
                    displayName: u.username || u.name,
                    password: 'LoveMatch123!', // Geçici şifre (Kullanıcı sıfırlamalı)
                });
            }

            // Firestore user profilini kaydet/güncelle
            await db.collection('users').doc(u.id).set({
                uid: u.id,
                username: u.username || u.name,
                email: u.email,
                avatar: u.avatar ? `${PB_URL}/api/files/users/${u.id}/${u.avatar}` : null,
                coins: u.coins || 0,
                level: u.level || 1,
                bio: u.bio || '',
                isVIP: u.isVIP || false,
                color: u.color || '#8b5cf6',
                bubbleStyle: u.bubbleStyle || 'classic',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    } catch (e) {
        console.error("[-] Kullanıcı göçü hatası:", e.message);
    }

    // 2. ODALARI TAŞI
    console.log("\n--- 🎙️ Odalar Taşınıyor ---");
    try {
        const rooms = await pb.collection('rooms').getFullList();
        for (const r of rooms) {
            console.log(`> Oda: ${r.name}`);
            await db.collection('rooms').doc(r.id).set({
                id: r.id,
                name: r.name,
                ownerUid: r.ownerUid || r.owner,
                ownerName: r.ownerName,
                ownerAvatar: r.ownerAvatar,
                maxSeatCount: r.maxSeatCount || 8,
                announcement: r.announcement || "",
                backgroundUrl: r.background ? `${PB_URL}/api/files/rooms/${r.id}/${r.background}` : null,
                createdAt: r.created ? new Date(r.created) : admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (e) {
        console.error("[-] Oda göçü hatası:", e.message);
    }

    // 3. POSTLARI TAŞI
    console.log("\n--- 📮 Postlar Taşınıyor ---");
    try {
        const posts = await pb.collection('posts').getFullList();
        for (const p of posts) {
            console.log(`> Post: ${p.id} (Yazar: ${p.author})`);
            await db.collection('posts').doc(p.id).set({
                author: p.author,
                content: p.content,
                likes: p.likes || [],
                comments: p.comments || [],
                imageUrl: p.image ? `${PB_URL}/api/files/posts/${p.id}/${p.image}` : null,
                createdAt: p.created ? new Date(p.created) : admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (e) {
        console.error("[-] Post göçü hatası:", e.message);
    }

    console.log("\n✅ Göç işlemi tamamlandı!");
}

migrate();
