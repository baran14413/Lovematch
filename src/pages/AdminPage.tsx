/**
 * ═══════════════════════════════════════════════════════════
 *  LOVEMATCH ADMIN DASHBOARD v3.0 — Enterprise Grade
 *  Facebook/Meta seviyesinde tam otonom yönetim paneli
 *  PocketBase giriş, servis durumları, oda/kullanıcı
 *  yönetimi, sistem metrikleri, duyuru sistemi
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { pb } from '../pb';

/* ─── Renkler ─── */
const C = {
    bg: '#04040e', card: 'rgba(12,12,30,0.95)', cardHover: 'rgba(22,22,50,0.98)',
    border: 'rgba(139,92,246,0.12)', borderActive: 'rgba(139,92,246,0.4)',
    purple: '#a78bfa', deepPurple: '#7c3aed', blue: '#60a5fa',
    cyan: '#22d3ee', green: '#34d399', red: '#f87171', yellow: '#fbbf24',
    orange: '#fb923c', pink: '#f472b6',
    t1: '#fff', t2: 'rgba(255,255,255,0.55)', t3: 'rgba(255,255,255,0.25)',
};

/* ─── Admin API yardımcısı ─── */
const apiFetch = async (url: string, opts: any = {}) => {
    const k = sessionStorage.getItem('admin_key') || '';
    return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-key': k, ...(opts.headers || {}) } });
};

