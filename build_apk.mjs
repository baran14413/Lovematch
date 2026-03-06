import fs from 'fs';

async function buildApk() {
    console.log("🚀 PWABuilder API üzerinden Lovematch Clone APK Build işlemi başlatılıyor...");
    console.log("İstenilen Link: https://213.142.134.191:5173/");

    const payload = {
        "url": "https://lovemtch.shop/",
        "manifestUrl": "https://lovemtch.shop/manifest.json",
        "manifest": {
            "name": "LoveMatch",
            "short_name": "LoveMatch",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#06041a",
            "theme_color": "#7c4dff",
            "orientation": "portrait",
            "icons": [
                {
                    "src": "assets/icons/icon-192x192.png",
                    "type": "image/png",
                    "sizes": "192x192"
                },
                {
                    "src": "assets/icons/icon-512x512.png",
                    "type": "image/png",
                    "sizes": "512x512"
                }
            ]
        },
        "options": {
            "packageId": "com.lovmatch.app",
            "appName": "LoveMatch",
            "launcherName": "LoveMatch",
            "themeColor": "#7c4dff",
            "navigationColor": "#06041a",
            "navigationColorDark": "#06041a",
            "navigationDividerColor": "#06041a",
            "navigationDividerColorDark": "#06041a",
            "backgroundColor": "#06041a",
            "enableNotifications": true,
            "enablePlayBilling": true,
            "splashScreenFadeOutDuration": 300,
            "host": "lovemtch.shop",
            "name": "LoveMatch",
            "short_name": "LoveMatch",
            "url": "https://lovemtch.shop/"
        }
    };

    try {
        console.log("📦 Paket oluşturuluyor... (Bu işlem ~30 saniye sürebilir)");
        const response = await fetch("https://pwabuilder-android.azurewebsites.net/api/generateAppPackage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/zip"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("❌ Sunucu hatası:", response.status, response.statusText);
            const text = await response.text();
            console.error(text);
            return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const zipPath = "C:\\Users\\Administrator\\Desktop\\Lovematch_App.zip";
        fs.writeFileSync(zipPath, buffer);
        console.log(`✅ İşlem Başarılı! APK Dosyanız indirildi.`);
        console.log(`📂 Konum: ${zipPath}`);
        console.log(`(İçindeki "app-release.apk" dosyasını telefonunuza yükleyebilirsiniz!)`);

    } catch (err) {
        console.error("❌ Hata oluştu:", err);
    }
}

buildApk();
