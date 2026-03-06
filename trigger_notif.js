async function sendBroadcast() {
    try {
        const response = await fetch('https://lovemtch.shop/admin/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "✨ Yeni Sürüm (Build 21) Hazır! VIP senkronizasyon ve fiyat sorunları giderildi. Lütfen uygulamayı yenileyin."
            })
        });
        const data = await response.json();
        console.log('Broadcast Sent:', data);
    } catch (e) {
        console.error('Failed to send broadcast:', e);
    }
}
sendBroadcast();
