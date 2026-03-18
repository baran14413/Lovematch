import { useState, useEffect, useRef, useCallback } from 'react';
// OneSignal sadece Capacitor/Native ortamda çalışır, web'de import edilirse çöküyor!
// Bu yüzden window.Capacitor varlığına göre runtime'da kontrol ediyoruz
// @ts-ignore - OneSignal native plugin, web'de mevcut olmayabilir, runtime kontrolü var
let OneSignal: any = null;
// Güvenli init: sadece native Capacitor ortamında yükle
(async () => {
    try {
        if (typeof window !== 'undefined' && 'Capacitor' in window && (window as any).Capacitor.getPlatform() !== 'web') {
            const mod = await import('onesignal-cordova-plugin');
            OneSignal = mod.default;
        }
    } catch (e) {
        console.warn('[OneSignal] Native plugin web ortamında mevcut değil (normal)');
    }
})();
import { SocketProvider, useSocket } from './context/SocketContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import {
    BrowserRouter,
    Routes,
    Route,
    NavLink,
    Navigate,
    useNavigate,
    useLocation,
    useParams
} from 'react-router-dom';
import './index.css';
import './lovematch.css';
import { pb } from './pb';
import { tGlobal } from './utils/languages';

import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import OneVsOneMatchPage from './pages/OneVsOneMatchPage';
import PrivacyPage from './pages/PrivacyPage';
import { NotificationService } from './utils/notifications';
import { StoreService } from './utils/store';
import { PartyRoomPage, PartyRoomInner } from './pages/PartyRoomPage';
import { HelpPage } from './pages/HelpPage';
import AdminPage from './pages/AdminPage';

const CURRENT_BUILD = 27;

