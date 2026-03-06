import { useState, useEffect } from 'react';
import { pb } from '../pb';
import { useNavigate } from 'react-router-dom';

/**
 * =========================================================================
 *  LOVEMATCH V4 - PREMIUM DISCOVER
 *  Design: Dark Velvet / Glassmorphism / Animated Cards
 * =========================================================================
 */

export default function DiscoverPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [onlineIds, setOnlineIds] = useState<string[]>([]);
    const [onlineCount, setOnlineCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const res = await pb.collection('users').getList(1, 50, { sort: '-updated' });
                setUsers(res.items);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();

        const socket = (window as any).socket;
        if (socket) {
            socket.on('online_users_updated', (data: any) => {
                setOnlineIds(data.list || []);
                setOnlineCount(data.count || 0);
            });
            socket.emit('request_online_count');
        }

        pb.collection('users').subscribe('*', function (e) {
            if (e.action === 'create') setUsers(prev => [e.record, ...prev].slice(0, 50));
        });

        return () => {
            pb.collection('users').unsubscribe('*');
            if (socket) socket.off('online_users_updated');
        };
    }, []);

    const filtered = users.filter(u => u.id !== pb.authStore.model?.id);

    return (
        <div style={{ minHeight: '100%', background: 'var(--bg-deep)', paddingBottom: 100 }}>
            {/* Header */}
            <header style={{
                padding: '60px 24px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                animation: 'lm-slide-down 0.6s ease'
            }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 950, color: '#fff', letterSpacing: '-1px' }}>Keşfet</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, marginTop: 4 }}>Yeni dünyalar keşfetmeye hazır mısın? 🌎</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div className="header-icon-btn" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                        <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
                </div>
            </header>

            {/* Quick Access Games */}
            <div className="no-scrollbar" style={{ display: 'flex', gap: 16, padding: '0 20px', marginBottom: 24, overflowX: 'auto' }}>
                <div className="lm-premium-card" style={{
                    flexShrink: 0, width: 140, padding: 20, textAlign: 'center',
                    background: 'linear-gradient(180deg, rgba(236,72,153,0.1) 0%, rgba(15,23,42,0.9) 100%)',
                    border: '1px solid rgba(236,72,153,0.2)',
                    animation: 'lm-scale-up 0.5s ease'
                }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🎭</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>Ruh Oyunu</div>
                    <div style={{ fontSize: 9, color: 'rgba(236,72,153,1)', marginTop: 4, fontWeight: 800 }}>{onlineCount + 120} Online</div>
                </div>
                <div className="lm-premium-card" style={{
                    flexShrink: 0, width: 140, padding: 20, textAlign: 'center',
                    background: 'linear-gradient(180deg, rgba(34,197,94,0.1) 0%, rgba(15,23,42,0.9) 100%)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    animation: 'lm-scale-up 0.5s ease 0.1s backwards'
                }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📞</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>Sesli Sohbet</div>
                    <div style={{ fontSize: 9, color: 'rgba(34,197,94,1)', marginTop: 4, fontWeight: 800 }}>{Math.floor(onlineCount * 0.8) + 40} Online</div>
                </div>
                <div className="lm-premium-card" style={{
                    flexShrink: 0, width: 140, padding: 20, textAlign: 'center',
                    background: 'linear-gradient(180deg, rgba(124,77,255,0.1) 0%, rgba(15,23,42,0.9) 100%)',
                    border: '1px solid rgba(124,77,255,0.2)',
                    animation: 'lm-scale-up 0.5s ease 0.2s backwards'
                }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🎤</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>Parti Bul</div>
                    <div style={{ fontSize: 9, color: 'var(--purple-light)', marginTop: 4, fontWeight: 800 }}>{Math.floor(onlineCount * 0.3) + 12} Aktif</div>
                </div>
            </div>

            {/* Match Banner */}
            <div style={{ padding: '0 20px', marginBottom: 30 }}>
                <div className="lm-premium-card" style={{
                    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 15,
                    background: 'var(--premium-gradient)', border: 'none',
                    boxShadow: '0 10px 40px rgba(124, 77, 255, 0.4)',
                    cursor: 'pointer', animation: 'lm-slide-up 0.6s ease'
                }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                        backdropFilter: 'blur(10px)'
                    }}>🪐</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 950, color: '#fff' }}>Global Eşleşme {'>'}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginTop: 2 }}>Dünya ile bağını kur, sınırları kaldır</div>
                    </div>
                </div>
            </div>

            {/* User Feed List */}
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>Hızlı Tanışma</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 12, fontWeight: 800 }}>
                        <i className="fa-solid fa-sliders"></i> Filtrele
                    </div>
                </div>

                {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="lm-premium-card" style={{ height: 90, opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
                    ))
                ) : filtered.map((user, i) => (
                    <div
                        key={user.id}
                        className="lm-premium-card"
                        onClick={() => navigate('/profile/' + user.id)}
                        style={{
                            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                            animation: `lm-slide-up 0.6s ease ${i * 0.05}s backwards`,
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: 18,
                                border: `2px solid ${user.color || 'var(--glass-border)'}`,
                                overflow: 'hidden', background: 'var(--bg-card-alt)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28
                            }}>
                                {user.avatar ? (
                                    <img src={pb.files.getUrl(user, user.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <i className="fa-solid fa-user" style={{ color: 'rgba(255,255,255,0.2)' }}></i>
                                )}
                            </div>
                            {onlineIds.includes(user.id) && (
                                <div style={{
                                    position: 'absolute', bottom: -2, right: -2,
                                    width: 14, height: 14, borderRadius: '50%',
                                    border: '3px solid var(--bg-deep)', background: '#22c55e',
                                    boxShadow: '0 0 10px #22c55e'
                                }} />
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>{user.username || 'Anonim'}</span>
                                <div style={{
                                    background: Math.random() > 0.5 ? 'rgba(236,72,153,0.1)' : 'rgba(59,130,246,0.1)',
                                    color: Math.random() > 0.5 ? '#ec4899' : '#3b82f6',
                                    fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 900,
                                    display: 'flex', alignItems: 'center', gap: 3
                                }}>
                                    {Math.random() > 0.5 ? '♀️' : '♂️'} {20 + Math.floor(Math.random() * 10)}
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user.bio || 'Mesaj atıp tanışmaya ne dersin? ✨'}
                            </div>
                        </div>
                        <div style={{
                            width: 40, height: 40, borderRadius: 14, background: 'var(--glass-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple-light)',
                            border: '1px solid var(--glass-border)'
                        }}>
                            <i className="fa-solid fa-paper-plane"></i>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Status Button */}
            <button className="lm-primary-button" style={{
                position: 'fixed', bottom: 100, right: 24, height: 50, borderRadius: 25,
                padding: '0 24px', display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 10px 30px rgba(124, 77, 255, 0.4)', zIndex: 100
            }}>
                <i className="fa-solid fa-plus"></i>
                <span>Durum Paylaş</span>
            </button>
        </div>
    );
}