/* ─── Zaman formatlayıcı ─── */
const fmtUp = (s: number) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d > 0 ? d + 'g ' : ''}${h}sa ${m}dk`;
};
const fmtDate = (ts: number) => new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ═══ ANIMASYONLU SAYAÇ ═══ */
function AnimCounter({ value, color }: { value: number; color: string }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        const start = display;
        const diff = value - start;
        if (diff === 0) return;
        const steps = 20;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            setDisplay(Math.round(start + (diff * step) / steps));
            if (step >= steps) clearInterval(timer);
        }, 30);
        return () => clearInterval(timer);
    }, [value]);
    return <span style={{ color, fontWeight: 950, fontVariantNumeric: 'tabular-nums' }}>{display.toLocaleString('tr-TR')}</span>;
}

/* ═══ İLERLEME ÇUBUĞU ═══ */
function ProgressBar({ value, max, gradient, height = 8 }: { value: number; max: number; gradient: string; height?: number }) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: height, overflow: 'hidden', height }}>
            <div style={{
                width: `${pct}%`, height: '100%', borderRadius: height,
                background: gradient, transition: 'width 1.2s cubic-bezier(.25,.8,.25,1)',
                boxShadow: `0 0 12px ${gradient.includes(C.red) ? C.red + '55' : C.purple + '44'}`
            }} />
        </div>
    );
}

/* ═══ SERVİS DURUM KARTI ═══ */
function ServiceCard({ name, icon, status, info }: { name: string; icon: string; status: 'ok' | 'error' | 'checking'; info: string }) {
    const colors = { ok: C.green, error: C.red, checking: C.yellow };
    const labels = { ok: 'Aktif', error: 'Hata', checking: 'Kontrol...' };
    return (
        <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
            padding: '16px 18px', flex: 1, minWidth: 140,
            borderLeft: `3px solid ${colors[status]}`, transition: 'all 0.3s',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{ fontWeight: 900, fontSize: 13, color: C.t1 }}>{name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: colors[status], boxShadow: `0 0 8px ${colors[status]}` }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: colors[status] }}>{labels[status]}</span>
            </div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 4, fontWeight: 600 }}>{info}</div>
        </div>
    );
}

/* ═══ STAT KARTI ═══ */
function Stat({ icon, label, value, color, sub }: { icon: string; label: string; value: number | string; color: string; sub?: string }) {
    return (
        <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: '18px 16px', flex: 1, minWidth: 130,
            position: 'relative', overflow: 'hidden'
        }}>
            <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: `radial-gradient(circle, ${color}12 0%, transparent 70%)` }} />
            <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: '-1px' }}>
                {typeof value === 'number' ? <AnimCounter value={value} color={color} /> : <span style={{ color }}>{value}</span>}
            </div>
            <div style={{ fontSize: 11, color: C.t2, fontWeight: 700, marginTop: 2 }}>{label}</div>
            {sub && <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>{sub}</div>}
        </div>
    );
}

/* ═════════════════════════════════════════════════
 *  GİRİŞ EKRANI
 * ═════════════════════════════════════════════════ */
function LoginGate({ onLogin }: { onLogin: () => void }) {
    const [key, setKey] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch('/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
            const d = await res.json();
            if (d.success) { sessionStorage.setItem('admin_key', key); onLogin(); }
            else { setErr('Geçersiz anahtar'); }
        } catch { setErr('Sunucu bağlantı hatası'); }
        finally { setLoading(false); }
    };

    return (
        <div style={{ height: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* Arka plan parçacıkları */}
            {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                    position: 'absolute', width: 200 + i * 80, height: 200 + i * 80, borderRadius: '50%',
                    background: `radial-gradient(circle, ${[C.purple, C.cyan, C.blue, C.pink, C.green, C.orange][i]}08 0%, transparent 70%)`,
                    top: `${10 + i * 12}%`, left: `${5 + i * 15}%`, pointerEvents: 'none',
                    animation: `float${i % 2 === 0 ? 'A' : 'B'} ${10 + i * 3}s infinite ease-in-out`
                }} />
            ))}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 28, padding: '48px 40px', width: 380, textAlign: 'center', backdropFilter: 'blur(40px)', boxShadow: `0 0 100px ${C.purple}15`, position: 'relative', zIndex: 2, animation: 'slideUp 0.5s ease' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🛡️</div>
                <h1 style={{ color: C.t1, fontSize: 24, fontWeight: 950, margin: '0 0 4px', letterSpacing: '-0.5px' }}>LoveMatch Control</h1>
                <p style={{ color: C.t3, fontSize: 12, fontWeight: 700, margin: '0 0 32px' }}>Enterprise Admin Dashboard</p>

                <input type="password" placeholder="Admin Anahtarı" value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                    style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: `1px solid ${err ? C.red : C.border}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 15, fontWeight: 800, outline: 'none', boxSizing: 'border-box', letterSpacing: 4, transition: 'border 0.3s' }} />
                {err && <div style={{ color: C.red, fontSize: 12, fontWeight: 800, marginTop: 8, animation: 'fadeIn 0.3s' }}>❌ {err}</div>}

                <button onClick={submit} disabled={loading || !key}
                    style={{ width: '100%', marginTop: 20, padding: 16, borderRadius: 16, border: 'none', fontWeight: 950, fontSize: 15, background: `linear-gradient(135deg, ${C.deepPurple}, ${C.blue})`, color: '#fff', cursor: 'pointer', opacity: loading || !key ? 0.4 : 1, boxShadow: `0 8px 30px ${C.purple}33`, transition: 'all 0.3s' }}>
                    {loading ? '⏳ Doğrulanıyor...' : '🔓 Giriş Yap'}
                </button>
            </div>
            <style>{`
                @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes floatA { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.05); } }
                @keyframes floatB { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(20px) scale(0.95); } }
            `}</style>
        </div>
    );
}

/* ═════════════════════════════════════════════════
 *  ANA DASHBOARD
 * ═════════════════════════════════════════════════ */
