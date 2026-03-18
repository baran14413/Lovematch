import { useNavigate } from 'react-router-dom';

/**
 * =====================================================================
 *  BİLGİ PANELİ - Oda Detay Bilgi Paneli
 *  Hem lobi kartından hem oda içi başlıktan açılır.
 *  variant: 'lobby' → aşağıdan kayan bottom sheet
 *  variant: 'inroom' → oda içinde glassmorphism kart
 * =====================================================================
 */

// Boost meta bilgileri
const BOOST_META = {
    1: { icon: '⚡', label: 'Standart', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', next: 20 },
    2: { icon: '🔥', label: 'Gelişmiş', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', next: 100 },
    3: { icon: '💥', label: 'Premium', color: '#fcd34d', bg: 'rgba(252,211,77,0.15)', next: null },
};

interface BilgiPaneliProps {
    room: {
        id: string;
        name: string;
        ownerName: string;
        ownerAvatar?: string;
        ownerUid?: string;
        boostLevel: number;
        viewerCount: number;
        maxViewers?: number | null;
        seatedCount: number;
        maxSeatCount?: number;
        maxSeatsByLevel?: number;
        followerCount: number;
        nextBoostAt?: number | null;
        createdAt?: number;
    };
    isFollowing: boolean;
    onToggleFollow: (e: React.MouseEvent) => void;
    onJoin?: () => void;      // Lobiden girildiğinde olur
    onClose: () => void;
    variant: 'lobby' | 'inroom';
}

export function BilgiPaneli({ room, isFollowing, onToggleFollow, onJoin, onClose, variant }: BilgiPaneliProps) {
    const navigate = useNavigate();
    const bm = BOOST_META[room.boostLevel as 1 | 2 | 3] || BOOST_META[1];
    const nextAt = room.nextBoostAt ?? bm.next;

    // İlerleme yüzdesi hesapla - Daha yumuşak geçiş için
    const progressPct = nextAt
        ? Math.min(100, Math.round(((room.followerCount || 0) / nextAt) * 100))
        : 100;

    // Ortak içerik (ikisinde de aynı veriler)
    const content = (
        <div className="bp-inner-content">
            {/* ── Başlık: Avatar + Oda Adı ── */}
            <div className="bp-header">
                <div className="bp-avatar-wrap">
                    <div className="bp-avatar-glow" style={{ background: bm.color }}></div>
                    {room.ownerAvatar ? (
                        <img src={room.ownerAvatar} className="bp-avatar" alt="" />
                    ) : (
                        <div className="bp-avatar bp-avatar-ph">
                            {room.ownerName?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                    {/* Boost rozeti - Animasyonlu */}
                    <span className={`bp-boost-dot bp-boost-lv${room.boostLevel}`}>
                        <span className="bp-boost-icon">{bm.icon}</span>
                    </span>
                </div>
                <div className="bp-title-block">
                    <h2 className="bp-room-name">{room.name}</h2>
                    <p className="bp-owner-name">@{room.ownerName}</p>
                </div>
                <button className="bp-close-btn" onClick={onClose}>
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            {/* ── Boost seviye rozeti + ilerleme çubuğu ── */}
            <div className="bp-boost-section">
                <div className="bp-boost-lv-row">
                    <span className="bp-lv-badge" style={{ background: bm.bg, color: bm.color, border: `1px solid ${bm.color}33` }}>
                        {bm.icon} LV{room.boostLevel} {bm.label}
                    </span>
                    {nextAt ? (
                        <span className="bp-lv-hint">
                            <span className="bp-count-highlight">{room.followerCount || 0}</span> / {nextAt} takipçi
                        </span>
                    ) : (
                        <span className="bp-lv-hint" style={{ color: '#fcd34d' }}>✨ Maksimum Seviye</span>
                    )}
                </div>
                {nextAt && (
                    <div className="bp-progress-bar-wrap">
                        <div className="bp-progress-bar-fill"
                            style={{
                                width: `${progressPct}%`,
                                background: `linear-gradient(90deg, ${bm.color}, #ec4899)`,
                                boxShadow: `0 0 10px ${bm.color}66`
                            }}>
                        </div>
                    </div>
                )}
            </div>

            {/* ── İstatistik Kartları ── */}
            <div className="bp-stats-grid">
                <div className="bp-stat-card">
                    <div className="bp-stat-icon" style={{ background: 'rgba(96, 165, 250, 0.1)' }}>
                        <i className="fa-solid fa-users" style={{ color: '#60a5fa' }}></i>
                    </div>
                    <div className="bp-stat-info">
                        <span className="bp-stat-label">İzleyici</span>
                        <span className="bp-stat-val">
                            {room.viewerCount} <span className="bp-stat-sub">/ {room.maxViewers || '∞'}</span>
                        </span>
                    </div>
                </div>
                <div className="bp-stat-card">
                    <div className="bp-stat-icon" style={{ background: 'rgba(52, 211, 153, 0.1)' }}>
                        <i className="fa-solid fa-microphone" style={{ color: '#34d399' }}></i>
                    </div>
                    <div className="bp-stat-info">
                        <span className="bp-stat-label">Koltuk</span>
                        <span className="bp-stat-val">
                            {room.seatedCount} <span className="bp-stat-sub">/ {room.maxSeatCount || room.maxSeatsByLevel || 8}</span>
                        </span>
                    </div>
                </div>
                <div className="bp-stat-card">
                    <div className="bp-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                        <i className="fa-solid fa-bell" style={{ color: '#f59e0b' }}></i>
                    </div>
                    <div className="bp-stat-info">
                        <span className="bp-stat-label">Takipçi</span>
                        <span className="bp-stat-val">{room.followerCount || 0}</span>
                    </div>
                </div>
                <div className="bp-stat-card">
                    <div className="bp-stat-icon" style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
                        <i className="fa-solid fa-clock" style={{ color: '#ec4899' }}></i>
                    </div>
                    <div className="bp-stat-info">
                        <span className="bp-stat-label">Aktiflik</span>
                        <span className="bp-stat-val">
                            {(() => {
                                if (!room.createdAt) return 'Yeni';
                                const diff = Date.now() - room.createdAt;
                                const mins = Math.floor(diff / 60000);
                                if (mins < 60) return `${mins} dk`;
                                const hrs = Math.floor(mins / 60);
                                if (hrs < 24) return `${hrs} sa`;
                                return `${Math.floor(hrs / 24)} gn`;
                            })()}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Aksiyon Butonları ── */}
            <div className="bp-actions">
                {/* Takip Et / Bırak */}
                <button
                    className={`bp-follow-btn ${isFollowing ? 'bp-following' : ''}`}
                    onClick={onToggleFollow}
                >
                    <div className="bp-btn-shine"></div>
                    <i className={`fa-${isFollowing ? 'solid' : 'regular'} fa-heart`}></i>
                    <span>{isFollowing ? 'Takipten Çık' : 'Takip Et'}</span>
                </button>

                {/* Odaya Gir - sadece lobide */}
                {onJoin && (
                    <button className="bp-join-btn" onClick={onJoin}>
                        <div className="bp-btn-shine"></div>
                        <i className="fa-solid fa-door-open"></i>
                        <span>Odaya Gir</span>
                    </button>
                )}
            </div>

            {/* SSS linki */}
            <button className="bp-help-link" onClick={() => { onClose(); navigate('/help'); }}>
                <i className="fa-solid fa-circle-question"></i>
                Nasıl daha fazla boost alırım?
            </button>
        </div>
    );

    // ══════════════════════════════════════════════
    // LOBBY VARYANTI: Alttan kayan bottom sheet
    // ══════════════════════════════════════════════
    if (variant === 'lobby') {
        return (
            <div className="bp-overlay bp-lobby-overlay" onClick={onClose}>
                <div className="bp-sheet bp-sheet-lobby" onClick={e => e.stopPropagation()}>
                    <div className="bp-drag-handle"></div>
                    {content}
                </div>

                <style>{`
                    .bp-lobby-overlay {
                        position: fixed; inset: 0;
                        background: rgba(5, 7, 12, 0.85);
                        backdrop-filter: blur(12px);
                        z-index: 2200;
                        display: flex; align-items: flex-end;
                        animation: bp-fade-in 0.3s ease;
                    }
                    .bp-sheet-lobby {
                        width: 100%; max-height: 90vh; overflow-y: auto;
                        background: linear-gradient(180deg, #0f111a 0%, #05070a 100%);
                        border-top: 1px solid rgba(139, 92, 246, 0.3);
                        border-radius: 32px 32px 0 0;
                        padding: 12px 24px 48px;
                        box-shadow: 0 -20px 60px rgba(0,0,0,0.8);
                        animation: bp-slide-up 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                    }
                    .bp-drag-handle {
                        width: 40px; height: 5px; background: rgba(255,255,255,0.15);
                        border-radius: 99px; margin: 0 auto 24px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    }
                    ${SHARED_CSS}
                `}</style>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // IN-ROOM VARYANTI: Oda içinde glassmorphism kart
    // ══════════════════════════════════════════════
    return (
        <div className="bp-overlay bp-inroom-overlay" onClick={onClose}>
            <div className="bp-sheet bp-sheet-inroom" onClick={e => e.stopPropagation()}>
                {content}
            </div>

            <style>{`
                .bp-inroom-overlay {
                    position: fixed; inset: 0;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(15px);
                    z-index: 2201;
                    display: flex; align-items: center; justify-content: center;
                    padding: 24px;
                    animation: bp-fade-in 0.3s ease;
                }
                .bp-sheet-inroom {
                    width: 100%; max-width: 380px; max-height: 85vh; overflow-y: auto;
                    background: rgba(15, 17, 26, 0.9);
                    border: 1px solid rgba(139, 92, 246, 0.4);
                    border-radius: 32px;
                    padding: 28px 24px 36px;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.9), 
                                0 0 80px rgba(139,92,246,0.15);
                    animation: bp-zoom-in 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                }
                ${SHARED_CSS}
                /* In-room varyantı için ekstra parlama efekti */
                .bp-sheet-inroom::before {
                    content: ''; position: absolute; top: -1px; left: 0; right: 0; height: 100px;
                    background: linear-gradient(180deg, rgba(139,92,246,0.2) 0%, transparent 100%);
                    pointer-events: none; border-radius: 32px 32px 0 0;
                }
            `}</style>
        </div>
    );
}

// ── Ortak CSS (her iki varyant da kullanır) ──
const SHARED_CSS = `
    @keyframes bp-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bp-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes bp-zoom-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes bp-shine { from { left: -100%; } to { left: 100%; } }
    @keyframes bp-float { 0% { transform: translateY(0px); } 50% { transform: translateY(-3px); } 100% { transform: translateY(0px); } }
    @keyframes bp-pulse-slow { 0% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.1); opacity: 0.5; } 100% { transform: scale(1); opacity: 0.3; } }

    .bp-inner-content { position: relative; z-index: 10; }
    
    .bp-header { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
    .bp-avatar-wrap { position: relative; flex-shrink: 0; }
    .bp-avatar-glow { 
        position: absolute; inset: -5px; border-radius: 22px; 
        filter: blur(15px); opacity: 0.2; animation: bp-pulse-slow 3s infinite;
    }
    .bp-avatar {
        width: 60px; height: 60px; border-radius: 20px;
        object-fit: cover; border: 2px solid rgba(255, 255, 255, 0.1);
        display: flex; align-items: center; justify-content: center;
        position: relative; z-index: 2;
    }
    .bp-avatar-ph {
        background: linear-gradient(135deg, #7c4dff, #ec4899);
        font-size: 24px; font-weight: 950; color: #fff; text-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
    .bp-boost-dot {
        position: absolute; bottom: -6px; right: -6px;
        width: 24px; height: 24px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; border: 2.5px solid #0d0f14;
        z-index: 3; box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        animation: bp-float 2s infinite ease-in-out;
    }
    .bp-boost-lv1 { background: #818cf8; }
    .bp-boost-lv2 { background: #60a5fa; }
    .bp-boost-lv3 { background: #fcd34d; box-shadow: 0 0 15px rgba(252,211,77,0.5); }

    .bp-title-block { flex: 1; min-width: 0; }
    .bp-room-name { 
        margin: 0; color: #fff; font-size: 20px; font-weight: 950; 
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        letter-spacing: -0.5px;
    }
    .bp-owner-name { margin: 4px 0 0; color: #888; font-size: 13px; font-weight: 700; opacity: 0.8; }
    .bp-close-btn { 
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); 
        color: #fff; width: 36px; height: 36px; border-radius: 12px; 
        cursor: pointer; font-size: 16px; flex-shrink: 0;
        transition: all 0.2s;
    }
    .bp-close-btn:hover { background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.2); }

    .bp-boost-section { 
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); 
        border-radius: 20px; padding: 16px 18px; margin-bottom: 20px; 
    }
    .bp-boost-lv-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .bp-lv-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 900; letter-spacing: 0.5px; }
    .bp-lv-hint { font-size: 11px; color: #777; font-weight: 700; }
    .bp-count-highlight { color: #fff; }
    .bp-progress-bar-wrap { height: 7px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; }
    .bp-progress-bar-fill { height: 100%; border-radius: 99px; transition: width 1s cubic-bezier(0.19, 1, 0.22, 1); }

    .bp-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
    .bp-stat-card { 
        display: flex; align-items: center; gap: 12px; 
        background: rgba(255,255,255,0.03); padding: 14px; 
        border-radius: 20px; border: 1px solid rgba(255,255,255,0.04);
        transition: transform 0.2s;
    }
    .bp-stat-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.05); }
    .bp-stat-icon { 
        width: 36px; height: 36px; border-radius: 12px; 
        display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
    }
    .bp-stat-info { display: flex; flex-direction: column; }
    .bp-stat-label { color: #555; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; }
    .bp-stat-val { color: #eee; font-size: 14px; font-weight: 900; margin-top: 2px; }
    .bp-stat-sub { color: #555; font-size: 11px; }

    .bp-actions { display: flex; gap: 12px; margin-bottom: 20px; }
    .bp-btn-shine {
        position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        transform: skewX(-20deg); pointer-events: none;
    }
    .bp-follow-btn, .bp-join-btn {
        flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
        height: 54px; border-radius: 18px; font-size: 14px; font-weight: 800; cursor: pointer;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; overflow: hidden;
    }
    .bp-follow-btn {
        border: 1px solid rgba(96, 165, 250, 0.4); color: #60a5fa; background: rgba(96, 165, 250, 0.08);
    }
    .bp-follow-btn:hover { background: rgba(96, 165, 250, 0.15); transform: translateY(-3px); }
    .bp-follow-btn:hover .bp-btn-shine { animation: bp-shine 1s; }
    
    .bp-follow-btn.bp-following { 
        border-color: rgba(239, 68, 68, 0.4); color: #f87171; background: rgba(239, 68, 68, 0.08); 
    }
    .bp-follow-btn.bp-following:hover { background: rgba(239, 68, 68, 0.15); }

    .bp-join-btn {
        flex: 1.4; border: none; color: #fff;
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        box-shadow: 0 10px 25px rgba(139, 92, 246, 0.4);
    }
    .bp-join-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(139, 92, 246, 0.5); }
    .bp-join-btn:hover .bp-btn-shine { animation: bp-shine 0.8s; }
    .bp-join-btn:active { transform: scale(0.95); }

    .bp-help-link {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        width: 100%; padding: 14px; border-radius: 16px;
        background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);
        color: #666; font-size: 12px; font-weight: 700; cursor: pointer;
        transition: all 0.2s;
    }
    .bp-help-link:hover { border-color: rgba(139,92,246,0.3); color: #a78bfa; background: rgba(139,92,246,0.03); }
`;
