import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const ADMIN_KEY = "Gunahbenim09"; // User requested key
    if (key === ADMIN_KEY) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Geçersiz anahtar' });
    }
});

// Admin Stats Mock (To prevent dashboard from crashing)
app.get('/admin/stats', (req, res) => {
    res.json({
        success: true,
        totalSockets: 1,
        totalRooms: 0,
        activeRooms: 0,
        sleepingRooms: 0,
        usersInSeats: 0,
        totalViewers: 0,
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
        pid: process.pid,
        platform: process.platform,
        maxCapacity: 1000,
        maxVoice: 100
    });
});

// Fallback all routes to index.html for Single Page Application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[App Hosting] Lovematch Static UI Sunucusu ${PORT} portunda başarıyla çalışıyor!`);
});
