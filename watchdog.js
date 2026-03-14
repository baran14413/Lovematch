/**
 * =====================================================================
 *  LOVEMATCH CLONE — AUTO-RESTART WATCHDOG (watchdog.js)
 *  Tüm servisleri yönetir, çöküünce otomatik yeniden başlatır
 * =====================================================================
 */
import { spawn } from 'child_process';
import { createServer } from 'http';
import { createServer as createNetServer } from 'net';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOG_DIR = join(__dirname, 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

// ==================== RENK YARDIMCILARI ====================
const C = {
    reset: '\x1b[0m', bright: '\x1b[1m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m'
};
const ts = () => new Date().toLocaleTimeString('tr-TR');
const log = (color, tag, msg) => console.log(`${color}${C.bright}[${ts()}] [${tag}]${C.reset} ${msg}`);

function canBindPort(host, port) {
    return new Promise((resolve) => {
        const s = createNetServer();
        s.once('error', (err) => {
            if (err && err.code === 'EADDRINUSE') return resolve(false);
            resolve(true);
        });
        s.listen(port, host, () => {
            s.close(() => resolve(true));
        });
    });
}

async function isHttpOk(url) {
    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 700);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(t);
        return Boolean(res && res.ok);
    } catch (_) {
        return false;
    }
}

// ==================== SERVİS TANIMLARI ====================
const SERVICES = {
    backend: {
        name: 'Backend (Node.js)',
        color: C.green,
        cmd: 'node',
        args: ['server.js'],
        cwd: __dirname,
        healthUrl: 'https://lovemtch.shop/stats',
        restartDelay: 1500,
        maxRestarts: 20,
        enabled: true,
    },
    frontend: {
        name: 'Frontend (Vite)',
        color: C.magenta,
        cmd: 'cmd',
        args: ['/c', 'npx', 'vite', '--host'],
        cwd: __dirname,
        healthUrl: 'https://lovemtch.shop',
        restartDelay: 3000,
        maxRestarts: 10,
        enabled: true,
    },
    caddy: {
        name: 'Caddy (Domain Proxy)',
        color: C.cyan,
        cmd: join(__dirname, 'caddy.exe'),
        args: ['run', '--config', 'Caddyfile'],
        cwd: __dirname,
        healthUrl: 'https://lovemtch.shop',
        restartDelay: 2000,
        maxRestarts: 10,
        enabled: true,
    },
};

// ==================== DURUM TAKİBİ ====================
const state = {};
Object.keys(SERVICES).forEach(key => {
    state[key] = {
        process: null,
        pid: null,
        restartCount: 0,
        lastRestart: 0,
        status: 'stopped',  // stopped | starting | running | crashed
        intentionalStop: false,
    };
});

// ==================== SERVİSİ BAŞLAT ====================
function startService(key) {
    const svc = SERVICES[key];
    const st = state[key];
    if (!svc.enabled) return;

    // Crash-loop koruması: 30sn içinde 5'ten fazla restart → bekle
    const now = Date.now();
    if (st.restartCount > 0 && (now - st.lastRestart) < 30000) {
        const cooldown = Math.min(st.restartCount * 2000, 30000);
        log(C.yellow, 'WATCHDOG', `⏳ ${svc.name} crash-loop koruması — ${cooldown / 1000}sn bekleniyor (restart #${st.restartCount})`);
        setTimeout(() => startService(key), cooldown);
        return;
    }

    st.intentionalStop = false;
    st.status = 'starting';
    st.lastRestart = now;

    log(svc.color, svc.name, `🚀 Başlatılıyor... (Restart #${st.restartCount})`);


    if (key === 'backend') {
        Promise.all([
            canBindPort('127.0.0.1', 3001),
            canBindPort('0.0.0.0', 3001),
            canBindPort('::', 3001),
        ]).then(([a, b, c]) => {
            if (!a || !b || !c) {
                st.status = 'running';
                st.process = null;
                st.pid = null;
                log(C.yellow, svc.name, '⚠️  3001 portu kullanımda. Backend zaten çalışıyor varsayıldı, başlatma atlandı.');
                return;
            }
            spawnServiceProcess(key);
        });
        return;
    }

    if (key === 'frontend') {
        Promise.all([
            canBindPort('127.0.0.1', 5173),
            canBindPort('0.0.0.0', 5173),
            canBindPort('::', 5173),
        ]).then(([a, b, c]) => {
            if (!a || !b || !c) {
                st.status = 'running';
                st.process = null;
                st.pid = null;
                log(C.yellow, svc.name, '⚠️  5173 portu kullanımda. Frontend zaten çalışıyor varsayıldı, başlatma atlandı.');
                return;
            }
            spawnServiceProcess(key);
        });
        return;
    }

    if (key === 'caddy') {
        Promise.all([
            canBindPort('0.0.0.0', 443),
            canBindPort('::', 443),
        ]).then(([a, b]) => {
            if (!a || !b) {
                st.status = 'running';
                st.process = null;
                st.pid = null;
                log(C.yellow, svc.name, '⚠️  443 portu kullanımda. Caddy zaten çalışıyor varsayıldı, başlatma atlandı.');
                return;
            }
            spawnServiceProcess(key);
        });
        return;
    }

    spawnServiceProcess(key);
}