// ─── Premium Splash Screen ───────────────────────────────
const Splash = ({ onDone }: { onDone: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onDone, 2000);
        return () => clearTimeout(timer);
    }, [onDone]);

    const stars = Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${(i * 23) % 100}%`,
        size: 1 + (i % 3),
        delay: `${(i % 6) * 0.6}s`,
        duration: `${4 + (i % 5)}s`,
        opacity: 0.3 + (i % 4) * 0.15
    }));

    const { language } = useLanguage();

    return (
        <div className="splash-v2">
            <div className="splash-stars">
                {stars.map(star => (
                    <span
                        key={star.id}
                        style={{
                            left: star.left,
                            top: star.top,
                            width: star.size,
                            height: star.size,
                            opacity: star.opacity,
                            animationDelay: star.delay,
                            animationDuration: star.duration
                        }}
                    />
                ))}
            </div>

            <div className="splash-center">
                <div className="splash-sub" style={{ fontSize: 18, letterSpacing: 2 }}>{language === 'tr' ? 'Kalbinin Sesini Dinle' : 'Listen to Your Heart'}</div>
            </div>

            <div className="splash-progress">
                <div className="love-loader"><div></div><div></div><div></div><div></div></div>
                <div className="splash-loading-text">{language === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
                <div className="splash-studio">BeStudio</div>
            </div>

            <style>{`
                .splash-v2 {
                    height: 100vh;
                    width: 100%;
                    background: #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    color: #fff;
                }

                .splash-stars {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                }

                .splash-stars span {
                    position: absolute;
                    background: #fff;
                    border-radius: 999px;
                    animation: twinkle 6s ease-in-out infinite;
                }

                .splash-center {
                    position: relative;
                    z-index: 5;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }

                .splash-logo-wrap {
                    position: relative;
                    width: 96px;
                    height: 96px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 20px;
                }

                .splash-logo-core {
                    width: 88px;
                    height: 88px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 60px;
                    color: var(--lovematch-purple);
                    animation: heartBeat 1.3s ease-in-out infinite;
                }

                .splash-title {
                    font-size: 32px;
                    font-weight: 900;
                    margin: 0;
                    letter-spacing: -1px;
                    background: linear-gradient(to right, #fff, #a78bfa);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .splash-sub {
                    margin-top: 8px;
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.5);
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }

                .splash-progress {
                    position: absolute;
                    bottom: 60px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }

                .splash-loading-text {
                    color: rgba(255, 255, 255, 0.3);
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 1.5px;
                }

                .splash-studio {
                    margin-top: 4px;
                    color: rgba(255, 255, 255, 0.2);
                    font-size: 10px;
                    font-weight: 900;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                }

                @keyframes heartBeat {
                    0% { transform: scale(1); }
                    14% { transform: scale(1.3); }
                    28% { transform: scale(1); }
                    42% { transform: scale(1.3); }
                    70% { transform: scale(1); }
                }

                @keyframes twinkle {
                    0%, 100% { transform: scale(1); opacity: 0.4; }
                    50% { transform: scale(1.6); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

// ─── Native UI Helpers ───
const setImmersiveMode = () => {
    // Hide navigation and status bar via common web methods for standalone apps
    try {
        if ('Capacitor' in window) {
            // @ts-ignore
            window.Capacitor.Plugins.StatusBar?.hide();
            // @ts-ignore
            window.Capacitor.Plugins.NavigationBar?.hide();
        }
    } catch (e) {
        console.warn('Native UI hide failed', e);
    }
};


// ─── Bottom Nav ──────────────────────────────────────────
function BottomNav({ hide }: { hide?: boolean }) {
    if (hide) return null;
    const { t } = useLanguage();
    const location = useLocation();
    const path = location.pathname;

    if (path.startsWith('/chat') || path.startsWith('/party') || path === '/soul' || path === '/1v1-match' || path === '/admin') return null;


    return (
        <div className="bottom-nav-v2-container">
            <div className="bottom-nav-v2">
                {[
                    { to: '/home', icon: 'fa-house', label: t('home') || 'Keşfet' },
                    { to: '/party', icon: 'fa-comments', label: t('party') || 'Parti' },
                    { to: '/chat', icon: 'fa-message', label: t('chat') || 'Sohbet' },
                    { to: '/profile', icon: 'fa-user', label: t('profile') || 'Profil' }
                ].map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `nav-item-v2 ${isActive ? 'active' : ''}`}
                    >
                        {({ isActive }) => (
                            <>
                                <div className="nav-icon-wrapper">
                                    <i className={`fa-solid ${item.icon}`}></i>
                                    {isActive && <div className="active-glow"></div>}
                                </div>
                                <span className="nav-label-v2">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>

            <style>{`
                .app-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    overflow: hidden;
                    padding-bottom: 60px; /* Alttaki barın yüksekliği kadar boşluk */
                }
                .bottom-nav-v2-container {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: center;
                    z-index: 2000;
                    background: #0f1115;
                    border-top: 1px solid rgba(255,255,255,0.08);
                }
                .bottom-nav-v2 {
                    width: 100%;
                    max-width: 500px;
                    height: 60px;
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    padding: 0 10px;
                }
                .nav-item-v2 {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    color: rgba(255,255,255,0.4);
                    transition: all 0.2s;
                    flex: 1;
                    height: 100%;
                }
                .nav-item-v2.active {
                    color: #fff;
                }
                .nav-icon-wrapper {
                    position: relative;
                    margin-bottom: 3px;
                }
                .nav-item-v2 i {
                    font-size: 20px;
                }
                .nav-item-v2.active i {
                    color: #a78bfa;
                }
                .nav-label-v2 {
                    font-size: 10px;
                    font-weight: 700;
                }
                @media (max-width: 360px) {
                    .bottom-nav-v2 { height: 55px; }
                    .nav-item-v2 i { font-size: 18px; }
                }
            `}</style>
        </div>
    );
}

// ─── Join Room Redirect Handler ──────────────────────────
function JoinRoomRedirect() {
    const { roomId } = useParams();
    useEffect(() => {
        // App ID: com.lovmatch.app
        const storeUrl = `https://play.google.com/store/apps/details?id=com.lovmatch.app&referrer=${roomId}`;

        // Try to open app via custom scheme first (if app supports it)
        window.location.href = `lovmatch://join-room/${roomId}`;

        // If app doesn't open in 1.5s, go to store
        const timer = setTimeout(() => {
            window.location.href = storeUrl;
        }, 1500);

        return () => clearTimeout(timer);
    }, [roomId]);

    const { language } = useLanguage();

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 20 }}>🎙️</div>
                <div style={{ fontWeight: 800 }}>{language === 'tr' ? 'Odaya Yönlendiriliyorsunuz...' : 'Redirecting to Room...'}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 10 }}>{language === 'tr' ? "Uygulama açılmazsa Play Store'a gideceksiniz." : "Redirecting to Play Store if app doesn't open."}</div>
            </div>
        </div>
    );
}

