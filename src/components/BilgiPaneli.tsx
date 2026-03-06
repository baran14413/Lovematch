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
    // İlerleme yüzdesi hesapla
    const progressPct = nextAt
        ? Math.min(100, Math.round(((room.followerCount || 0) / nextAt) * 100))
        : 100;

    // Ortak içerik (ikisinde de aynı veriler)
    const content = (
        <>
            {/* ── Başlık: Avatar + Oda Adı ── */}
            <div className="bp-header">
                <div className="bp-avatar-wrap">
                    {room.ownerAvatar ? (
                        <img src={room.ownerAvatar} className="bp-avatar" alt="" />
                    ) : (
                        <div className="bp-avatar bp-avatar-ph">
                            {room.ownerName?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                    {/* Boost rozeti */}
                    <span className={`bp-boost-dot bp-boost-lv${room.boostLevel}`}>{bm.icon}</span>
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
                    <span className="bp-lv-badge" style={{ background: bm.bg, color: bm.color }}>
                        {bm.icon} LV{room.boostLevel} {bm.label}
                    </span>
                    {nextAt ? (
                        <span className="bp-lv-hint">{room.followerCount || 0}/{nextAt} sonraki seviye</span>
                    ) : (
                        <span className="bp-lv-hint" style={{ color: '#fcd34d' }}>🏆 Maks Seviye</span>
                    )}
                </div>
                {nextAt && (
                    <div className="bp-progress-bar-wrap">
                        <div className="bp-progress-bar-fill"
                            style={{ width: `${progressPct}%`, background: bm.color }}>
                        </div>
                    </div>
                )}
            </div>

            {/* ── İstatistik Satırları ── */}
            <div className="bp-stats">
                <div className="bp-stat">
                    <i className="fa-solid fa-users" style={{ color: '#60a5fa' }}></i>
                    <div>
                        <span className="bp-stat-label">Katılımcı / Kapasite</span>
                        <span className="bp-stat-val">
                            {room.viewerCount} / {room.maxViewers ? room.maxViewers : '∞'} kişi
                        </span>
                    </div>
                </div>
                <div className="bp-stat">
                    <i className="fa-solid fa-microphone" style={{ color: '#34d399' }}></i>
                    <div>
                        <span className="bp-stat-label">Ses Koltuğu</span>
                        <span className="bp-stat-val">
                            {room.seatedCount} / {room.maxSeatCount || room.maxSeatsByLevel || 8} dolu
                        </span>
                    </div>
                </div>
                <div className="bp-stat">
                    <i className="fa-solid fa-bell" style={{ color: '#f59e0b' }}></i>
                    <div>
                        <span className="bp-stat-label">Takipçi</span>
                        <span className="bp-stat-val">{room.followerCount || 0} kişi takip ediyor</span>
                    </div>
                </div>
                {room.createdAt && (
                    <div className="bp-stat">
                        <i className="fa-solid fa-hourglass-half" style={{ color: '#ec4899' }}></i>
                        <div>
                            <span className="bp-stat-label">Aktiflik Süresi</span>
                            <span className="bp-stat-val">
                                {(() => {
                                    const diff = Date.now() - room.createdAt;
                                    const mins = Math.floor(diff / 60000);
                                    const hours = Math.floor(mins / 60) % 24;
                                    const days = Math.floor(mins / 1440);
                                    const finalMins = mins % 60;

                                    const parts = [];
                                    if (days > 0) parts.push(`${days} gün`);
                                    if (hours > 0) parts.push(`${hours} saat`);
                                    if (finalMins > 0 || parts.length === 0) parts.push(`${finalMins} dk`);

                                    return parts.join(' ') + ' önce açıldı';
                                })()}
                            </span>
                        </div>
                    </div>
                )}
                {room.createdAt && (
                    <div className="bp-stat">
                        <i className="fa-solid fa-clock" style={{ color: '#94a3b8' }}></i>
                        <div>
                            <span className="bp-stat-label">Oluşturulma</span>
                            <span className="bp-stat-val">
                                {new Date(room.createdAt).toLocaleString('tr-TR', {
                                    day: '2-digit', month: 'short',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Aksiyon Butonları ── */}
            <div className="bp-actions">
                {/* Takip Et / Bırak */}
                <button
                    className={`bp-follow-btn ${isFollowing ? 'bp-following' : ''}`}
                    onClick={onToggleFollow}
                >
                    <i className={`fa-${isFollowing ? 'solid' : 'regular'} fa-heart`}></i>
                    {isFollowing ? 'Takipten Çık' : 'Takip Et'}
                </button>

                {/* Odaya Gir - sadece lobide */}
                {onJoin && (
                    <button className="bp-join-btn" onClick={onJoin}>
                        <i className="fa-solid fa-arrow-right-to-bracket"></i>
                        Odaya Gir
                    </button>
                )}
            </div>

            {/* SSS linki */}
            <button className="bp-help-link" onClick={() => { onClose(); navigate('/help'); }}>
                <i className="fa-solid fa-circle-question"></i>
                Oda sistemi hakkında bilgi al
            </button>
        </>
    );

    // ══════════════════════════════════════════════
    // LOBBY VARYANTI: Alttan kayan bottom sheet
    // ══════════════════════════════════════════════
    if (variant === 'lobby') {
        return (
            <div className="bp-overlay" onClick={onClose}>
                <div className="bp-sheet bp-sheet-lobby" onClick={e => e.stopPropagation()}>
                    <div className="bp-drag-handle"></div>
                    {content}
                </div>

                <style>{`
                    .bp-overlay {
                        position: fixed; inset: 0;
                        background: rgba(0,0,0,0.7);
                        backdrop-filter: blur(8px);
                        z-index: 2200;
                        display: flex; align-items: flex-end;
                        animation: fadeIn 0.2s ease;
                    }
                    .bp-sheet {
                        width: 100%; max-height: 88vh; overflow-y: auto;
                        border-radius: 28px 28px 0 0;
                        padding: 12px 20px 48px;
                        animation: slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275);
                    }
                    .bp-sheet-lobby {
                        background: #0d0f14;
                        border-top: 1px solid rgba(139,92,246,0.2);
                        box-shadow: 0 -20px 60px rgba(0,0,0,0.9);
                    }
                    .bp-drag-handle {
                        width: 36px; height: 4px; background: rgba(255,255,255,0.12);
                        border-radius: 99px; margin: 0 auto 20px;
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
        <div className="bp-overlay bp-overlay-inroom" onClick={onClose}>
            <div className="bp-sheet bp-sheet-inroom" onClick={e => e.stopPropagation()}>
                {content}
            </div>

            <style>{`
                .bp-overlay {
                    position: fixed; inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(10px);
                    z-index: 2200;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                    animation: fadeIn 0.2s ease;
                }
                .bp-sheet {
                    width: 100%; max-height: 85vh; overflow-y: auto;
                    border-radius: 24px;
                    padding: 20px 18px 32px;
                    animation: zoomIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
                }
                .bp-sheet-inroom {
                    background: rgba(10, 12, 20, 0.92);
                    border: 1px solid rgba(139,92,246,0.3);
                    box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 60px rgba(139,92,246,0.1);
                    backdrop-filter: blur(20px);
                }
                ${SHARED_CSS}
                /* In-room özel renk vurgusu */
                .bp-sheet-inroom .bp-stat { background: rgba(255,255,255,0.04); }
                .bp-sheet-inroom .bp-actions { margin-top: 20px; }
            `}</style>
        </div>
    );
}

// ── Ortak CSS (her iki varyant da kullanır) ──
const SHARED_CSS = `
    .bp-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
    .bp-avatar-wrap { position: relative; flex-shrink: 0; }
    .bp-avatar {
        width: 54px; height: 54px; border-radius: 18px;
        object-fit: cover; border: 2px solid rgba(139,92,246,0.3);
        display: flex; align-items: center; justify-content: center;
    }
    .bp-avatar-ph {
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        font-size: 22px; font-weight: 900; color: #fff;
    }
    .bp-boost-dot {
        position: absolute; bottom: -4px; right: -4px;
        width: 20px; height: 20px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; border: 2px solid #0d0f14;
    }
    .bp-boost-lv1 { background: rgba(99,102,241,0.4); }
    .bp-boost-lv2 { background: rgba(59,130,246,0.4); }
    .bp-boost-lv3 { background: rgba(245,158,11,0.4); animation: glow3 1.5s infinite alternate; }
    @keyframes glow3 { to { box-shadow: 0 0 12px rgba(245,158,11,0.5); } }

    .bp-title-block { flex: 1; min-width: 0; }
    .bp-room-name { margin: 0; color: #fff; font-size: 18px; font-weight: 950; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-owner-name { margin: 4px 0 0; color: #666; font-size: 12px; font-weight: 700; }
    .bp-close-btn { background: rgba(255,255,255,0.06); border: none; color: #888; width: 32px; height: 32px; border-radius: 10px; cursor: pointer; font-size: 14px; flex-shrink: 0; }

    .bp-boost-section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 12px 14px; margin-bottom: 14px; }
    .bp-boost-lv-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .bp-lv-badge { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 900; }
    .bp-lv-hint { font-size: 10px; color: #666; font-weight: 700; }
    .bp-progress-bar-wrap { height: 5px; background: rgba(255,255,255,0.07); border-radius: 99px; overflow: hidden; }
    .bp-progress-bar-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

    .bp-stats { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
    .bp-stat { display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,0.025); padding: 11px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.04); }
    .bp-stat i { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
    .bp-stat-label { display: block; color: #666; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .bp-stat-val { display: block; color: #ddd; font-size: 13px; font-weight: 800; margin-top: 2px; }

    .bp-actions { display: flex; gap: 10px; margin-bottom: 14px; }
    .bp-follow-btn {
        flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
        padding: 13px; border-radius: 14px; font-size: 13px; font-weight: 800; cursor: pointer;
        border: 1px solid rgba(59,130,246,0.4); color: #60a5fa; background: rgba(59,130,246,0.1);
        transition: 0.2s;
    }
    .bp-follow-btn.bp-following { border-color: rgba(239,68,68,0.4); color: #f87171; background: rgba(239,68,68,0.08); }
    .bp-join-btn {
        flex: 1.5; display: flex; align-items: center; justify-content: center; gap: 8px;
        padding: 13px; border-radius: 14px; font-size: 13px; font-weight: 900; cursor: pointer;
        background: linear-gradient(135deg, #7c4dff, #ec4899); border: none; color: #fff;
        box-shadow: 0 8px 20px rgba(124,77,255,0.3);
    }
    .bp-help-link {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        width: 100%; padding: 10px; border-radius: 12px;
        background: none; border: 1px dashed rgba(255,255,255,0.08);
        color: #555; font-size: 11px; font-weight: 700; cursor: pointer;
        transition: 0.2s;
    }
    .bp-help-link:hover { border-color: rgba(139,92,246,0.3); color: #a78bfa; }
`;
