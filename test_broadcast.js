import http from 'http';

const data = JSON.stringify({
    message: "VIP Sistemi ve Bildirimler Güncellendi! 💎 Lütfen uygulamayı yenileyin."
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/admin/broadcast',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