// ─── App Layout ──────────────────────────────────────────
function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;
    const isParty = path === '/party';

    const [activePartyRoom, setActivePartyRoom] = useState<{ id: string; name: string; icon?: string } | null>(null);
    const [floatPos, setFloatPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 150 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [globalToast, setGlobalToast] = useState<{ title: string, body: string, data?: any } | null>(null);

    const handleBack = useCallback(() => {
        navigate('/home');
    }, [navigate]);

    const handleLeave = useCallback(() => {
        setActivePartyRoom(null);
        navigate('/party');
    }, [navigate]);

    const handleJoinRoom = useCallback((id: string, name: string, icon?: string) => {
        setActivePartyRoom(prev => {
            if (prev?.id === id) return prev; // Don't trigger state change if same room
            return { id, name, icon };
        });
        navigate('/party');
    }, [navigate]);

    useEffect(() => {
        // Handle back button to prevent app exit
        const pushState = () => window.history.pushState(null, '', window.location.pathname);
        pushState();

        const handler = (e: any) => {
            setGlobalToast(e.detail);
            setTimeout(() => setGlobalToast(null), 4000);
        };
        window.addEventListener('in-app-notification', handler);

        const handlePopState = () => {
            pushState();
            // First notify components (to close modals)
            const event = new CustomEvent('app-back-button', { cancelable: true });
            const defaultPrevented = !window.dispatchEvent(event);

            // If no component handled the back button (modals etc), navigate back
            if (!defaultPrevented) {
                if (path !== '/home') {
                    navigate('/home');
                }
            }
        };
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('in-app-notification', handler);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [path, navigate]);

    return (
        <div className="app-container">
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <Routes>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<HomePage onOpenParty={() => navigate('/party')} onOpen1v1Match={() => navigate('/1v1-match')} />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/:id" element={<ProfilePage />} />
                    <Route path="/party" element={
                        <PartyRoomPage
                            onRoomJoin={handleJoinRoom}
                        />
                    } />
                    <Route path="/1v1-match" element={<OneVsOneMatchPage onClose={() => navigate('/home')} />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/help" element={<HelpPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/join-room/:roomId" element={<JoinRoomRedirect />} />
                    <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
            </div>

            {/* Persistent Party Room Logic */}
            {activePartyRoom && (
                <div style={{
                    display: isParty ? 'block' : 'none',
                    position: 'fixed', inset: 0, zIndex: 1100,
                    background: 'var(--bg-primary)',
                    animation: isParty ? 'fadeIn 0.3s ease' : 'none'
                }}>
                    <PartyRoomInner
                        roomId={activePartyRoom.id}
                        onBack={handleBack}
                        onLeave={handleLeave}
                    />
                </div>
            )}

            {activePartyRoom && !isParty && path !== '/1v1-match' && path !== '/admin' && (
                <div
                    className="floating-box"
                    onMouseDown={(e) => {
                        isDragging.current = false;
                        dragStart.current = { x: e.clientX - floatPos.x, y: e.clientY - floatPos.y };
                        const onMove = (me: MouseEvent) => {
                            const nx = me.clientX - dragStart.current.x;
                            const ny = me.clientY - dragStart.current.y;
                            if (Math.abs(nx - floatPos.x) > 5 || Math.abs(ny - floatPos.y) > 5) isDragging.current = true;
                            setFloatPos({ x: nx, y: ny });
                        };
                        const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                        };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                    }}
                    onTouchStart={(e) => {
                        isDragging.current = false;
                        const touch = e.touches[0];
                        dragStart.current = { x: touch.clientX - floatPos.x, y: touch.clientY - floatPos.y };
                        const onMove = (te: TouchEvent) => {
                            const t = te.touches[0];
                            const nx = t.clientX - dragStart.current.x;
                            const ny = t.clientY - dragStart.current.y;
                            if (Math.abs(nx - floatPos.x) > 5 || Math.abs(ny - floatPos.y) > 5) isDragging.current = true;
                            setFloatPos({ x: nx, y: ny });
                        };
                        const onEnd = () => {
                            window.removeEventListener('touchmove', onMove);
                            window.removeEventListener('touchend', onEnd);
                        };
                        window.addEventListener('touchmove', onMove);
                        window.addEventListener('touchend', onEnd);
                    }}
                    onClick={() => {
                        if (!isDragging.current) navigate('/party');
                    }}
                    style={{
                        position: 'fixed', left: floatPos.x, top: floatPos.y, zIndex: 2000,
                        background: 'var(--premium-gradient)',
                        backdropFilter: 'blur(20px)',
                        width: 52, height: 52, borderRadius: 18,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 12px 30px rgba(124, 77, 255, 0.4)',
                        cursor: 'grab', border: '1px solid rgba(255, 255, 255, 0.2)',
                        touchAction: 'none', transition: isDragging.current ? 'none' : '0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        userSelect: 'none',
                        animation: 'lm-bounce 2s infinite'
                    }}
                >
                    <div style={{ fontSize: 24, color: '#fff' }}>🎭</div>
                    <div style={{ position: 'absolute', background: '#22c55e', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '6px', border: '3px solid var(--bg-deep)', boxShadow: '0 0 10px #22c55e' }}></div>
                    <div className="float-label" style={{
                        position: 'absolute', top: -35, left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--bg-dark)', color: '#fff',
                        fontSize: 10, padding: '4px 10px', borderRadius: 10, whiteSpace: 'nowrap',
                        pointerEvents: 'none', opacity: 0, transition: '0.2s', fontWeight: 900,
                        border: '1px solid var(--glass-border)'
                    }}>{activePartyRoom.name}</div>
                </div>
            )}

            {/* Global In-App Notification Toast */}
            {globalToast && (
                <div
                    onClick={() => {
                        const { type, postId, followerId, senderId } = globalToast.data || {};
                        if (type === 'message' && senderId) navigate(`/chat?userId=${senderId}`);
                        else if (type === 'follow' && followerId) navigate(`/profile/${followerId}`);
                        else if ((type === 'like' || type === 'comment') && postId) {
                            // Gönderinin sahibine göre yönlendir
                            navigate(`/profile`); // Kendi profilindeki gönderiler için
                        }
                        else if (type?.includes('friend')) navigate('/profile');
                        setGlobalToast(null);
                    }}
                    style={{
                        position: 'fixed', top: 20, left: 16, right: 16, zIndex: 9999,
                        background: globalToast.data?.type === 'error' ? 'rgba(127, 29, 29, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(12px)',
                        padding: 16, borderRadius: 20,
                        border: globalToast.data?.type === 'error' ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.4)', display: 'flex', gap: 12,
                        animation: 'fadeInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer'
                    }}
                >
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, color: 'var(--purple-light)' }}>
                        {globalToast.data?.type === 'like' ? <i className="fa-solid fa-heart" style={{ color: '#ef4444' }}></i> : globalToast.data?.type === 'message' ? <i className="fa-solid fa-comment"></i> : <i className="fa-solid fa-bell"></i>}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>{globalToast.title}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 1.4 }}>{globalToast.body}</div>
                    </div>
                </div>
            )}

            <BottomNav hide={!!activePartyRoom && isParty} />
        </div>
    );
}

