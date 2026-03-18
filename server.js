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

// Fallback all routes to index.html for Single Page Application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[App Hosting] Lovematch Static UI Sunucusu ${PORT} portunda başarıyla çalışıyor!`);
});
