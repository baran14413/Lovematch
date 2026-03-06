import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function secureDatabase() {
    try {
        await pb.admins.authWithPassword('admin@lovematch.com', 'lovematchadmin123');
        console.log("Admin authenticated.");
    } catch (e) {
        console.error("Admin auth failed. PocketBase kapalı veya şifre yanlış.", e.message);
        return;
    }

    try {
        console.log("1. Users tablosu güvenliği kilitleniyor...");
        const usersCol = await pb.collections.getOne('users');

        // Kimse herkesi listeleyemesin (sadece kendini veya arama ile birini görebilir - daha sonra arama kuralı eklenebilir. Şimdilik list kuralını @request.auth.id != "" yapıyoruz)
        usersCol.listRule = "@request.auth.id != ''";
        usersCol.viewRule = "@request.auth.id != ''";
        // Kimse başkasının profilini güncelleyemesin veya silemesin
        usersCol.updateRule = "id = @request.auth.id";
        usersCol.deleteRule = "id = @request.auth.id";

        await pb.collections.update('users', usersCol);
        console.log("✅ Users tablosu kilitlendi!");

        console.log("2. Messages/Rooms var ise kontrol ediliyor...");
        try {
            const chatCol = await pb.collections.getOne('messages');
            chatCol.listRule = "@request.auth.id != ''";
            chatCol.viewRule = "@request.auth.id != ''";
            chatCol.createRule = "@request.auth.id != ''";
            chatCol.updateRule = "sender = @request.auth.id";
            chatCol.deleteRule = "sender = @request.auth.id";
            await pb.collections.update('messages', chatCol);
            console.log("✅ Messages tablosu kilitlendi!");
        } catch (e) {
            console.log("ℹ️ Messages tablosu bulunamadı, atlanıyor.");
        }

        console.log("\n🔐 GÜVENLİK GÜNCELLEMESİ BAŞARILI!");
        console.log("Mevcut durumda kimse başkasının hesabını dışarıdan silemez veya çalamaz.");

    } catch (e) {
        console.error("Hata oluştu:", e.message || e);
    }
}

secureDatabase();