// ─── App Inner Logic ───────────────────────────────────────────
function AppInner() {
    const { socket } = useSocket();
    const [showSplash, setShowSplash] = useState(true);
    const [user, setUser] = useState<any>(pb.authStore.model);
    // Firebase auth hazır mı? Hazır olmadan ekran gösterme - SİYAH EKRANI ÖNLER!
    const [authLoading, setAuthLoading] = useState(!pb.isAuthReady);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);

    // Firebase auth'un yüklenmesini bekle - bu olmadan siyah ekran olur!
    useEffect(() => {
        if (pb.isAuthReady) {
            // Zaten hazır, hemen devam et
            setAuthLoading(false);
            return;
        }
        // Auth henüz hazır değil, promise tamamlanınca devam et
        pb.authReadyPromise.then(() => {
            setAuthLoading(false);
            setUser(pb.authStore.model);
        }).catch(() => {
            // Hata olsa bile uygulamayı göster (siyah ekranda kalmasın)
            console.warn('[App] Firebase auth bekleme hatası - yine de devam ediliyor');
            setAuthLoading(false);
        });
        // Max 5 saniye bekle, sonra zorla devam et
        const timeout = setTimeout(() => {
            console.warn('[App] Firebase auth timeout - zorla devam ediliyor');
            setAuthLoading(false);
        }, 5000);
        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        // OneSignal Bildirim Servisi Başlatma
        try {
            if (OneSignal && typeof OneSignal.initialize === 'function' && (window as any).Capacitor?.getPlatform() !== 'web') {
                OneSignal.initialize("dac0906c-e76a-46d4-bf59-4702ddc2cf70");
                if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
                    OneSignal.Notifications.requestPermission(true);
                }
            } else {
                console.warn("OneSignal bu platformda mevcut değil.");
            }
        } catch (e) {
            console.error("OneSignal Init Warning (Non-Fatal):", e);
        }

        NotificationService.init();
        StoreService.init();
        setImmersiveMode();

        // Global DM Bildirimleri - socket bağlantısı varsa
        if (socket) {
            const handleReceiveDM = (data: any) => {
                // Zaten o kişiyle chat sayfasındaysa bildirim gösterme
                const isChatPage = window.location.hash.includes('/chat');
                const chatParams = new URLSearchParams(window.location.search);
                const activeChatUserId = chatParams.get('userId');

                if (!(isChatPage && activeChatUserId === data.senderId)) {
                    NotificationService.notifyMessage(data.username, data.text);
                }
            };
            socket.on('receive_dm', handleReceiveDM);
            return () => {
                socket.off('receive_dm', handleReceiveDM);
            };
        }
    }, [socket]);

    // OneSignal User Login/Logout - kullanıcı durumuna göre
    useEffect(() => {
        try {
            if (OneSignal && typeof OneSignal.login === 'function' && (window as any).Capacitor?.getPlatform() !== 'web') {
                if (user && user.id) {
                    OneSignal.login(user.id);
                } else if (typeof OneSignal.logout === 'function') {
                    OneSignal.logout();
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, [user]);

    useEffect(() => {
        // Güncelleme kontrolü ve auth değişiklik dinleyicisi
        const checkUpdate = async () => {
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`);
                const data = await res.json();
                // @ts-ignore
                if (data.build > CURRENT_BUILD) {
                    setUpdateAvailable(true);
                    NotificationService.show('✨ Yeni Sürüm Hazır!', 'Harika özellikler seni bekliyor. Uygulamayı yenileyerek hemen keşfet!');
                }
            } catch { }
        };
        checkUpdate();

        // Auth değişikliklerini dinle (giriş/çıkış)
        const unbind = pb.authStore.onChange((_: string, model: any) => setUser(model), true);
        return () => {
            unbind();
        };
    }, []);

    // Socket event listener'ları
    useEffect(() => {
        if (!socket) return;

        // Sistem bildirimleri (admin'den gelen)
        socket.on('system_notification', (notif: any) => {
            if (notif.title && notif.body) {
                NotificationService.show(notif.title, notif.body, notif.data);
            }
        });

        // Admin yayın mesajları
        socket.on('admin_broadcast', (data: any) => {
            if (data.message) {
                NotificationService.show(
                    tGlobal('announcement_title'),
                    data.message,
                    { type: 'announcement', timestamp: data.timestamp }
                );
            }
        });

        // Arkadaşlık isteği bildirimi
        socket.on('friend_request_received', (data: any) => {
            NotificationService.notifyFriendRequest(data.fromName || 'Birisi');
        });

        // Global DM bildirimleri
        const handleGlobalDM = (data: any) => {
            // Kendi gönderdiğimiz mesajı bildirme
            if (data.senderId !== pb.authStore.model?.id) {
                const isChattingWithSender = window.location.hash.includes('/chat') && window.location.search.includes(data.senderId);
                if (!isChattingWithSender) {
                    NotificationService.notifyMessage(data.username, data.text);
                }
            }
        };

        socket.on('receive_dm', handleGlobalDM);

        return () => {
            socket.off('system_notification');
            socket.off('admin_broadcast');
            socket.off('friend_request_received');
            socket.off('receive_dm', handleGlobalDM);
        };
    }, [socket]);

    const handleUpdate = () => {
        setUpdating(true);
        let p = 0;
        const interval = setInterval(() => {
            p += Math.random() * 15;
            if (p >= 100) {
                p = 100;
                clearInterval(interval);
                setTimeout(() => window.location.reload(), 500);
            }
            setUpdateProgress(p);
        }, 200);
    };

    // Firebase auth yüklenirken splash ekranı göster (siyah ekran yerine)
    if (authLoading || showSplash) return <Splash onDone={() => {
        // Sadece auth hazırsa splash'i kapat
        if (!authLoading) setShowSplash(false);
    }} />;

    if (updating) return (
        <div className="splash" style={{ background: '#05070a' }}>
            <div style={{ textAlign: 'center', zIndex: 10 }}>
                <div style={{ fontSize: 60, animation: 'bounce 1s infinite' }}>🚀</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginTop: 20 }}>Güncelleniyor...</div>
                <div style={{ width: 250, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, margin: '20px auto', overflow: 'hidden' }}>
                    <div style={{ width: `${updateProgress}%`, height: '100%', background: '#10b981' }} />
                </div>
            </div>
        </div>
    );

    if (updateAvailable) return (
        <div className="splash" style={{ background: '#05070a' }}>
            <div style={{ background: '#1e293b', padding: 32, borderRadius: 24, textAlign: 'center', maxWidth: '85%' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
                <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>Yeni Sürüm Hazır!</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8, marginBottom: 24 }}>Uygulamanı güncelleyerek en son özelliklere sahip ol.</p>
                <button onClick={handleUpdate} style={{ width: '100%', background: '#8b5cf6', color: '#fff', border: 'none', padding: 16, borderRadius: 16, fontWeight: 800, cursor: 'pointer' }}>Hemen Güncelle</button>
            </div>
        </div>
    );

    return (
        <BrowserRouter>
            {!user ? (
                <div className="app-container">
                    <Routes>
                        <Route path="/privacy" element={<PrivacyPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="*" element={<AuthPage onLogin={() => { }} />} />
                    </Routes>
                </div>
            ) : (
                <AppLayout />
            )}
        </BrowserRouter>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <SocketProvider>
                <AppInner />
            </SocketProvider>
        </LanguageProvider>
    );
}