function Dashboard() {
    type Tab = 'overview' | 'rooms' | 'users' | 'broadcast' | 'pocketbase' | 'settings';
    const [tab, setTab] = useState<Tab>('overview');
    const [stats, setStats] = useState<any>(null);
    const [roomsList, setRoomsList] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [pbUsers, setPbUsers] = useState<any[]>([]);
    const [pbTotalUsers, setPbTotalUsers] = useState(0);
    const [pbLoading, setPbLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [roomSearch, setRoomSearch] = useState('');
    const [pbSearch, setPbSearch] = useState('');
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcastSent, setBroadcastSent] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [pbStatus, setPbStatus] = useState<'ok' | 'error' | 'checking'>('checking');
    const [backendStatus, setBackendStatus] = useState<'ok' | 'error' | 'checking'>('checking');
    // PocketBase giriş
    const [pbEmail, setPbEmail] = useState('');
    const [pbPass, setPbPass] = useState('');
    const [pbLoggedIn, setPbLoggedIn] = useState(false);
    const [pbLoginError, setPbLoginError] = useState('');
    // Sistem logları
    const [activityLog, setActivityLog] = useState<string[]>([]);

    const intervalRef = useRef<any>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };
    const addLog = (msg: string) => setActivityLog(prev => [`[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`, ...prev].slice(0, 50));

    /* Veri çekme fonksiyonları */
    const fetchStats = useCallback(async () => {
        try {
            const r = await apiFetch('/admin/stats');
            if (r.ok) { setStats(await r.json()); setBackendStatus('ok'); }
            else setBackendStatus('error');
        } catch { setBackendStatus('error'); }
    }, []);

    const fetchRooms = useCallback(async () => {
        try { const r = await apiFetch('/admin/rooms'); if (r.ok) setRoomsList(await r.json()); } catch { }
    }, []);

    const fetchOnlineUsers = useCallback(async () => {
        try { const r = await apiFetch(`/admin/users?search=${encodeURIComponent(userSearch)}`); if (r.ok) setOnlineUsers(await r.json()); } catch { }
    }, [userSearch]);

    const fetchPbUsers = useCallback(async () => {
        setPbLoading(true);
        try {
            const list = await pb.collection('users').getList(1, 50, { sort: '-created', filter: pbSearch ? `username ~ "${pbSearch}" || name ~ "${pbSearch}" || email ~ "${pbSearch}"` : '' });
            setPbUsers(list.items);
            setPbTotalUsers(list.totalItems);
        } catch { setPbUsers([]); }
        finally { setPbLoading(false); }
    }, [pbSearch]);

    const checkPb = useCallback(async () => {
        try { const r = await fetch('/api/health'); setPbStatus(r.ok ? 'ok' : 'error'); } catch { setPbStatus('error'); }
    }, []);

    /* İlk yükleme + auto refresh */
    useEffect(() => {
        fetchStats(); fetchRooms(); checkPb();
        intervalRef.current = setInterval(() => { fetchStats(); fetchRooms(); }, 5000);
        return () => clearInterval(intervalRef.current);
    }, [fetchStats, fetchRooms, checkPb]);

    useEffect(() => { if (tab === 'users') fetchOnlineUsers(); if (tab === 'pocketbase') { fetchPbUsers(); checkPb(); } }, [tab]);

    /* Manuel yenileme */
    const refresh = async () => { setRefreshing(true); await fetchStats(); await fetchRooms(); if (tab === 'users') await fetchOnlineUsers(); if (tab === 'pocketbase') await fetchPbUsers(); setRefreshing(false); addLog('Veriler yenilendi'); };

    /* Aksiyon fonksiyonları */
    const deleteRoom = async (id: string, name: string) => { if (!confirm(`"${name}" odasını silmek?`)) return; await apiFetch(`/admin/rooms/${id}`, { method: 'DELETE' }); showToast(`🗑️ "${name}" silindi`); addLog(`Oda silindi: ${name}`); fetchRooms(); };
    const kickUser = async (id: string, name: string) => { if (!confirm(`"${name}" atılsın mı?`)) return; await apiFetch(`/admin/users/${id}`, { method: 'DELETE' }); showToast(`⛔ "${name}" atıldı`); addLog(`Kullanıcı atıldı: ${name}`); fetchOnlineUsers(); };
    const sendBroadcast = async () => { if (!broadcastMsg.trim()) return; const r = await apiFetch('/admin/broadcast', { method: 'POST', body: JSON.stringify({ message: broadcastMsg }) }); const d = await r.json(); if (d.success) { setBroadcastSent(true); showToast(`📢 ${d.recipientCount} kişiye gönderildi`); addLog(`Duyuru gönderildi: ${broadcastMsg.slice(0, 50)}...`); setTimeout(() => setBroadcastSent(false), 3000); setBroadcastMsg(''); } };
    const toggleMaint = async () => { const r = await apiFetch('/admin/maintenance', { method: 'POST', body: JSON.stringify({ enabled: !stats?.maintenanceMode }) }); const d = await r.json(); if (d.success) { showToast(d.maintenanceMode ? '🔧 Bakım AÇIK' : '✅ Bakım KAPALI'); addLog(`Bakım modu: ${d.maintenanceMode ? 'AÇILDI' : 'KAPATILDI'}`); fetchStats(); } };
    const updateRole = async (uid: string, role: string) => { try { await pb.collection('users').update(uid, { role }); showToast(`✅ Rol: ${role}`); addLog(`Rol değiştirildi → ${role}`); fetchPbUsers(); } catch { showToast('❌ Rol güncellenemedi'); } };

    /* PocketBase Giriş */
    const pbLogin = async () => {
        try {
            setPbLoginError('');
            await pb.collection('_superusers').authWithPassword(pbEmail, pbPass);
            setPbLoggedIn(true);
            showToast('✅ PocketBase girişi başarılı');
            addLog('PocketBase admin girişi yapıldı');
            fetchPbUsers();
        } catch { setPbLoginError('Giriş başarısız'); }
    };

    const tabs: { id: Tab; icon: string; label: string }[] = [
        { id: 'overview', icon: '📊', label: 'Genel Bakış' },
        { id: 'rooms', icon: '🏠', label: 'Odalar' },
        { id: 'users', icon: '👥', label: 'Çevrimiçi' },
        { id: 'broadcast', icon: '📢', label: 'Duyuru' },
        { id: 'pocketbase', icon: '🗄️', label: 'Veritabanı' },
        { id: 'settings', icon: '⚙️', label: 'Sistem' },
    ];

    const filteredRooms = roomsList.filter(r => !roomSearch || r.name.toLowerCase().includes(roomSearch.toLowerCase()) || r.ownerName.toLowerCase().includes(roomSearch.toLowerCase()));

    return (
        <div style={{ height: '100vh', overflowY: 'auto', background: C.bg, color: C.t1, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 60 }} className="no-scrollbar">

            {/* ═══ HEADER ═══ */}
            <header style={{ padding: '16px 20px 12px', background: 'rgba(4,4,14,0.97)', borderBottom: `1px solid ${C.border}`, backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 14, background: `linear-gradient(135deg, ${C.deepPurple}, ${C.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 15px ${C.purple}33` }}>🛡️</div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 950, letterSpacing: '-0.5px' }}>LoveMatch Admin</h1>
                            <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: backendStatus === 'ok' ? C.green : C.red, boxShadow: `0 0 6px ${backendStatus === 'ok' ? C.green : C.red}` }} />
                                Backend {backendStatus === 'ok' ? 'Aktif' : 'Hata'}
                                <span>•</span>
                                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: pbStatus === 'ok' ? C.green : C.red, boxShadow: `0 0 6px ${pbStatus === 'ok' ? C.green : C.red}` }} />
                                PB {pbStatus === 'ok' ? 'Aktif' : 'Hata'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={refresh} style={{ background: `${C.purple}15`, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: '7px 12px', fontSize: 14, color: C.purple, cursor: 'pointer', transition: 'transform 0.3s', transform: refreshing ? 'rotate(360deg)' : 'none' }}>🔄</button>
                        {stats?.maintenanceMode && <div style={{ background: `${C.yellow}15`, border: `1px solid ${C.yellow}33`, borderRadius: 10, padding: '7px 12px', fontSize: 11, fontWeight: 900, color: C.yellow, animation: 'pulse 2s infinite' }}>🔧 BAKIM</div>}
                        <button onClick={() => { sessionStorage.removeItem('admin_key'); window.location.reload(); }} style={{ background: `${C.red}15`, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '7px 12px', fontSize: 11, fontWeight: 900, color: C.red, cursor: 'pointer' }}>🚪</button>
                    </div>
                </div>

                {/* Tab nav */}
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }} className="no-scrollbar">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: '9px 14px', borderRadius: 12,
                            border: tab === t.id ? `1px solid ${C.purple}88` : '1px solid transparent',
                            background: tab === t.id ? `linear-gradient(135deg, ${C.purple}25, ${C.blue}15)` : 'transparent',
                            color: tab === t.id ? '#fff' : C.t2, fontSize: 12, fontWeight: 800,
                            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s'
                        }}>
                            <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Toast */}
            {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 22px', fontSize: 13, fontWeight: 800, backdropFilter: 'blur(20px)', boxShadow: `0 12px 40px rgba(0,0,0,0.6)`, animation: 'slideUp 0.3s ease' }}>{toast}</div>}

            {/* ═══ 1. GENEL BAKIŞ ═══ */}
            {tab === 'overview' && stats && (
                <div style={{ padding: '20px 16px', animation: 'fadeIn 0.4s' }}>
                    {/* Servis durumları */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        <ServiceCard name="PocketBase" icon="🗄️" status={pbStatus} info="Port 8090 • Veritabanı" />
                        <ServiceCard name="Backend" icon="⚡" status={backendStatus} info="Port 4000 • Socket.IO" />
                        <ServiceCard name="Frontend" icon="🌐" status="ok" info="Port 5173 • Vite React" />
                        <ServiceCard name="Caddy" icon="🔒" status="ok" info="Port 443 • SSL Proxy" />
                    </div>

                    {/* Ana metrikler */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        <Stat icon="🌐" label="Çevrimiçi" value={stats.totalSockets} color={C.green} />
                        <Stat icon="🏠" label="Toplam Oda" value={stats.totalRooms} color={C.purple} sub={`${stats.activeRooms} aktif • ${stats.sleepingRooms} uyuyan`} />
                        <Stat icon="🎙️" label="Seste Olan" value={stats.usersInSeats} color={C.cyan} />
                        <Stat icon="👁️" label="İzleyici" value={stats.totalViewers} color={C.blue} />
                    </div>

                    {/* Sistem bilgileri */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        <Stat icon="⏱️" label="Çalışma Süresi" value={fmtUp(stats.uptime)} color={C.green} />
                        <Stat icon="💾" label="Heap Bellek" value={`${stats.memoryMB} MB`} color={stats.memoryMB > 400 ? C.red : C.cyan} sub={`RSS: ${stats.rssMemoryMB} MB`} />
                        <Stat icon="⚙️" label="Node.js" value={stats.nodeVersion} color={C.t2} sub={`PID: ${stats.pid}`} />
                        <Stat icon="🖥️" label="Platform" value={stats.platform} color={C.t2} />
                    </div>

                    {/* Kapasite barları */}
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontWeight: 900, fontSize: 13 }}>📈 Sunucu Kapasitesi</span>
                            <span style={{ color: C.t3, fontSize: 11, fontWeight: 700 }}>{stats.totalSockets} / {stats.maxCapacity}</span>
                        </div>
                        <ProgressBar value={stats.totalSockets} max={stats.maxCapacity} gradient={stats.totalSockets / stats.maxCapacity > 0.8 ? `linear-gradient(90deg, ${C.red}, ${C.orange})` : `linear-gradient(90deg, ${C.purple}, ${C.cyan})`} />
                    </div>

                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontWeight: 900, fontSize: 13 }}>🎙️ Ses Kapasitesi</span>
                            <span style={{ color: C.t3, fontSize: 11, fontWeight: 700 }}>{stats.usersInSeats} / {stats.maxVoice}</span>
                        </div>
                        <ProgressBar value={stats.usersInSeats} max={stats.maxVoice} gradient={`linear-gradient(90deg, ${C.cyan}, ${C.green})`} />
                    </div>

                    {/* Aktivite Logu */}
                    {activityLog.length > 0 && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
                            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>📋 Son Aktiviteler</div>
                            {activityLog.slice(0, 8).map((log, i) => (
                                <div key={i} style={{ fontSize: 11, color: C.t2, padding: '4px 0', borderBottom: i < 7 ? `1px solid ${C.border}` : 'none', fontWeight: 600 }}>{log}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ 2. ODALAR ═══ */}
            {tab === 'rooms' && (
                <div style={{ padding: '20px 16px', animation: 'fadeIn 0.4s' }}>
                    <input placeholder="🔍 Oda veya sahip ara..." value={roomSearch} onChange={e => setRoomSearch(e.target.value)}
                        style={{ width: '100%', padding: '13px 18px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                    <div style={{ fontSize: 12, color: C.t2, fontWeight: 700, marginBottom: 10 }}>Toplam: {filteredRooms.length} oda</div>

                    {filteredRooms.map(room => (
                        <div key={room.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `3px solid ${room.isSleeping ? C.yellow : C.green}` }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 900, fontSize: 14 }}>{room.name}</span>
                                    {room.isSleeping && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: `${C.yellow}18`, color: C.yellow, fontWeight: 800 }}>💤</span>}
                                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: `${C.purple}18`, color: C.purple, fontWeight: 800 }}>LV{room.boostLevel}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: C.t2, fontWeight: 700, flexWrap: 'wrap' }}>
                                    <span>👤 {room.ownerName}</span><span>👁️ {room.viewerCount}</span><span>🎙️ {room.seatedCount}/{room.maxSeatCount}</span><span>❤️ {room.followerCount}</span><span>💬 {room.messageCount}</span>
                                </div>
                                <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>📅 {fmtDate(room.createdAt)} • {room.id}</div>
                            </div>
                            <button onClick={() => deleteRoom(room.id, room.name)} style={{ background: `${C.red}12`, border: `1px solid ${C.red}25`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: C.red, fontWeight: 800, fontSize: 11, flexShrink: 0 }}>🗑️ Sil</button>
                        </div>
                    ))}
                    {filteredRooms.length === 0 && <div style={{ textAlign: 'center', padding: 50, color: C.t3 }}><div style={{ fontSize: 36 }}>🏠</div><div style={{ fontWeight: 800, marginTop: 8 }}>Oda yok</div></div>}
                </div>
            )}

            {/* ═══ 3. ÇEVRİMİÇİ KULLANICILAR ═══ */}
            {tab === 'users' && (
                <div style={{ padding: '20px 16px', animation: 'fadeIn 0.4s' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <input placeholder="🔍 Kullanıcı ara..." value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchOnlineUsers()}
                            style={{ flex: 1, padding: '13px 18px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                        <button onClick={fetchOnlineUsers} style={{ background: `${C.purple}15`, border: `1px solid ${C.purple}33`, borderRadius: 12, padding: '0 16px', color: C.purple, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>🔄</button>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, fontWeight: 700, marginBottom: 10 }}>🟢 Çevrimiçi: {onlineUsers.length}</div>

                    {onlineUsers.map(u => (
                        <div key={u.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 12, background: u.avatar ? `url(${u.avatar}) center/cover` : `linear-gradient(135deg, ${u.color || C.purple}, ${C.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, border: `2px solid ${C.green}33` }}>{!u.avatar && '👤'}</div>
                                <div><div style={{ fontWeight: 900, fontSize: 13 }}>{u.username}</div><div style={{ fontSize: 10, color: C.t3 }}>{u.id}</div></div>
                            </div>
                            <button onClick={() => kickUser(u.id, u.username)} style={{ background: `${C.red}12`, border: `1px solid ${C.red}25`, borderRadius: 10, padding: '7px 12px', cursor: 'pointer', color: C.red, fontWeight: 800, fontSize: 11 }}>⛔ At</button>
                        </div>
                    ))}
                    {onlineUsers.length === 0 && <div style={{ textAlign: 'center', padding: 50, color: C.t3 }}><div style={{ fontSize: 36 }}>👥</div><div style={{ fontWeight: 800, marginTop: 8 }}>Çevrimiçi kullanıcı yok</div></div>}
                </div>
            )}

            {/* ═══ 4. DUYURU ═══ */}
            {tab === 'broadcast' && (
                <div style={{ padding: '20px 16px', animation: 'fadeIn 0.4s' }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 24 }}>
                        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 950 }}>📢 Sistem Duyurusu</h2>
                        <p style={{ color: C.t2, fontSize: 12, fontWeight: 600, margin: '0 0 18px' }}>Tüm çevrimiçi kullanıcılara anlık bildirim</p>
                        <textarea placeholder="Duyuru mesajınız..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={4}
                            style={{ width: '100%', padding: 14, borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        <button onClick={sendBroadcast} disabled={!broadcastMsg.trim()}
                            style={{ width: '100%', marginTop: 14, padding: 14, borderRadius: 14, border: 'none', fontWeight: 950, fontSize: 14, background: broadcastSent ? `linear-gradient(135deg, ${C.green}, ${C.cyan})` : `linear-gradient(135deg, ${C.deepPurple}, ${C.blue})`, color: '#fff', cursor: 'pointer', opacity: !broadcastMsg.trim() ? 0.3 : 1, boxShadow: `0 8px 25px ${C.purple}25`, transition: 'all 0.3s' }}>
                            {broadcastSent ? '✅ Gönderildi!' : '📣 Herkese Gönder'}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ 5. VERİTABANI (POCKETBASE) ═══ */}
            {tab === 'pocketbase' && (
                <div style={{ padding: '20px 16px', animation: 'fadeIn 0.4s' }}>
                    {/* PB bağlantı durumu */}
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 50, height: 50, borderRadius: 16, background: pbStatus === 'ok' ? `${C.green}15` : `${C.red}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: `2px solid ${pbStatus === 'ok' ? C.green : C.red}33` }}>
                            {pbStatus === 'ok' ? '🟢' : '🔴'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 950, fontSize: 15 }}>PocketBase v0.36.5</div>
                            <div style={{ color: pbStatus === 'ok' ? C.green : C.red, fontWeight: 800, fontSize: 12 }}>
                                {pbStatus === 'ok' ? 'Çalışıyor • Port 8090' : 'Bağlantı Hatası'}
                            </div>
                        </div>
                        <a href="/_/" target="_blank" rel="noopener noreferrer" style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}33`, borderRadius: 10, padding: '8px 14px', color: C.blue, fontWeight: 800, fontSize: 11, textDecoration: 'none' }}>🌐 PB Panel</a>
                    </div>

                    {/* PocketBase giriş formu */}
                    {!pbLoggedIn && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginBottom: 14 }}>
                            <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 12 }}>🔐 PocketBase Admin Girişi</div>
                            <input type="email" placeholder="E-posta" value={pbEmail} onChange={e => setPbEmail(e.target.value)}
                                style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                            <input type="password" placeholder="Şifre" value={pbPass} onChange={e => setPbPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && pbLogin()}
                                style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                            {pbLoginError && <div style={{ color: C.red, fontSize: 11, fontWeight: 800, marginBottom: 8 }}>❌ {pbLoginError}</div>}
                            <button onClick={pbLogin} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', fontWeight: 900, fontSize: 13, background: `linear-gradient(135deg, ${C.deepPurple}, ${C.blue})`, color: '#fff', cursor: 'pointer' }}>🔓 PB'ye Giriş Yap</button>
                        </div>
                    )}

                    {pbLoggedIn && <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}25`, borderRadius: 14, padding: '10px 16px', marginBottom: 14, fontSize: 12, fontWeight: 800, color: C.green }}>✅ PocketBase'e bağlandı • Veritabanı yönetimi aktif</div>}

                    {/* PB user arama */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <input placeholder="🔍 Veritabanında kullanıcı ara..." value={pbSearch} onChange={e => setPbSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPbUsers()}
                            style={{ flex: 1, padding: '13px 18px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                        <button onClick={fetchPbUsers} style={{ background: `${C.cyan}15`, border: `1px solid ${C.cyan}33`, borderRadius: 12, padding: '0 16px', color: C.cyan, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>🔄</button>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, fontWeight: 700, marginBottom: 10 }}>🗄️ Toplam Kayıtlı: {pbTotalUsers} • Gösterilen: {pbUsers.length}</div>

                    {pbLoading ? <div style={{ textAlign: 'center', padding: 40, color: C.t3 }}>⏳ Yükleniyor...</div> : (
                        pbUsers.map(u => (
                            <div key={u.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: u.avatar ? `url(${pb.files.getUrl(u, u.avatar, { thumb: '100x100' })}) center/cover` : `linear-gradient(135deg, ${C.purple}, ${C.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{!u.avatar && '👤'}</div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.username}</span>
                                            {u.role === 'admin' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: `${C.red}18`, color: C.red, fontWeight: 800 }}>👑</span>}
                                            {u.role === 'moderator' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: `${C.yellow}18`, color: C.yellow, fontWeight: 800 }}>🛡️</span>}
                                        </div>
                                        <div style={{ fontSize: 10, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.username} • {u.email}</div>
                                        <div style={{ fontSize: 10, color: C.t3 }}>💰 {u.coins || 0} • LVL {u.level || 1}</div>
                                    </div>
                                </div>
                                <select value={u.role || 'user'} onChange={e => updateRole(u.id, e.target.value)}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                                    <option value="user" style={{ background: '#111' }}>👤 User</option>
                                    <option value="moderator" style={{ background: '#111' }}>🛡️ Mod</option>
                                    <option value="admin" style={{ background: '#111' }}>👑 Admin</option>
                                </select>
                            </div>
                        ))
                    )}
                    {!pbLoading && pbUsers.length === 0 && <div style={{ textAlign: 'center', padding: 50, color: C.t3 }}><div style={{ fontSize: 36 }}>🗄️</div><div style={{ fontWeight: 800, marginTop: 8 }}>Kullanıcı bulunamadı</div></div>}
                </div>
            )}

            {/* ═══ 6. SİSTEM AYARLARI ═══ */}
            {tab === 'settings' && (
                <div style={{ padding: '20px 16px', animation: 'fadeIn 0.4s' }}>
                    {/* Bakım modu kartı */}
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 950, fontSize: 15 }}>🔧 Bakım Modu</div>
                                <div style={{ color: C.t2, fontSize: 12, fontWeight: 600, marginTop: 2 }}>Aktifken kullanıcılara bakım mesajı gider</div>
                            </div>
                            <button onClick={toggleMaint} style={{
                                background: stats?.maintenanceMode ? `${C.green}15` : `${C.yellow}15`,
                                border: `1px solid ${stats?.maintenanceMode ? C.green : C.yellow}33`,
                                borderRadius: 12, padding: '10px 18px', fontWeight: 900, fontSize: 12,
                                color: stats?.maintenanceMode ? C.green : C.yellow, cursor: 'pointer', transition: 'all 0.3s'
                            }}>
                                {stats?.maintenanceMode ? '✅ Bakımı Kapat' : '🔧 Bakıma Al'}
                            </button>
                        </div>
                    </div>

                    {/* Sistem bilgi kartları */}
                    {stats && (
                        <>
                            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, marginBottom: 14 }}>
                                <div style={{ fontWeight: 950, fontSize: 15, marginBottom: 14 }}>🖥️ Sunucu Detayları</div>
                                {[
                                    { l: 'Node.js Sürümü', v: stats.nodeVersion },
                                    { l: 'Platform', v: stats.platform },
                                    { l: 'Process ID', v: stats.pid },
                                    { l: 'Çalışma Süresi', v: fmtUp(stats.uptime) },
                                    { l: 'Heap Bellek', v: `${stats.memoryMB} MB` },
                                    { l: 'RSS Bellek', v: `${stats.rssMemoryMB} MB` },
                                    { l: 'Maks Kapasite', v: `${stats.maxCapacity} kullanıcı` },
                                    { l: 'Maks Ses', v: `${stats.maxVoice} koltuk` },
                                    { l: 'Admin Anahtar', v: '••••••••••' },
                                    { l: 'PocketBase', v: 'v0.36.5' },
                                    { l: 'Caddy', v: 'v2.10.2' },
                                    { l: 'Domain', v: 'lovemtch.shop' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                                        <span style={{ color: C.t2, fontSize: 12, fontWeight: 700 }}>{item.l}</span>
                                        <span style={{ color: C.t1, fontSize: 12, fontWeight: 800, fontFamily: 'monospace' }}>{item.v}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 }}>
                                <div style={{ fontWeight: 950, fontSize: 15, marginBottom: 14 }}>📋 Aktivite Logu</div>
                                {activityLog.length === 0 ? (
                                    <div style={{ color: C.t3, fontSize: 12, fontWeight: 600 }}>Henüz aktivite yok. Panel kullanıldıkça loglar burada görünecek.</div>
                                ) : activityLog.map((log, i) => (
                                    <div key={i} style={{ fontSize: 11, color: C.t2, padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontFamily: 'monospace' }}>{log}</div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Global CSS */}
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                select option { background: #111; color: #fff; }
            `}</style>
        </div>
    );
}

/* ═════════════════════════════════════════════════
 *  EXPORT — Login kapısı ile korumalı
 * ═════════════════════════════════════════════════ */
export default function AdminPage() {
    const [auth, setAuth] = useState(false);

    useEffect(() => {
        const k = sessionStorage.getItem('admin_key');
        if (k) {
            fetch('/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) })
                .then(r => r.json()).then(d => { if (d.success) setAuth(true); else sessionStorage.removeItem('admin_key'); })
                .catch(() => sessionStorage.removeItem('admin_key'));
        }
    }, []);

    if (!auth) return <LoginGate onLogin={() => setAuth(true)} />;
    return <Dashboard />;
}
