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
        await pb.collection('_superusers').authWithPassword('temp_admin@lovematch.com', 'admin123456');
        console.log("✅ PocketBase admin girişi başarılı.");
    } catch (e) {
        console.error("❌ PocketBase girişi başarısız! Hata:", e.message);
        return;
    }

    // 1. KULLANICILARI TAŞI
    console.log("\n--- 👥 Kullanıcılar Taşınıyor ---");
    try {
        const users = await pb.collection('users').getFullList();
        for (const u of users) {
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
                followers: u.followers || [],
                following: u.following || [],
                created: u.created || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`✅ ${u.username} taşındı.`);
        }
    } catch (e) {
        console.error("[-] Kullanıcı göçü hatası:", e.message);
    }
    // ... (Oda ve Post taşıma kısımları aynen kalabilir veya benzeri eklenebilir)

    // 2. ODALARI TAŞI
    console.log("\n--- 🎙️ Odalar Taşınıyor ---");
    try {
        const rooms = await pb.collection('rooms').getFullList();
        for (const r of rooms) {
            await db.collection('rooms').doc(r.id).set({
                id: r.id,
                name: r.name,
                ownerUid: r.ownerUid || r.owner,
                ownerName: r.ownerName,
                ownerAvatar: r.ownerAvatar,
                maxSeatCount: r.maxSeatCount || 8,
                announcement: r.announcement || "",
                backgroundUrl: r.background ? `${PB_URL}/api/files/rooms/${r.id}/${r.background}` : null,
                isPrivate: r.isPrivate || false,
                created: r.created || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`✅ Oda ${r.name} taşındı.`);
        }
    } catch (e) {
        console.error("[-] Oda göçü hatası:", e.message);
    }

    // 3. POSTLARI TAŞI
    console.log("\n--- 📮 Postlar Taşınıyor ---");
    try {
        const posts = await pb.collection('posts').getFullList();
        for (const p of posts) {
            await db.collection('posts').doc(p.id).set({
                author: p.author,
                content: p.content,
                likes: p.likes || [],
                comments: p.comments || [],
                imageUrl: p.image ? `${PB_URL}/api/files/posts/${p.id}/${p.image}` : null,
                created: p.created || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`✅ Post ${p.id} taşındı.`);
        }
    } catch (e) {
        console.error("[-] Post göçü hatası:", e.message);
    }

    console.log("\n✅ Göç işlemi tamamlandı!");
}

migrate();