function spawnServiceProcess(key) {
    const svc = SERVICES[key];
    const st = state[key];
    if (!svc || !svc.enabled) return;

    try {
        const proc = spawn(svc.cmd, svc.args, {
            cwd: svc.cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: key === 'frontend',
            windowsHide: true,
        });

        st.process = proc;
        st.pid = proc.pid;
        st.status = 'running';

        proc.stdout?.on('data', d => {
            const line = d.toString().trim();
            if (!line) return;
            if (key === 'caddy' && line.includes('"level":"info"')) return;
            if (key === 'frontend' && (line.includes('[vite] hmr') || line.includes('page reload'))) return;
            log(svc.color, svc.name, line);
        });

        proc.stderr?.on('data', d => {
            const line = d.toString().trim();
            if (!line || line.includes('ExperimentalWarning')) return;
            if (key === 'caddy' && line.includes('"level":"info"')) return;
            log(C.yellow, svc.name + '·ERR', line);
        });

        proc.on('error', err => {
            log(C.red, svc.name, `❌ Spawn hatası: ${err.message}`);
            st.status = 'crashed';
        });

        proc.on('exit', (code, signal) => {
            st.process = null;
            st.pid = null;

            if (st.intentionalStop) {
                st.status = 'stopped';
                log(svc.color, svc.name, '🛑 İstemli olarak durduruldu.');
                return;
            }

            st.status = 'crashed';
            st.restartCount++;

            if (code !== 0 && code !== null) {
                log(C.red, svc.name, `💥 Çöktü! (kod: ${code}, sinyal: ${signal}) → ${svc.restartDelay / 1000}sn sonra yeniden başlatılacak`);
            } else {
                log(C.yellow, svc.name, `🔄 Durdu (kod: ${code}) → Yeniden başlatılıyor...`);
            }

            setTimeout(() => startService(key), svc.restartDelay);
        });

        log(svc.color, svc.name, `✅ Çalışıyor (PID: ${proc.pid})`);
    } catch (err) {
        log(C.red, svc.name, `❌ Başlatma hatası: ${err.message}`);
        st.status = 'crashed';
        st.restartCount++;
        setTimeout(() => startService(key), svc.restartDelay * 2);
    }
}


// ==================== SERVİSİ DURDUR & YENİDEN BAŞLAT ====================
function stopService(key, cb) {
    const svc = SERVICES[key];
    const st = state[key];
    st.intentionalStop = true;
    st.status = 'stopped';

    if (!st.process) { if (cb) cb(); return; }

    log(svc.color, svc.name, '🛑 Durduruluyor...');

    try {
        if (process.platform === 'win32') {
            // Windows'ta child process grubunu kill et
            spawn('taskkill', ['/PID', String(st.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            st.process.kill('SIGTERM');
        }
    } catch (_) { }

    st.process = null;
    st.pid = null;
    if (cb) setTimeout(cb, 1000);
}

function restartService(key) {
    log(C.cyan, 'WATCHDOG', `🔄 ${SERVICES[key].name} yeniden başlatılıyor (admin isteği)...`);
    state[key].restartCount = 0; // Admin restart'ta crash-loop sayacını sıfırla
    stopService(key, () => {
        setTimeout(() => startService(key), 500);
    });
}

// ==================== WATCHDOG HTTP API (port 3099+) ====================
// Admin panel bu API'ye komut gönderir
const watchdogServer = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Content-Type', 'application/json');

    const url = req.url;

    // Durum
    if (url === '/watchdog/status') {
        const status = {};
        Object.keys(SERVICES).forEach(key => {
            status[key] = {
                name: SERVICES[key].name,
                status: state[key].status,
                pid: state[key].pid,
                restartCount: state[key].restartCount,
                enabled: SERVICES[key].enabled,
            };
        });
        return res.end(JSON.stringify({ ok: true, services: status, uptime: process.uptime() }));
    }

    // Restart komutları
    if (req.method === 'POST') {
        if (url === '/watchdog/restart/backend') { restartService('backend'); return res.end(JSON.stringify({ ok: true })); }
        if (url === '/watchdog/restart/all') {
            ['backend', 'frontend', 'caddy'].forEach((k, i) => {
                setTimeout(() => restartService(k), i * 2000);
            });
            return res.end(JSON.stringify({ ok: true, message: 'Fonktsiyonel servisler sırayla yeniden başlatılıyor' }));
        }
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: 'Bilinmeyen komut' }));
});

(async () => {
    const startApi = async (port) => {
        const ok = await canBindPort('127.0.0.1', port);
        if (ok) {
            watchdogServer.listen(port, '127.0.0.1', () => {
                log(C.cyan, 'WATCHDOG', `🛡️  Watchdog API aktif → http://127.0.0.1:${port}`);
            });
            return;
        }
        if (port >= 3109) {
            log(C.red, 'WATCHDOG', '❌ Watchdog API için uygun port bulunamadı (3099-3109)');
            return;
        }
        startApi(port + 1);
    };

    startApi(3099);
})();

// ==================== BAŞLAT ====================
function startAll() {
    console.log(`\n${C.cyan}${C.bright}`);
    console.log(`╔═══════════════════════════════════════════════════╗`);
    console.log(`║      🛡️  LOVEMATCH CLONE — WATCHDOG SİSTEMİ       ║`);
    console.log(`║    Tüm servisler izleniyor, otomatik restart var  ║`);
    console.log(`╚═══════════════════════════════════════════════════╝`);
    console.log(`${C.reset}\n`);

    // Sırayla başlat
    startService('backend');
    setTimeout(() => startService('frontend'), 3000);
    setTimeout(() => startService('caddy'), 5000);
}

// ==================== GÜVENLİ KAPATMA ====================
function shutdown() {
    log(C.yellow, 'WATCHDOG', '🛑 Sistem kapatılıyor...');
    Object.keys(SERVICES).forEach(key => stopService(key));
    setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', err => {
    log(C.red, 'WATCHDOG', `❌ Beklenmedik hata: ${err.message}`);
});

startAll();
