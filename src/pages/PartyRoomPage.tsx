import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../pb';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase'; // Firestore db instance
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { usePartyRoom } from '../hooks/usePartyRoom';
import { BilgiPaneli } from '../components/BilgiPaneli';
import { SocialService } from '../utils/social';

/**
 * =========================================================================
 *  LOVEMATCH CLONE - PARTİ ODASI (V14 ULTIMATE UI)
 *  Özellikler: Yönetici Aksiyonları, Uzun Basma, Kamera, Akıllı VAD, 4x4 Düzen, Küçültme
 * =========================================================================
 */

// Uzun basma (long press) algılayıcı özel kancası
function useLongPress(callback: () => void, ms = 600) {
    const [startLongPress, setStartLongPress] = useState(false);

    useEffect(() => {
        let timerId: any;
        if (startLongPress) {
            timerId = setTimeout(callback, ms);
        } else {
            clearTimeout(timerId);
        }
        return () => clearTimeout(timerId);
    }, [startLongPress, callback, ms]);

    return {
        onMouseDown: () => setStartLongPress(true),
        onMouseUp: () => setStartLongPress(false),
        onMouseLeave: () => setStartLongPress(false),
        onTouchStart: () => setStartLongPress(true),
        onTouchEnd: () => setStartLongPress(false),
    };
}

function VideoPreview({ stream, muted = false, isLocal = false }: { stream: MediaStream, muted?: boolean, isLocal?: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;

        // Stream değiştiğinde srcObject'i güncelle (öncekini temizle)
        if (video.srcObject !== stream) {
            video.srcObject = null; // Önce temizle
            video.srcObject = stream;
        }

        // Play promise ile hata yönetimi
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.warn('[VideoPreview] Autoplay blocked:', e);
                // Kullanıcı etkileşimi gerekiyorsa sessiz oynat
                video.muted = true;
                video.play().catch(console.error);
            });
        }

        return () => {
            // Cleanup - video durdur
            video.pause();
            video.srcObject = null;
        };
    }, [stream]); // stream değişince yeniden çalış

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className="seat-video"
            style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: isLocal ? 'scaleX(-1)' : 'none',  // Ayna efekti sadece lokalde
                borderRadius: 'inherit'
            }}
        />
    );
}

function Seat({ seat, index, isHost, isLeader, isLocked, localStream, remoteStream, onClick, onLongPress, roomState }: any) {
    const { t } = useLanguage();
    const MEMOJIS = ['jack.png', 'leo.png', 'lily.png', 'max.png', 'mia.png', 'sam.png', 'zoe.png'];
    const fallback = `/assets/${MEMOJIS[index % MEMOJIS.length]}`;
    const longPressProps = useLongPress(onLongPress);

    const isSpeakingIntensity = seat?.isSpeaking || 0;
    const stream = seat?.uid === pb.authStore.model?.id ? localStream : remoteStream;
    const hasVideo = stream && stream.getVideoTracks().length > 0;

    return (
        <div className="seat-wrapper-v9" onClick={() => onClick(hasVideo ? stream : null)} {...longPressProps}>
            <div
                className={`circle-v9 ${seat ? 'active' : ''} ${isSpeakingIntensity > 15 ? 'talking' : ''} ${isLocked ? 'locked' : ''}`}
            >
                {/* Kenarlık Efekti */}
                <div className="seat-border-glow"></div>

                {/* Mute Göstergesi */}
                {seat && roomState?.mutedUsers?.includes(seat.uid) && (
                    <div className="seat-mute-icon" title={t('user_muted')}>
                        <i className="fa-solid fa-microphone-slash"></i>
                    </div>
                )}

                <div className="seat-inner-container">
                    {seat ? (
                        <>
                            <div className="video-container">
                                {hasVideo ? (
                                    <VideoPreview
                                        stream={stream}
                                        muted={seat?.uid === pb.authStore.model?.id}
                                        isLocal={seat?.uid === pb.authStore.model?.id}
                                    />
                                ) : (
                                    <img src={seat.avatar || fallback} className="avatar-img" onError={(e) => e.currentTarget.src = fallback} />
                                )}
                            </div>

                            {/* Konuşma Dalgaları */}
                            {isSpeakingIntensity > 15 && (
                                <div className="speaking-waves">
                                    <div className="wave"></div>
                                    <div className="wave"></div>
                                    <div className="wave"></div>
                                </div>
                            )}

                            {isHost && <div className="host-badge"><i className="fa-solid fa-crown"></i></div>}
                            {isLeader && !isHost && <div className="leader-badge"><i className="fa-solid fa-shield-halved"></i></div>}
                        </>
                    ) : (
                        <div className="empty-seat">
                            {isLocked ? <i className="fa-solid fa-lock"></i> : <i className="fa-solid fa-plus-large"></i>}
                        </div>
                    )}
                </div>
            </div>
            <div className={`name-tag-v10 ${isHost ? 'host' : ''}`}>
                <span className="name-text">{seat ? seat.username : (isLocked ? t('locked') : (index + 1))}</span>
            </div>
        </div>
    );
}


function FloatingLobbyBackground() {
    const { t } = useLanguage();
    const FLOATING_ELEMENTS = [
        { type: 'heart', content: '❤️', left: '10%', duration: 15, delay: 0, size: 24 },
        { type: 'text', content: 'Lovematch', left: '25%', duration: 18, delay: 2, size: 15, color: '#ec4899' },
        { type: 'avatar', content: '/assets/jack.png', left: '50%', duration: 14, delay: 5, size: 40 },
        { type: 'text', content: t('join_room'), left: '35%', duration: 16, delay: 10, size: 14, color: '#10b981' },
        { type: 'text', content: t('typewriter_1'), left: '70%', duration: 16, delay: 3, size: 14, color: '#8b5cf6' },
        { type: 'heart', content: '💖', left: '85%', duration: 12, delay: 1, size: 28 },
        { type: 'avatar', content: '/assets/mia.png', left: '15%', duration: 20, delay: 7, size: 45 },
        { type: 'text', content: t('create_your_room'), left: '80%', duration: 22, delay: 9, size: 15, color: '#f59e0b' },
        { type: 'text', content: t('build_team'), left: '60%', duration: 17, delay: 8, size: 14, color: '#3b82f6' },
        { type: 'heart', content: '✨', left: '40%', duration: 13, delay: 4, size: 20 },
        { type: 'text', content: t('make_friends'), left: '20%', duration: 19, delay: 12, size: 16, color: '#a855f7' },
        { type: 'avatar', content: '/assets/leo.png', left: '75%', duration: 19, delay: 6, size: 38 },
        { type: 'text', content: t('start_chat'), left: '45%', duration: 21, delay: 14, size: 14, color: '#ef4444' }
    ];

    return (
        <div className="lobby-floating-bg">
            {FLOATING_ELEMENTS.map((el, i) => (
                <div
                    key={i}
                    className={`floating-item ${el.type}`}
                    style={{
                        left: el.left,
                        animationDuration: `${el.duration}s`,
                        animationDelay: `${el.delay}s`,
                        fontSize: el.type !== 'avatar' ? el.size : undefined,
                        color: el.color
                    }}
                >
                    {el.type === 'avatar' ? (
                        <img src={el.content} style={{ width: el.size, height: el.size, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', objectFit: 'cover' }} />
                    ) : (
                        el.content
                    )}
                </div>
            ))}
        </div>
    );
}

export function PartyRoomPage({ onRoomJoin }: { onRoomJoin?: (id: string, name: string, icon?: string) => void; }) {
    const { socket, authStatus } = useSocket();
    const { t } = useLanguage();
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [userHasRoom, setUserHasRoom] = useState(false);
    const [seatCount, setSeatCount] = useState(8);
    // Kullanıcının takip ettiği odaları lokal tutuyoruz
    const [followedRooms, setFollowedRooms] = useState<Set<string>>(new Set());
    // Seçili oda detay paneli (BilgiPaneli)
    const [selectedRoomDetail, setSelectedRoomDetail] = useState<any | null>(null);
    const [showTournament, setShowTournament] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [myRoomId, setMyRoomId] = useState<string | null>(null);
    const navigate = useNavigate();

    const MOCK_WOMEN_ROOMS = [
        { id: 'm1', name: 'Kız Kıza Gıybet 💅', ownerName: 'Aysun', ownerAvatar: '/assets/mia.png', viewerCount: 142, seatedCount: 4, boostLevel: 3, isMock: true },
        { id: 'm2', name: 'Dert Ortağı Aranıyor ☕', ownerName: 'Selinay', ownerAvatar: '/assets/zoe.png', viewerCount: 89, seatedCount: 2, boostLevel: 2, isMock: true },
        { id: 'm3', name: 'Pop Müzik Saati 🎵', ownerName: 'Melisa', ownerAvatar: '/assets/lily.png', viewerCount: 210, seatedCount: 6, boostLevel: 1, isMock: true },
        { id: 'm4', name: 'Yalnızlık Paylaşılır ✨', ownerName: 'Zeynep', ownerAvatar: '/assets/mia.png', viewerCount: 54, seatedCount: 1, boostLevel: 2, isMock: true },
        { id: 'm5', name: 'Oyun Arkadaşı 🎮', ownerName: 'Ece', ownerAvatar: '/assets/lily.png', viewerCount: 121, seatedCount: 3, boostLevel: 1, isMock: true },
        { id: 'm6', name: 'Moda ve Güzellik 💄', ownerName: 'Damla', ownerAvatar: '/assets/zoe.png', viewerCount: 67, seatedCount: 5, boostLevel: 3, isMock: true }
    ];

    // Odaları Firebase'den çekme fonksiyonu
    const fetchRooms = async () => {
        try {
            const querySnapshot = await getDocs(query(collection(db, 'rooms'), orderBy('viewerCount', 'desc')));
            const formattedRooms = querySnapshot.docs.map(doc => {
                const r = doc.data();
                return {
                    id: doc.id,
                    name: r.name || 'İsimsiz Oda',
                    ownerUid: r.ownerUid,
                    ownerName: r.ownerName || 'Kullanıcı',
                    ownerAvatar: r.ownerAvatar || '',
                    viewerCount: r.viewerCount || 0,
                    seatedCount: r.seatedCount || 0,
                    maxSeatCount: r.maxSeatCount || 8,
                    boostLevel: r.boostLevel || 1,
                    followerCount: r.followerCount || 0,
                    isSleeping: r.isSleeping || false
                };
            });

            const allRooms = [...formattedRooms, ...MOCK_WOMEN_ROOMS];
            setRooms(allRooms);
            const myRoom = formattedRooms.find((r: any) => r.ownerUid === pb.authStore.model?.id);
            setUserHasRoom(!!myRoom);
            if (myRoom) setMyRoomId(myRoom.id);
        } catch (err) {
            console.error("Lobi Hatası (Firestore):", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
        const interval = setInterval(fetchRooms, 15000); // Every 15s

        if (socket) {
            socket.on('room_list_update', fetchRooms);
            socket.on('follow_room_ok', ({ roomId, followerCount }: any) => {
                setRooms(prev => prev.map(r => r.id === roomId ? { ...r, followerCount } : r));
            });
        }

        return () => {
            clearInterval(interval);
            if (socket) {
                socket.off('room_list_update', fetchRooms);
                socket.off('follow_room_ok');
            }
        };
    }, [socket]);

    // Takıp edilen odaları socket üzerinden kontrol et
    useEffect(() => {
        if (!socket || rooms.length === 0) return;
        rooms.forEach(room => socket.emit('check_follow', { targetRoomId: room.id }));
        const handler = ({ roomId, isFollowing }: any) => {
            setFollowedRooms(prev => {
                const next = new Set(prev);
                if (isFollowing) next.add(roomId); else next.delete(roomId);
                return next;
            });
        };
        socket.on('check_follow_result', handler);
        return () => { socket.off('check_follow_result', handler); };
    }, [socket, rooms.length]);

    const toggleFollow = (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        if (!socket) return;
        const isFollowing = followedRooms.has(roomId);
        socket.emit(isFollowing ? 'unfollow_room' : 'follow_room', { targetRoomId: roomId });
        setFollowedRooms(prev => {
            const next = new Set(prev);
            if (isFollowing) next.delete(roomId); else next.add(roomId);
            return next;
        });
    };

    const handleCreateRoom = () => {
        if (!socket || authStatus !== 'authenticated') return alert('Bağlantı bekleniyor...');
        if (!newRoomName.trim()) return;

        socket.emit('create_room', { name: newRoomName, seatCount });

        socket.once('room_created', (id: string) => {
            setShowCreateModal(false);
            setNewRoomName('');
            setSeatCount(8);
            fetchRooms();
            if (onRoomJoin) onRoomJoin(id, newRoomName, '🎭');
        });
    };

    return (
        <div className="lm-lobby-container no-scrollbar">
            <FloatingLobbyBackground />
            <header className="lm-lobby-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="title-section">
                        <h1 className="gradient-text">{t('lobby_title')}</h1>
                        <p>{t('lobby_sub')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {userHasRoom ? (
                            <button className="create-btn-main" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }} onClick={() => onRoomJoin?.(myRoomId!, rooms.find(r => r.id === myRoomId)?.name || 'Odama Git', '🎙️')}>
                                <i className="fa-solid fa-house-user"></i>
                                <span>Odam</span>
                            </button>
                        ) : (
                            <button className="create-btn-main" onClick={() => setShowCreateModal(true)}>
                                <i className="fa-solid fa-plus"></i>
                                <span>{t('create_room')}</span>
                            </button>
                        )}
                        <button className="create-btn-main" style={{ background: 'rgba(255, 215, 0, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }} onClick={() => setShowTournament(true)}>
                            <i className="fa-solid fa-trophy" style={{ animation: 'bounce 2s infinite' }}></i>
                        </button>
                    </div>
                </div>

                <div className="search-bar-v9">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input
                        type="text"
                        placeholder="Oda veya kullanıcı ara..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </header>

            {/* Turnuvalar Modal */}
            {showTournament && (
                <div className="modal-overlay" onClick={() => setShowTournament(false)}>
                    <div className="modal-content" style={{ textAlign: 'center', padding: '40px 20px' }} onClick={e => e.stopPropagation()}>
                        <i className="fa-solid fa-trophy" style={{ fontSize: 60, color: '#fbbf24', marginBottom: 20, filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.4))' }}></i>
                        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 10 }}>Turnuvalar Yakında!</h2>
                        <p style={{ color: '#999', fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 30 }}>Kıyasıya rekabetin olacağı, muhteşem ödüllü turnuva sistemimiz çok yakında sizlerle olacak. Lütfen beklemede kalın!</p>
                        <button className="confirm-btn" style={{ width: '100%' }} onClick={() => setShowTournament(false)}>Anladım</button>
                    </div>
                </div>
            )}

            <div className="lm-lobby-grid">
                {loading ? (
                    <div className="loader-box"><div className="p-loader"></div></div>
                ) : (rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.ownerName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) ? (
                    <div className="no-rooms">
                        <div className="empty-icon">🏜️</div>
                        <p>{searchQuery ? 'Aradığın kriterlerde oda bulunamadı.' : t('no_rooms')}</p>
                    </div>
                ) : (
                    // Odaları izleyici sayısına göre sıralayıp listele
                    rooms
                        .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.ownerName.toLowerCase().includes(searchQuery.toLowerCase()))
                        .sort((a, b) => {
                            // Gerçek ve boş odaları en üste al
                            if (!a.isMock && !b.isMock) {
                                if (a.viewerCount === 0 && b.viewerCount > 0) return -1;
                                if (a.viewerCount > 0 && b.viewerCount === 0) return 1;
                                return (b.viewerCount || 0) - (a.viewerCount || 0);
                            }
                            // Gerçek odalar mock odalardan önce gelir
                            if (!a.isMock && b.isMock) return -1;
                            if (a.isMock && !b.isMock) return 1;
                            // Mock odalar kendi içinde izleyici sayısına göre
                            return (b.viewerCount || 0) - (a.viewerCount || 0);
                        }).map((room, i) => (
                            <div
                                key={room.id}
                                className={`room-card-v9 ${room.isMock ? 'mock-room' : ''}`}
                                onClick={() => {
                                    if (room.isMock) {
                                        window.dispatchEvent(new CustomEvent('in-app-notification', {
                                            detail: { title: 'Oda Dolu', body: 'Bu oda şu an tam kapasitede çalışıyor. Lütfen diğer odalara göz atın! 🎙️' }
                                        }));
                                        return;
                                    }
                                    onRoomJoin?.(room.id, room.name, '🎙️');
                                }}
                            >
                                <div className="room-visual">
                                    <div className="overlay-tags">
                                        <span className="tag-viewer">
                                            <i className="fa-solid fa-user"></i> {room.viewerCount}
                                        </span>
                                        {room.seatedCount > 0 && (
                                            <span className="tag-mic">
                                                <i className="fa-solid fa-microphone"></i> {room.seatedCount}
                                            </span>
                                        )}
                                    </div>
                                    <div className="room-avatar-bg" style={{
                                        background: `linear-gradient(45deg, ${['#8b5cf6', '#ec4899', '#3b82f6', '#10b981'][i % 4]}44, #000)`
                                    }}>
                                        {room.ownerAvatar ? (
                                            <img src={room.ownerAvatar} alt="" />
                                        ) : (
                                            <span className="emoji">{['🎤', '🎧', '🔥', '🎮', '💃', '핺'][i % 6]}</span>
                                        )}
                                    </div>
                                    {/* Uyku Modu Etiketi */}
                                    {room.isSleeping && (
                                        <div className="sleep-tag">
                                            <i className="fa-solid fa-moon"></i> <span>{t('sleeping')}</span>
                                        </div>
                                    )}

                                    {/* Boost Seviye Rozeti */}
                                    {room.boostLevel > 1 && (
                                        <div className={`boost-badge boost-lv${room.boostLevel}`}>
                                            {room.boostLevel === 3 ? '💥' : '⚡'} LV{room.boostLevel}
                                        </div>
                                    )}
                                </div>
                                <div className="room-info-v9">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        {/* Oda adına tıklayinca detay panel açılır, kart tıklaması odaya girer */}
                                        <h3 className="room-name-v9"
                                            style={{ flex: 1, cursor: 'pointer' }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedRoomDetail(room); }}
                                        >
                                            {room.name} <i className="fa-solid fa-circle-info" style={{ fontSize: 9, color: '#555', marginLeft: 4 }}></i>
                                        </h3>
                                        {/* Sol üstteki Takip Et Butonu */}
                                        <button
                                            className={`follow-room-btn ${followedRooms.has(room.id) ? 'following' : ''}`}
                                            onClick={(e) => toggleFollow(e, room.id)}
                                        >
                                            {followedRooms.has(room.id) ? (
                                                <><i className="fa-solid fa-heart"></i> {t('following')}</>
                                            ) : (
                                                <><i className="fa-regular fa-heart"></i> {t('follow')}</>
                                            )}
                                        </button>
                                    </div>
                                    <div className="owner-info">
                                        <span className="owner-name">@{room.ownerName}</span>
                                        {room.maxViewers && (
                                            <span style={{ fontSize: 9, color: '#555', fontWeight: 700 }}>
                                                👤 {room.viewerCount}/{room.maxViewers}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )))
                }
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Yeni Oda Kur</h2>
                            <button className="close-modal" onClick={() => setShowCreateModal(false)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="input-group">
                                <label>Oda İsmi</label>
                                <input
                                    autoFocus
                                    placeholder="Örn: Gece Sohbeti 🌙"
                                    value={newRoomName}
                                    onChange={e => setNewRoomName(e.target.value)}
                                    maxLength={30}
                                />
                            </div>
                            <div className="input-group">
                                <label>Koltuk Sayısı</label>
                                {/* LV bilgisi için SSS yönlendirme butonu */}
                                <button
                                    onClick={() => { setShowCreateModal(false); navigate('/help'); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        background: 'rgba(139,92,246,0.1)', border: '1px dashed rgba(139,92,246,0.3)',
                                        borderRadius: 12, padding: '8px 14px', color: '#a78bfa',
                                        fontSize: 12, fontWeight: 800, cursor: 'pointer',
                                        marginBottom: 10, width: '100%', justifyContent: 'center'
                                    }}
                                >
                                    <i className="fa-solid fa-circle-question"></i>
                                    Oda oluşturma dokümanları için tıklayın
                                </button>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button
                                        onClick={() => setSeatCount(8)}
                                        style={{
                                            flex: 1, padding: 12, borderRadius: 12,
                                            background: 'var(--premium-gradient)',
                                            border: '1px solid #8b5cf6', color: '#fff', cursor: 'pointer', fontWeight: 800
                                        }}
                                    >8 Koltuk ⚡</button>
                                </div>
                            </div>
                            <div className="room-preview">
                                <p>ÖNİZLEME</p>
                                <div className="room-card-v9 preview">
                                    <div className="room-visual">
                                        <div className="room-avatar-bg" style={{ background: 'linear-gradient(45deg, #8b5cf6, #000)' }}>
                                            <span className="emoji">👑</span>
                                        </div>
                                    </div>
                                    <div className="room-info-v9">
                                        <h3 className="room-name-v9">{newRoomName || 'Oda İsmi'}</h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>{t('cancel')}</button>
                            <button className="confirm-btn" disabled={!newRoomName.trim()} onClick={handleCreateRoom}>Oluştur</button>
                        </div>
                    </div>
                </div >
            )
            }

            {/* ODA BİLGİ PANELİ (LOBİ) - BilgiPaneli bileşeni, lobby varyantı */}
            {
                selectedRoomDetail && (
                    <BilgiPaneli
                        room={{
                            id: selectedRoomDetail.id,
                            name: selectedRoomDetail.name,
                            ownerName: selectedRoomDetail.ownerName,
                            ownerAvatar: selectedRoomDetail.ownerAvatar,
                            ownerUid: selectedRoomDetail.ownerUid,
                            boostLevel: selectedRoomDetail.boostLevel || 1,
                            viewerCount: selectedRoomDetail.viewerCount || 0,
                            maxViewers: selectedRoomDetail.maxViewers,
                            seatedCount: selectedRoomDetail.seatedCount || 0,
                            maxSeatCount: selectedRoomDetail.maxSeatCount,
                            maxSeatsByLevel: selectedRoomDetail.maxSeatsByLevel,
                            followerCount: selectedRoomDetail.followerCount || 0,
                            nextBoostAt: selectedRoomDetail.nextBoostAt,
                            createdAt: selectedRoomDetail.createdAt,
                        }}
                        isFollowing={followedRooms.has(selectedRoomDetail.id)}
                        onToggleFollow={(e) => { toggleFollow(e, selectedRoomDetail.id); }}
                        onJoin={() => { setSelectedRoomDetail(null); onRoomJoin?.(selectedRoomDetail.id, selectedRoomDetail.name); }}
                        onClose={() => setSelectedRoomDetail(null)}
                        variant="lobby"
                    />
                )
            }

            <style>{`
                .lm-lobby-container { min-height: 100%; background: #050505; padding: 60px 20px 100px; position: relative; overflow-y: auto; overflow-x: hidden; }
                
                /* Yüzen Arka Plan CSS */
                .lobby-floating-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
                .floating-item { position: absolute; bottom: -100px; animation: floatUp linear infinite; opacity: 0; display: flex; align-items: center; justify-content: center; font-weight: 900; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
                @keyframes floatUp {
                    0% { transform: translateY(0) rotate(-10deg) scale(0.8); opacity: 0; }
                    10% { opacity: 0.6; }
                    50% { transform: translateY(-50vh) rotate(15deg) scale(1.1); }
                    90% { opacity: 0.6; }
                    100% { transform: translateY(-100vh) rotate(-10deg) scale(1); opacity: 0; }
                }
                .floating-item.text { background: rgba(0,0,0,0.5); padding: 6px 14px; border-radius: 20px; border: 1px dashed currentColor; letter-spacing: 0.5px; backdrop-filter: blur(4px); }

                .lm-lobby-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; position: relative; z-index: 10; }
                .gradient-text { font-size: 32px; font-weight: 950; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; letter-spacing: -1px; }
                .lm-lobby-header p { color: #888; font-size: 14px; margin: 5px 0 0; font-weight: 600; }
                
                .search-bar-v9 {
                    position: relative;
                    z-index: 10;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    padding: 4px 16px;
                    gap: 12px;
                    transition: 0.3s;
                }
                .search-bar-v9:focus-within {
                    background: rgba(255,255,255,0.06);
                    border-color: rgba(139, 92, 246, 0.3);
                    box-shadow: 0 0 20px rgba(139, 92, 246, 0.1);
                }
                .search-bar-v9 i { color: #555; font-size: 14px; }
                .search-bar-v9 input {
                    flex: 1;
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 14px;
                    font-weight: 600;
                    padding: 10px 0;
                    outline: none;
                }
                .search-bar-v9 input::placeholder { color: #444; }

                .create-btn-main { display: flex; align-items: center; gap: 8px; background: var(--premium-gradient); border: none; padding: 10px 16px; border-radius: 16px; color: #fff; font-weight: 800; cursor: pointer; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 20px rgba(168, 85, 247, 0.3); }
                .create-btn-main:active { transform: scale(0.9); }
                .create-btn-main i { font-size: 18px; }

                .lm-lobby-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; position: relative; z-index: 10; }
                .no-rooms { grid-column: span 2; text-align: center; padding: 60px 20px; color: #555; }
                .empty-icon { font-size: 50px; margin-bottom: 15px; opacity: 0.5; }
                .no-rooms p { font-weight: 700; font-size: 16px; }

                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }

                .room-card-v9 { background: #0f1115; border-radius: 24px; padding: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: 0.3s; position: relative; overflow: hidden; }
                .room-card-v9:hover { transform: translateY(-5px); border-color: rgba(168, 85, 247, 0.3); background: #15181e; }
                
                .room-visual { height: 130px; border-radius: 18px; position: relative; overflow: hidden; }
                .overlay-tags { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; justify-content: space-between; z-index: 5; }
                .tag-viewer, .tag-mic { background: rgba(0,0,0,0.7); padding: 4px 10px; border-radius: 10px; font-size: 10px; color: #fff; font-weight: 900; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 4px; }
                .tag-mic { background: rgba(34, 197, 94, 0.3); border-color: rgba(34, 197, 94, 0.4); }

                .leader-badge-card { position: absolute; bottom: 8px; right: 8px; background: #eab308; color: #000; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
                .sleep-tag { position: absolute; bottom: 8px; left: 8px; background: rgba(139, 92, 246, 0.4); backdrop-filter: blur(4px); color: #fff; padding: 4px 10px; border-radius: 10px; font-size: 10px; font-weight: 950; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(139, 92, 246, 0.3); animation: lm-pulse 2s infinite; }
                @keyframes lm-pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }

                .room-avatar-bg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
                .room-avatar-bg img { width: 100%; height: 100%; object-fit: cover; }
                .room-avatar-bg .emoji { font-size: 45px; filter: drop-shadow(0 0 15px rgba(168, 85, 247, 0.5)); }

                .room-info-v9 { padding: 12px 6px 4px; }
                .room-name-v9 { color: #fff; font-size: 14px; font-weight: 900; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .owner-info { margin-top: 4px; display: flex; align-items: center; gap: 6px; }
                .owner-name { color: #71717a; font-size: 11px; font-weight: 700; }
                .follower-count { color: #a78bfa; font-size: 10px; font-weight: 800; display: flex; align-items: center; gap: 3px; }

                /* Takip Et Butonu - Minimal Red/Mavi */
                .follow-room-btn {
                    display: flex; align-items: center; gap: 4px;
                    padding: 4px 8px; border-radius: 20px; font-size: 10px; font-weight: 800;
                    border: 1px solid rgba(59,130,246,0.5); color: #60a5fa;
                    background: rgba(59,130,246,0.1); cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.175,0.885,0.32,1.275);
                    white-space: nowrap; flex-shrink: 0;
                }
                .follow-room-btn:hover { transform: scale(1.07); }
                .follow-room-btn.following {
                    border-color: rgba(239,68,68,0.5); color: #f87171;
                    background: rgba(239,68,68,0.1);
                }
                .follow-room-btn i { font-size: 9px; }

                /* Boost Rozeti */
                .boost-badge {
                    position: absolute; bottom: 8px; left: 8px;
                    font-size: 9px; font-weight: 900; padding: 2px 8px;
                    border-radius: 8px; letter-spacing: 0.5px;
                    backdrop-filter: blur(8px);
                }
                .boost-lv2 { background: rgba(59,130,246,0.3); color: #93c5fd; border: 1px solid rgba(59,130,246,0.5); }
                .boost-lv3 { background: rgba(245,158,11,0.3); color: #fcd34d; border: 1px solid rgba(245,158,11,0.5); animation: boost-glow 1.5s infinite alternate; }
                @keyframes boost-glow { from { box-shadow: 0 0 6px rgba(245,158,11,0.4); } to { box-shadow: 0 0 14px rgba(245,158,11,0.7); } }

                /* ===== ODA DETAY PANELİ CSS ===== */
                .room-detail-panel {
                    position: fixed; bottom: 0; left: 0; right: 0;
                    background: #0d0f14; border-radius: 28px 28px 0 0;
                    border-top: 1px solid rgba(139,92,246,0.2);
                    padding: 24px 20px 40px;
                    box-shadow: 0 -20px 60px rgba(0,0,0,0.8);
                    animation: slideUp 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
                    z-index: 2100; max-height: 85vh; overflow-y: auto;
                }
                .rdp-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
                .rdp-avatar-wrap { position: relative; flex-shrink: 0; }
                .rdp-avatar { width: 56px; height: 56px; border-radius: 20px; object-fit: cover; border: 2px solid rgba(139,92,246,0.3); }
                .rdp-avatar-ph { background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #fff; }
                .rdp-boost-badge { position: absolute; bottom: -4px; right: -4px; width: 20px; height: 20px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; border: 2px solid #0d0f14; }
                .rdp-lv1 { background: rgba(99,102,241,0.3); }
                .rdp-lv2 { background: rgba(59,130,246,0.3); }
                .rdp-lv3 { background: rgba(245,158,11,0.3); animation: boost-glow 1.5s infinite alternate; }
                .rdp-title { margin: 0; color: #fff; font-size: 18px; font-weight: 950; }
                .rdp-owner { margin: 4px 0 0; color: #666; font-size: 12px; font-weight: 700; }

                .rdp-stats { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
                .rdp-stat { display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,0.03); padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.04); }
                .rdp-stat i { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
                .rdp-stat-label { display: block; color: #666; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .rdp-stat-val { display: block; color: #eee; font-size: 13px; font-weight: 800; margin-top: 2px; }

                .rdp-boost-info { background: rgba(139,92,246,0.06); border: 1px solid rgba(139,92,246,0.15); border-radius: 14px; padding: 12px 14px; }
                .rdp-boost-next { display: flex; flex-direction: column; gap: 6px; }
                .rdp-boost-bar-wrap { height: 5px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; }
                .rdp-boost-bar-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6, #ec4899); border-radius: 99px; transition: width 0.5s ease; }

                .rdp-actions { display: flex; gap: 10px; }
                .rdp-follow-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 16px; font-size: 13px; font-weight: 800; cursor: pointer; transition: 0.25s; border: 1px solid rgba(59,130,246,0.4); color: #60a5fa; background: rgba(59,130,246,0.1); }
                .rdp-follow-btn.rdp-following { border-color: rgba(239,68,68,0.4); color: #f87171; background: rgba(239,68,68,0.1); }
                .rdp-join-btn { flex: 1.5; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 16px; font-size: 13px; font-weight: 900; cursor: pointer; background: var(--premium-gradient); border: none; color: #fff; box-shadow: 0 8px 20px rgba(168,85,247,0.3); }

                /* Modal Styles */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); z-index: 2000; display: flex; alignItems: center; justify-content: center; padding: 20px; animation: fadeIn 0.3s ease; }
                .modal-content { background: #0f1115; width: 100%; max-width: 400px; border-radius: 32px; border: 1px solid rgba(139, 92, 246, 0.3); overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .modal-header { padding: 24px 24px 10px; display: flex; justify-content: space-between; align-items: center; }
                .modal-header h2 { margin: 0; color: #fff; font-size: 20px; font-weight: 950; }
                .close-modal { background: none; border: none; color: #555; font-size: 20px; cursor: pointer; }

                .setting-group h3 { color: #888; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 1px; }
                .layout-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .layout-btn { background: #1a1d23; border: 1px solid #333; color: #aaa; padding: 15px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
                .layout-btn i { font-size: 24px; margin-bottom: 5px; }
                .layout-btn span { font-size: 12px; font-weight: 700; }
                .layout-btn.active { background: rgba(139, 92, 246, 0.1); border-color: #8b5cf6; color: #fff; }
                .layout-btn:hover { background: #232831; }

                .modal-body { padding: 24px; }
                .input-group { margin-bottom: 24px; }
                .input-group label { display: block; color: #888; font-size: 12px; font-weight: 800; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
                .input-group input { width: 100%; background: #1a1d23; border: 1px solid #333; border-radius: 16px; padding: 16px; color: #fff; font-size: 15px; font-weight: 700; outline: none; transition: 0.3s; }
                .input-group input:focus { border-color: #8b5cf6; background: #232831; box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1); }

                .room-preview p { color: #555; font-size: 11px; font-weight: 800; margin-bottom: 12px; }
                .room-card-v9.preview { opacity: 0.7; transform: scale(0.9); pointer-events: none; margin: 0 auto; width: 160px; }

                .modal-footer { padding: 20px 24px 24px; display: flex; gap: 12px; }
                .cancel-btn { flex: 1; background: #1a1d23; border: 1px solid #333; color: #eee; padding: 14px; border-radius: 16px; font-weight: 800; cursor: pointer; }
                .confirm-btn { flex: 2; background: var(--premium-gradient); border: none; color: #fff; padding: 14px; border-radius: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 10px 20px rgba(168, 85, 247, 0.3); }
                .confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .p-loader { width: 30px; height: 30px; border: 3px solid rgba(168, 85, 247, 0.2); border-top-color: #a855f7; border-radius: 50%; animation: spin 1s infinite linear; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulseCrown { 
                    0% { transform: scale(1) translateY(-1px); filter: drop-shadow(0 0 2px rgba(252,211,77,0.4)); } 
                    100% { transform: scale(1.15) translateY(-1px); filter: drop-shadow(0 0 8px rgba(252,211,77,0.9)); } 
                }
                @keyframes swingMod { 
                    0%, 100% { transform: rotate(0deg) translateY(-1px); } 
                    20% { transform: rotate(-20deg) translateY(-1px); } 
                    40% { transform: rotate(15deg) translateY(-1px); } 
                    60% { transform: rotate(-10deg) translateY(-1px); } 
                    80% { transform: rotate(5deg) translateY(-1px); } 
                }
            `}</style>
        </div >
    );
}

// ==========================================
// PartyRoomInner Component
// ==========================================

export function PartyRoomInner({ roomId, onLeave, onBack: _onBack }: { roomId: string, onLeave: () => void, onBack?: () => void }) {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const { socket: _socket, isConnected: socketConnected, connect, authStatus } = useSocket();
    // usePartyRoom kancası ile oda mantığını yönetiyoruz — roomUsers artık buradan geliyor
    const { roomState, chat, isMicOn, isCameraOn, isLoading, isConnected, localStream, remoteStreams, roomUsers, actions } = usePartyRoom(roomId);

    // Oda içi yerel durum (state) yönetimi
    const [isAnnouncementExpanded, setIsAnnouncementExpanded] = useState(false);
    const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
    const [tempAnnouncement, setTempAnnouncement] = useState('');
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [actionPanel, setActionPanel] = useState<{ type: 'user' | 'seat', data: any } | null>(null);
    const [lastMsgTime, setLastMsgTime] = useState(0);
    const [fullScreenStream, setFullScreenStream] = useState<MediaStream | null>(null);
    const [isSeatCollapsed, setIsSeatCollapsed] = useState(false);
    const [followers, setFollowers] = useState<any[]>([]);
    const [loadingFollowers, setLoadingFollowers] = useState(false);
    const [isInitialScroll, setIsInitialScroll] = useState(true);
    const [toastMsg, setToastMsg] = useState('');
    const toastTimerRef = useRef<any>(null);
    const isSeated = roomState?.seats?.some((s: any) => s && s.uid === pb.authStore.model?.id);
    const [msg, setMsg] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showChatSettings, setShowChatSettings] = useState(false);
    const [showBlocked, setShowBlocked] = useState(false);
    const [showRoomUsers, setShowRoomUsers] = useState(false);
    const [showFollowers, setShowFollowers] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isFollowingRoom, setIsFollowingRoom] = useState(false);
    const [shareMsg, setShareMsg] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    // Mention Suggester States
    const [mentionSearch, setMentionSearch] = useState('');
    const [showMentionSuggester, setShowMentionSuggester] = useState(false);
    const [isMediaGroupExpanded, setIsMediaGroupExpanded] = useState(false);

    const isAdmin = roomState?.admins?.includes(pb.authStore.model?.id) || roomState?.ownerUid === pb.authStore.model?.id;
    const boostLevel = roomState?.boostLevel || 1;
    const followerCount = roomState?.followerCount || 0;

    // Boost hedeflerini dinamik belirle (Oda bilgisinde yoksa varsayılan ata)
    const nextBoostAt = roomState?.nextBoostAt || (boostLevel === 1 ? 20 : boostLevel === 2 ? 100 : null);

    // Bir sonraki boost için ilerleme yüzdesini hesapla
    const boostProgress = nextBoostAt
        ? Math.min(100, Math.round((followerCount / nextBoostAt) * 100))
        : 100;

    // Boost renk ve etiket
    const BOOST_META: Record<number, { label: string; color: string; bg: string; icon: string }> = {
        1: { label: 'Standart', color: '#818cf8', bg: 'rgba(99,102,241,0.15)', icon: '⚡' },
        2: { label: 'Gelişmiş', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', icon: '🔥' },
        3: { label: 'Premium', color: '#fcd34d', bg: 'rgba(245,158,11,0.15)', icon: '💥' },
    };
    const bm = BOOST_META[boostLevel] || BOOST_META[1];

    const chatEndRef = useRef<HTMLDivElement>(null);
    const [showBilgiPaneli, setShowBilgiPaneli] = useState(false);

    const filteredMentionUsers = roomUsers.filter(u =>
        u.isOnline && u.username.toLowerCase().includes(mentionSearch.toLowerCase())
    ).slice(0, 5);

    const handleInputChange = (val: string) => {
        setMsg(val);
        const words = val.split(/\s/);
        const lastWord = words[words.length - 1];
        if (lastWord.startsWith('@')) {
            setMentionSearch(lastWord.substring(1));
            setShowMentionSuggester(true);
            if (_socket && roomId) _socket.emit('get_room_users', { roomId });
        } else {
            setShowMentionSuggester(false);
        }
    };

    const insertMention = (username: string) => {
        const words = msg.split(/\s/);
        words[words.length - 1] = `@${username} `;
        setMsg(words.join(' '));
        setShowMentionSuggester(false);
    };

    const showToast = (toastMsgArg: string) => {
        setToastMsg(toastMsgArg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMsg(''), 2500);
    };

    // Takipçileri çek
    const fetchFollowers = async () => {
        setLoadingFollowers(true);
        try {
            const res = await fetch(`https://lovemtch.shop/rooms/${roomId}/followers`);
            const data = await res.json();
            setFollowers(data);
        } catch { setFollowers([]); }
        finally { setLoadingFollowers(false); }
    };

    useEffect(() => {
        if (showFollowers) fetchFollowers();
    }, [showFollowers]);

    // Boost düşüş dinleyicisi - sunucudan boost_level_down gelince bildirim göster
    useEffect(() => {
        if (!_socket) return;
        const onBoostDown = (data: { level: number; maxSeatsByLevel: number; followerCount: number }) => {
            // Kırmızı toast ile boost düşüş bildirimi
            window.dispatchEvent(new CustomEvent('in-app-notification', {
                detail: { title: `⚠️ Boost Seviyesi Düştü!`, body: `Oda LV${data.level}'e geriledi. (${data.followerCount} takıpçi)` }
            }));
        };
        _socket.on('boost_level_down', onBoostDown);
        _socket.on('boost_level_up', (_data: any) => {
            window.dispatchEvent(new CustomEvent('in-app-notification', {
                detail: { title: `🎉 Boost Seviyesi Yükseldi!`, body: `Oda LV${_data.level}'e yükseldedi! Yeni koltuk limiti: ${_data.maxSeatsByLevel}` }
            }));
        });
        return () => {
            _socket.off('boost_level_down', onBoostDown);
            _socket.off('boost_level_up');
        };
    }, [_socket]);

    // Oda için takip durumunu kontrol et
    useEffect(() => {
        if (!_socket || !roomId) return;
        _socket.emit('check_follow', { targetRoomId: roomId });
        const onResult = (data: any) => {
            if (data.roomId === roomId) setIsFollowingRoom(data.isFollowing);
        };
        _socket.on('check_follow_result', onResult);
        return () => { _socket.off('check_follow_result', onResult); };
    }, [_socket, roomId]);

    useEffect(() => {
        if (!_socket) return;
        // Engellenen kullanıcı listesini dinle
        _socket.on('blocked_users_list', setBlockedUsers);

        // Arka plan güncellenince odadakilere yansıt
        const onBgUpdated = (data: any) => {
            if (data.url) {
                // Oda arka planını güncelle - roomState parent state'te var
                (window as any).__roomBgUrl = data.url;
                // CSS ile arka planı uygula
                const roomEl = document.getElementById('party-room-root');
                if (roomEl) {
                    roomEl.style.backgroundImage = `url(${data.url})`;
                    roomEl.style.backgroundSize = 'cover';
                    roomEl.style.backgroundPosition = 'center';
                }
            }
        };
        const onBgOk = () => showToast('✅ Arka plan başarıyla güncellendi!');

        _socket.on('room_background_updated', onBgUpdated);
        _socket.on('bg_upload_ok', onBgOk);

        return () => {
            _socket.off('blocked_users_list', setBlockedUsers);
            _socket.off('room_background_updated', onBgUpdated);
            _socket.off('bg_upload_ok', onBgOk);
        };
    }, [_socket]);

    // NOT: roomUsers artık usePartyRoom hook'undan geliyor — get_room_users socket çağrısına gerek yok

    // Engellenen kullanıcıları getir
    useEffect(() => {
        if (showBlocked && _socket && roomId) {
            _socket.emit('get_blocked_users', { roomId });
        }
    }, [showBlocked, _socket, roomId]);

    useEffect(() => {
        if (chat.length > 0) {
            chatEndRef.current?.scrollIntoView({ behavior: isInitialScroll ? 'auto' : 'smooth' });
            if (isInitialScroll) setIsInitialScroll(false);
        }
    }, [chat]);

    if (!isConnected) {
        return (
            <div className="lm-room-loading">
                <div className="loading-content">
                    <div className="p-loader-large"></div>
                    <h2>Odaya Bağlanılıyor</h2>
                    <p>Ses sunucusu ile senkronizasyon kuruluyor...</p>
                    <div className="status-grid">
                        <div className={`status-item ${socketConnected ? 'ok' : 'err'}`}>
                            <i className={`fa-solid ${socketConnected ? 'fa-check-circle' : 'fa-circle-notch fa-spin'}`}></i>
                            <span>Socket Bağlantısı</span>
                        </div>
                        <div className={`status-item ${authStatus === 'authenticated' ? 'ok' : 'wait'}`}>
                            <i className={`fa-solid ${authStatus === 'authenticated' ? 'fa-shield-check' : 'fa-lock'}`}></i>
                            <span>Kimlik Doğrulama</span>
                        </div>
                    </div>
                </div>
                <div className="loading-footer">
                    <button onClick={onLeave} className="cancel-room-btn">{t('cancel')}</button>
                    <button onClick={() => connect?.()} className="retry-room-btn">Tekrar Dene</button>
                </div>
                <style>{`
                    .lm-room-loading { height: 100%; background: #050505; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; padding: 40px; }
                    .loading-content { text-align: center; max-width: 300px; }
                    .p-loader-large { width: 60px; height: 60px; border: 4px solid rgba(139, 92, 246, 0.1); border-top-color: #8b5cf6; border-radius: 50%; animation: spin 1s infinite linear; margin: 0 auto 30px; box-shadow: 0 0 30px rgba(139, 92, 246, 0.2); }
                    .loading-content h2 { font-size: 24px; font-weight: 950; margin-bottom: 10px; }
                    .loading-content p { color: #666; font-size: 14px; line-height: 1.5; font-weight: 600; }
                    .status-grid { margin-top: 40px; display: flex; flex-direction: column; gap: 12px; }
                    .status-item { background: #111; padding: 12px 16px; border-radius: 16px; display: flex; align-items: center; gap: 12px; border: 1px solid #1a1a1a; font-size: 13px; font-weight: 800; color: #444; }
                    .status-item.ok { color: #22c55e; border-color: rgba(34, 197, 94, 0.2); background: rgba(34, 197, 94, 0.05); }
                    .status-item.ok i { color: #22c55e; }
                    .status-item.wait { color: #eab308; }
                    .loading-footer { position: absolute; bottom: 50px; display: flex; gap: 15px; width: 100%; max-width: 340px; padding: 0 20px; }
                    .cancel-room-btn { flex: 1; background: #111; border: 1px solid #222; color: #666; padding: 16px; border-radius: 18px; font-weight: 800; cursor: pointer; }
                    .retry-room-btn { flex: 1; background: var(--premium-gradient); border: none; color: #fff; padding: 16px; border-radius: 18px; font-weight: 900; cursor: pointer; box-shadow: 0 10px 20px rgba(168, 85, 247, 0.3); }
                `}</style>
            </div>
        );
    }

    if (isLoading || !roomState) return <div className="lm-room-loading"><div className="p-loader-large"></div></div>;

    const handleAction = (action: string) => {
        if (!actionPanel) return;
        if (actionPanel.type === 'user') {
            actions.adminAction(action, actionPanel.data.uid, actionPanel.data.socketId);
        } else if (actionPanel.type === 'seat') {
            actions.adminAction('lock_seat', undefined, undefined, actionPanel.data);
        }
        setActionPanel(null);
    };


    // 4x4 Fixed Layout - No calculation needed for grid

    return (
        <div id="party-room-root" className={`lm-room-v9 ${roomState.layout} ${isSeatCollapsed ? 'seat-collapsed' : ''}`}>
            <div className="room-bg-layer" style={{
                background: (() => {
                    const dynUrl = (window as any).__roomBgUrl;
                    const pbUrl = roomState.background ? pb.files.getUrl(roomState, roomState.background) : null;
                    const bgUrl = dynUrl || pbUrl;
                    return bgUrl
                        ? `url(${bgUrl}) center/cover no-repeat`
                        : `radial-gradient(circle at top, ${roomState.seats[0]?.color || '#8b5cf6'}33 0%, var(--bg-primary) 80%)`;
                })()
            }}>
                <div className="bg-particles">
                    {Array.from({ length: 15 }).map((_, i) => (
                        <div key={i} className="particle" style={{
                            left: `${Math.random() * 100}%`,
                            width: `${Math.random() * 10 + 5}px`,
                            height: `${Math.random() * 10 + 5}px`,
                            animationDelay: `${Math.random() * 10}s`,
                            animationDuration: `${Math.random() * 10 + 10}s`
                        }}></div>
                    ))}
                </div>
            </div>

            {/* ===== ODA İÇİ BİLGİ PANELi - inroom varyantı ===== */}
            {
                showBilgiPaneli && roomState && (
                    <BilgiPaneli
                        room={{
                            id: roomId,
                            name: roomState.name,
                            ownerName: roomState.ownerName,
                            ownerAvatar: roomState.ownerAvatar,
                            ownerUid: roomState.ownerUid,
                            boostLevel: boostLevel,
                            viewerCount: roomState.viewerCount || 0,
                            maxViewers: roomState.maxViewers,
                            seatedCount: roomState.seatedCount || 0,
                            maxSeatCount: roomState.maxSeatCount,
                            maxSeatsByLevel: roomState.maxSeatsByLevel,
                            followerCount: followerCount,
                            nextBoostAt: nextBoostAt,
                            createdAt: roomState.createdAt,
                        }}
                        isFollowing={isFollowingRoom}
                        onToggleFollow={(e) => {
                            e.stopPropagation();
                            if (isFollowingRoom) {
                                _socket?.emit('unfollow_room', { targetRoomId: roomId });
                                setIsFollowingRoom(false);
                            } else {
                                _socket?.emit('follow_room', { targetRoomId: roomId });
                                setIsFollowingRoom(true);
                            }
                        }}
                        onClose={() => setShowBilgiPaneli(false)}
                        variant="inroom"
                    />
                )
            }

            {/* ======================== ÜST BAR - YENI TASARIM ======================== */}
            <header className="room-header-v9">
                {/* Sol: Önİzleme / Geri  (Odadan ÇIŞMIYOR - sadece küçültüyor) */}
                <div className="header-left">
                    <button className="header-icon-btn header-back-btn" onClick={_onBack} title="Lobiye dön (oda arka planda kalır)">
                        <i className="fa-solid fa-chevron-down"></i>
                    </button>
                </div>

                {/* Orta: Oda Bilgileri - Yeni Kompakt Kart */}
                <div className="room-info-bar">
                    {/* Oda Sahibi Avatar */}
                    {roomState.ownerAvatar ? (
                        <img src={roomState.ownerAvatar} className="room-owner-avatar" alt="" />
                    ) : (
                        <div className="room-owner-avatar room-owner-placeholder">
                            {roomState.ownerName?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                    {/* Oda Metin Bilgileri */}
                    <div className="room-info-text">
                        {/* Oda adına tıklayınca BilgiPaneli açılır */}
                        <div
                            className="room-info-name room-info-name-clickable"
                            onClick={() => setShowBilgiPaneli(true)}
                            title="Oda bilgisi için tıklayın"
                        >
                            {roomState.name}
                            <i className="fa-solid fa-circle-info" style={{ fontSize: 9, marginLeft: 5, opacity: 0.5 }}></i>
                        </div>
                        <div className="room-info-meta">
                            <span className="rim-chip rim-owner">@{roomState.ownerName}</span>
                            <span className="rim-chip rim-viewers">
                                <i className="fa-solid fa-eye"></i> {roomState.viewerCount}
                                {/* Oda kapasitesi varsa göster */}
                                {roomState.maxViewers && <span style={{ opacity: 0.6 }}>/{roomState.maxViewers}</span>}
                            </span>

                            {followerCount > 0 && (
                                <span className="rim-chip rim-followers">
                                    <i className="fa-solid fa-bell"></i> {followerCount}
                                </span>
                            )}
                        </div>
                        {/* Boost İlerleme Çubuğu */}
                        <div className="boost-progress-row">
                            <span className="boost-lv-badge" style={{ background: bm.bg, color: bm.color }}>
                                {bm.icon} LV{boostLevel} {BOOST_META[boostLevel]?.label}
                            </span>
                            {nextBoostAt && (
                                <div className="boost-bar-wrap">
                                    <div className="boost-bar-fill" style={{ width: `${boostProgress}%`, background: bm.color }}></div>
                                    <span className="boost-bar-label">{followerCount}/{nextBoostAt}</span>
                                </div>
                            )}
                            {!nextBoostAt && (
                                <span style={{ fontSize: 9, color: '#fcd34d', fontWeight: 800 }}>🏆 Maks Seviye</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sağ: Minimize + Menü */}
                <div className="header-right">


                    <button className="header-icon-btn" onClick={() => setShowMenu(!showMenu)}>
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    {showMenu && (
                        <div className="header-dropdown">
                            {/* Oda Ayarları - SADECE ADMİN GÖRÜR */}
                            {isAdmin && (
                                <button onClick={() => { setShowSettings(true); setShowMenu(false); }}>
                                    <i className="fa-solid fa-sliders"></i> {t('room_settings')}
                                </button>
                            )}
                            <button onClick={() => { setShowShareModal(true); setShowMenu(false); }}>
                                <i className="fa-solid fa-share-nodes"></i> {t('share')}
                            </button>
                            <button onClick={() => { setShowRoomUsers(true); setShowMenu(false); }}>
                                <i className="fa-solid fa-users"></i> {t('people_in_room')}
                            </button>
                            <button onClick={() => { setShowFollowers(true); setShowMenu(false); }}>
                                <i className="fa-solid fa-bell"></i> Takıpçiler
                                {followerCount > 0 && (
                                    <span style={{ marginLeft: 6, background: '#a855f7', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 900 }}>
                                        {followerCount}
                                    </span>
                                )}
                            </button>
                            {/* Engellenenler - sadece admin */}
                            {isAdmin && (
                                <button onClick={() => { setShowBlocked(true); setShowMenu(false); }}>
                                    <i className="fa-solid fa-user-slash"></i> Engellenenler
                                </button>
                            )}
                            {/* Odadan çık — herkes görebilir */}
                            <button onClick={onLeave} style={{ color: '#f87171' }}>
                                <i className="fa-solid fa-right-from-bracket"></i> {t('leave_room')}
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Odadakiler Modalı */}
            {
                showRoomUsers && (
                    <div className="modal-overlay" onClick={() => setShowRoomUsers(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>👥 {t('people_in_room')} ({roomUsers.length})</h2>
                                <button className="close-modal" onClick={() => setShowRoomUsers(false)}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                {roomUsers.length === 0 ? (
                                    <p style={{ color: '#666', textAlign: 'center', padding: 20 }}>Odada kimse yok.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {roomUsers.map(u => (
                                            <div key={u.uid} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: u.isOnline ? 'rgba(139, 92, 246, 0.08)' : 'rgba(26, 29, 35, 0.4)',
                                                padding: 12,
                                                borderRadius: 16,
                                                border: u.isOnline ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(255,255,255,0.03)',
                                                boxShadow: u.isOnline ? '0 4px 15px rgba(0,0,0,0.2)' : 'none',
                                                opacity: u.isOnline ? 1 : 0.6,
                                                filter: u.isOnline ? 'none' : 'grayscale(1)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ width: 36, height: 36, background: '#333', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                                            {u.avatar ? <img src={u.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>{u.username?.[0]?.toUpperCase()}</span>}
                                                        </div>
                                                        {u.isOnline ? (
                                                            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#22c55e', borderRadius: '50%', border: '2px solid #1a1d23' }}></div>
                                                        ) : (
                                                            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#666', borderRadius: '50%', border: '2px solid #1a1d23' }}></div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 13 }}>{u.username}</span>
                                                        {u.isOwner ? (
                                                            <span style={{ color: '#fcd34d', fontSize: 10, fontWeight: 800 }}><i className="fa-solid fa-crown" style={{ animation: 'pulseCrown 1.5s infinite alternate', marginRight: 4 }}></i>Oda Sahibi</span>
                                                        ) : u.isAdmin ? (
                                                            <span style={{ color: '#60a5fa', fontSize: 10, fontWeight: 800 }}><i className="fa-solid fa-hammer" style={{ animation: 'swingMod 2s infinite', marginRight: 4 }}></i>Moderatör</span>
                                                        ) : null}
                                                        {!u.isOnline && u.lastSeen && (
                                                            <span style={{ color: '#555', fontSize: 9, fontWeight: 700, marginTop: 2 }}>
                                                                Son Görülme: {new Date(u.lastSeen).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setShowRoomUsers(false);
                                                        setActionPanel({ type: 'user', data: u });
                                                    }}
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <i className="fa-solid fa-ellipsis-vertical"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Takipçiler Modalı */}
            {
                showFollowers && (
                    <div className="modal-overlay" onClick={() => setShowFollowers(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>🔔 Takıpçiler ({roomState.followerCount || 0})</h2>
                                <button className="close-modal" onClick={() => setShowFollowers(false)}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                {loadingFollowers ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="p-loader"></div></div>
                                ) : followers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#555' }}>
                                        <div style={{ fontSize: 40, marginBottom: 10 }}>🔔</div>
                                        <p style={{ fontWeight: 700 }}>Henüz takıpçi yok.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {followers.map((f: any) => (
                                            <div key={f.uid} className="follower-row">
                                                <div className="follower-avatar">
                                                    {f.avatar ? <img src={f.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : f.username?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 13 }}>{f.username}</div>
                                                    <div style={{ color: '#666', fontSize: 10, fontWeight: 600 }}>{new Date(f.followedAt).toLocaleDateString('tr-TR')}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Blocked Users Modal */}
            {
                showBlocked && (
                    <div className="modal-overlay" onClick={() => setShowBlocked(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Engellenenler</h2>
                                <button className="close-modal" onClick={() => setShowBlocked(false)}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="modal-body">
                                {blockedUsers.length === 0 ? (
                                    <p style={{ color: '#666', textAlign: 'center', padding: 20 }}>Henüz engellenen kullanıcı yok.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {blockedUsers.map(user => (
                                            <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1d23', padding: 10, borderRadius: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, background: '#333', borderRadius: '50%' }}>
                                                        {user.avatar && <img src={user.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />}
                                                    </div>
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{user.username}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        actions.adminAction('unblock', user.id);
                                                    }}
                                                    style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '8px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 900, transition: '0.2s' }}
                                                >Engeli Kaldır</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Room Settings Modal */}
            {
                showSettings && (
                    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{t('room_settings')}</h2>
                                <button className="close-modal" onClick={() => setShowSettings(false)}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="modal-body">
                                {isAdmin && (
                                    <div className="setting-group">
                                        <h3>Yönetim</h3>
                                        <button onClick={() => {
                                            if (confirm('Odayı silmek istediğine emin misin?')) {
                                                actions.adminAction('delete_room');
                                                onLeave();
                                            }
                                        }} className="action-btn danger" style={{ width: '100%', justifyContent: 'center' }}>
                                            <i className="fa-solid fa-trash"></i>
                                            <span>Odayı Sil</span>
                                        </button>
                                    </div>
                                )}

                                {isAdmin ? (
                                    <div className="setting-group">
                                        <h3>Oda Bilgileri</h3>
                                        <div className="input-group">
                                            <label>Oda İsmi</label>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <input
                                                    defaultValue={roomState.name}
                                                    onBlur={(e) => actions.updateRoomName(e.target.value)}
                                                    maxLength={30}
                                                />
                                            </div>
                                        </div>

                                        <div className="input-group">
                                            <label>Oda Duyurusu</label>
                                            <textarea
                                                defaultValue={roomState.announcement}
                                                onBlur={(e) => actions.updateAnnouncement(e.target.value)}
                                                placeholder={t('announcement_placeholder')}
                                                rows={3}
                                                style={{
                                                    width: '100%', background: '#1a1d23', border: '1px solid #333',
                                                    borderRadius: 16, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 13,
                                                    fontWeight: 600, outline: 'none', resize: 'none'
                                                }}
                                            />
                                        </div>

                                        <div className="input-group">
                                            <label>Oda Arka Planı</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <label style={{
                                                    flex: 1, height: 52, borderRadius: 14,
                                                    border: '2px dashed rgba(139,92,246,0.5)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', color: '#a78bfa', fontSize: 14, fontWeight: 700,
                                                    background: 'rgba(139,92,246,0.08)',
                                                    transition: 'all 0.2s ease',
                                                    gap: 8
                                                }}>
                                                    <i className="fa-solid fa-image" style={{ fontSize: 18 }}></i>
                                                    Görsel Seç (Max 5MB)
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                                        style={{ display: 'none' }}
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            showToast('⏳ Arka plan yükleniyor...');
                                                            try {
                                                                await actions.updateRoomBackground(file);
                                                                // Başarı mesajı socket'ten gelecek (bg_upload_ok)
                                                            } catch {
                                                                showToast('❌ Yükleme başarısız!');
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {roomState.backgroundUrl && (
                                                    <div style={{
                                                        width: 52, height: 52, borderRadius: 12,
                                                        background: `url(${roomState.backgroundUrl}) center/cover`,
                                                        border: '2px solid rgba(139,92,246,0.4)',
                                                        flexShrink: 0
                                                    }} />
                                                )}
                                            </div>
                                            <p style={{ fontSize: 11, color: '#666', marginTop: 6, fontWeight: 600 }}>
                                                💡 JPEG, PNG veya WebP formatı desteklenir.
                                            </p>
                                        </div>



                                        <div className="input-group" style={{ marginTop: 20 }}>
                                            <label>Koltuk Düzeni (LV{boostLevel} – Max {roomState.maxSeatsByLevel || 8})</label>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {/* LV1+: 8 koltuk */}
                                                <button
                                                    onClick={() => actions.adminAction('change_layout', undefined, undefined, 8)}
                                                    style={{
                                                        flex: 1, padding: 10, borderRadius: 12,
                                                        background: roomState.seats.length === 8 ? 'var(--premium-gradient)' : '#1a1d23',
                                                        border: `1px solid ${roomState.seats.length === 8 ? '#8b5cf6' : '#333'}`, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 800
                                                    }}
                                                >8 ⚡</button>
                                                {/* LV2+: 12 koltuk */}
                                                <button
                                                    onClick={() => actions.adminAction('change_layout', undefined, undefined, 12)}
                                                    disabled={boostLevel < 2}
                                                    style={{
                                                        flex: 1, padding: 10, borderRadius: 12,
                                                        background: roomState.seats.length === 12 ? 'var(--premium-gradient)' : '#1a1d23',
                                                        border: `1px solid ${boostLevel < 2 ? '#222' : roomState.seats.length === 12 ? '#8b5cf6' : '#333'}`,
                                                        color: boostLevel < 2 ? '#444' : '#fff', cursor: boostLevel < 2 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800
                                                    }}
                                                >12 {boostLevel < 2 ? '🔒' : '🔥'}</button>
                                                {/* LV3: 16 koltuk */}
                                                <button
                                                    onClick={() => actions.adminAction('change_layout', undefined, undefined, 16)}
                                                    disabled={boostLevel < 3}
                                                    style={{
                                                        flex: 1, padding: 10, borderRadius: 12,
                                                        background: roomState.seats.length === 16 ? 'var(--premium-gradient)' : '#1a1d23',
                                                        border: `1px solid ${boostLevel < 3 ? '#222' : roomState.seats.length === 16 ? '#8b5cf6' : '#333'}`,
                                                        color: boostLevel < 3 ? '#444' : '#fff', cursor: boostLevel < 3 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800
                                                    }}
                                                >16 💥</button>
                                            </div>
                                            {boostLevel < 2 && <p style={{ color: '#555', fontSize: 10, marginTop: 8, fontWeight: 700 }}>20 takıpçi ile LV2'de 12 koltuğu açabilirsiniz.</p>}
                                            {boostLevel === 2 && <p style={{ color: '#555', fontSize: 10, marginTop: 8, fontWeight: 700 }}>100 takıpçi ile LV3'te 16 koltuğu açabilirsiniz.</p>}
                                        </div>

                                        <div className="input-group" style={{ marginTop: 20 }}>
                                            <button
                                                style={{ width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', padding: '16px', background: '#1a1d23', border: '1px solid #333', borderRadius: '16px', cursor: 'pointer', alignItems: 'center' }}
                                                onClick={() => { setShowSettings(false); setShowChatSettings(true); }}
                                            >
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                    <i className="fa-solid fa-message" style={{ color: '#8b5cf6', fontSize: 16 }}></i> <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 800 }}>{t('chat_settings')}</span>
                                                </div>
                                                <i className="fa-solid fa-chevron-right" style={{ color: '#555' }}></i>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ color: '#888', textAlign: 'center' }}>{t('only_owner_can_change_settings')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Chat Settings Modal */}
            {
                showChatSettings && (
                    <div className="modal-overlay" onClick={() => setShowChatSettings(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <i className="fa-solid fa-arrow-left" style={{ color: '#888', cursor: 'pointer', marginRight: 10, fontSize: 18 }} onClick={() => { setShowChatSettings(false); setShowSettings(true); }}></i>
                                <h2 style={{ flex: 1 }}>{t('chat_settings')}</h2>
                                <button className="close-modal" onClick={() => setShowChatSettings(false)}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="setting-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d23', padding: '16px', borderRadius: '16px', border: '1px solid #333' }}>
                                        <div style={{ paddingRight: 15 }}>
                                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, textTransform: 'none' }}>{t('slow_mode')}</h3>
                                            <p style={{ margin: '4px 0 0', color: '#888', fontSize: 11, fontWeight: 600 }}>{t('chat_slow_mode_desc')}</p>
                                        </div>
                                        <button
                                            onClick={() => actions.updateSlowMode(!roomState?.slowMode)}
                                            style={{
                                                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                                padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0,
                                                background: roomState?.slowMode ? '#22c55e' : '#333', transition: '0.3s'
                                            }}
                                        >
                                            <div style={{
                                                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                                                marginLeft: roomState?.slowMode ? 22 : 2, transition: '0.3s',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                            }} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d23', padding: '16px', borderRadius: '16px', border: '1px solid #333', marginTop: 12 }}>
                                        <div style={{ paddingRight: 15 }}>
                                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, textTransform: 'none' }}>{t('close_room_chat')}</h3>
                                            <p style={{ margin: '4px 0 0', color: '#888', fontSize: 11, fontWeight: 600 }}>{t('normal_members_cannot_send_msg')}</p>
                                        </div>
                                        <button
                                            onClick={() => actions.updateChatDisabled(!roomState?.chatDisabled)}
                                            style={{
                                                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                                padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0,
                                                background: roomState?.chatDisabled ? '#ef4444' : '#333', transition: '0.3s'
                                            }}
                                        >
                                            <div style={{
                                                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                                                marginLeft: roomState?.chatDisabled ? 22 : 2, transition: '0.3s',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                            }} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Koltuk Izgaraşı - Dinamik Layout: 8/12/16'lık düzene göre CSS sınıfı */}
            <div className={`seat-grid-container-4x4 ${roomState.seats.length === 12 ? 'layout-12' :
                roomState.seats.length === 16 ? 'layout-16' : 'layout-8'
                }`}>
                {Array.from({ length: roomState.seats.length }, (_, i) => (
                    <Seat
                        key={i}
                        seat={roomState.seats[i]}
                        index={i}
                        isHost={i === 0}
                        isLeader={roomState.leaderUid === roomState.seats[i]?.uid}
                        isLocked={roomState.lockedSeats[i]}
                        isAdmin={isAdmin}
                        roomState={roomState}
                        localStream={localStream}
                        remoteStream={remoteStreams.get(roomState.seats[i]?.uid || roomState.seats[i]?.socketId)}
                        onClick={(stream: any) => {
                            if (roomState.lockedSeats[i] && !isAdmin && !roomState.seats[i]) {
                                showToast(t('seat_locked_msg'));
                                return;
                            }
                            stream ? setFullScreenStream(stream) : (roomState.seats[i] ? setActionPanel({ type: 'user', data: roomState.seats[i] }) : actions.takeSeat(i));
                        }}
                        onLongPress={() => isAdmin && setActionPanel({ type: 'seat', data: i })}
                    />
                ))}
            </div>

            <div className="seat-toggle-row">
                <button className="seat-toggle-btn" onClick={() => setIsSeatCollapsed(v => !v)}>
                    <i className={`fa-solid ${isSeatCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
                </button>
            </div>

            {/* ── Announcement Board ── */}
            {
                (roomState.announcement || isAdmin) && (
                    <div className={`notebook-style ${isAnnouncementExpanded ? 'expanded' : 'collapsed'}`} onClick={() => !isAnnouncementExpanded && setIsAnnouncementExpanded(true)}>
                        <div className="notebook-rings"></div>
                        <div className="notebook-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--premium-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(124, 77, 255, 0.4)' }}>
                                    <i className="fa-solid fa-bullhorn" style={{ color: '#fff', fontSize: 10 }}></i>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 950, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('room_announcement')}</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsAnnouncementExpanded(!isAnnouncementExpanded); }}
                                className="notebook-toggle"
                            >
                                <i className={`fa-solid fa-chevron-${isAnnouncementExpanded ? 'left' : 'right'}`}></i>
                            </button>
                        </div>

                        {isAnnouncementExpanded && (
                            <div className="notebook-content">
                                {isEditingAnnouncement ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <textarea
                                            autoFocus
                                            value={tempAnnouncement}
                                            onChange={e => setTempAnnouncement(e.target.value)}
                                            placeholder={t('announcement_placeholder')}
                                            style={{ width: '100%', height: 100, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', padding: 12, fontSize: 13, outline: 'none', resize: 'none' }}
                                        />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => {
                                                    _socket?.emit('update_announcement', tempAnnouncement);
                                                    setIsEditingAnnouncement(false);
                                                }}
                                                style={{ flex: 1, background: 'var(--premium-gradient)', color: '#fff', border: 'none', padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 12 }}
                                            >
                                                {t('save')}
                                            </button>
                                            <button
                                                onClick={() => setIsEditingAnnouncement(false)}
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 12 }}
                                            >
                                                {t('cancel')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px 0', fontWeight: 600, maxHeight: 150, overflowY: 'auto' }} className="no-scrollbar">
                                            {roomState.announcement || t('no_announcement_yet')}
                                        </div>
                                        {isAdmin && (
                                            <button
                                                onClick={() => {
                                                    setTempAnnouncement(roomState.announcement || '');
                                                    setIsEditingAnnouncement(true);
                                                }}
                                                style={{ width: '100%', background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)', padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                            >
                                                <i className="fa-solid fa-pen-to-square"></i>
                                                {t('edit_announcement')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Chat Area */}
            <div className="chat-area-v9 no-scrollbar">
                {chat.map((m: any) => {
                    const isMsgOwner = roomState?.ownerUid === m.user?.uid;
                    const isMsgMod = roomState?.admins?.includes(m.user?.uid) && !isMsgOwner;
                    const isSysChat = m.type === 'system_chat';

                    return (
                        <div
                            key={m.id}
                            className={`bubble-v9 ${m.type || 'chat'} bubble-${m.user?.bubbleStyle || 'classic'}`}
                            onClick={() => {
                                if (isSysChat || !m.user) return;
                                setActionPanel({ type: 'user', data: m.user });
                            }}
                            style={{ cursor: (isSysChat || !m.user) ? 'default' : 'pointer' }}
                        >
                            {(m.type === 'chat' || !m.type || isSysChat) ? (
                                <div className="msg-inner" style={isSysChat ? { opacity: 0.7 } : {}}>
                                    {isSysChat ? (
                                        <div className="chat-avatar" style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                                            <i className="fa-solid fa-robot" style={{ color: '#aaa', fontSize: 12 }}></i>
                                        </div>
                                    ) : (
                                        <img src={m.user?.avatar || '/assets/jack.png'} className="chat-avatar" />
                                    )}
                                    <div className="msg-content">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span className="uname" style={{ color: isSysChat ? '#aaa' : (m.user?.color || '#8b5cf6') }}>
                                                {isMsgOwner && !isSysChat && <i title="Oda Sahibi" className="fa-solid fa-crown" style={{ color: '#fcd34d', marginRight: 4, display: 'inline-block', transform: 'translateY(-1px)', animation: 'pulseCrown 1.5s infinite alternate' }}></i>}
                                                {isMsgMod && !isSysChat && <i title="Moderatör" className="fa-solid fa-hammer" style={{ color: '#60a5fa', marginRight: 4, display: 'inline-block', transform: 'translateY(-1px)', animation: 'swingMod 2s infinite' }}></i>}
                                                {m.user?.username}
                                            </span>
                                            <span style={{ fontSize: 8, opacity: 0.4, fontWeight: 700 }}>{m.time}</span>
                                        </div>
                                        <span className="utext" style={isSysChat ? { fontStyle: 'italic', color: '#999' } : {}}>
                                            {m.mentions?.includes(pb.authStore.model?.username) ? (
                                                <span style={{ color: '#ff3333', textShadow: '0 0 10px rgba(255,0,0,0.5)', fontWeight: 950, animation: 'mentionPulse 1s infinite alternate' }}>
                                                    {m.content}
                                                </span>
                                            ) : m.content}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="sys-inner">
                                    <span className="sys-icon">✨</span>
                                    <span>{m.content}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>

            {/* Action Panel */}
            {
                actionPanel && (
                    <div className="modal-overlay" onClick={() => setActionPanel(null)}>
                        <div className="action-panel-bottom" onClick={e => e.stopPropagation()}>
                            <div className="panel-header">
                                {actionPanel.type === 'user' ? (
                                    <>
                                        <img src={actionPanel.data.avatar} className="panel-avatar" />
                                        <div className="panel-title">
                                            <h3>{actionPanel.data.username}</h3>
                                            <p>@{actionPanel.data.uid.slice(-6)}</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="panel-title">
                                        <h3>Koltuk {actionPanel.data + 1}</h3>
                                        <p>Yönetici Kontrolü</p>
                                    </div>
                                )}
                            </div>
                            <div className="panel-actions">
                                {actionPanel.type === 'user' ? (
                                    <div className="user-action-grid">
                                        <button
                                            onClick={async () => {
                                                const targetId = actionPanel.data.uid;
                                                if (!targetId) return;
                                                try {
                                                    if (SocialService.isFollowing(targetId)) {
                                                        await SocialService.unfollowUser(targetId);
                                                    } else {
                                                        await SocialService.followUser(targetId);
                                                    }
                                                    setActionPanel(null);
                                                } catch (e: any) { alert(e.message); }
                                            }}
                                            className="action-btn"
                                        >
                                            <i className={`fa-solid ${SocialService.isFollowing(actionPanel.data.uid) ? 'fa-user-minus' : 'fa-user-plus'}`}></i>
                                            <span>{SocialService.isFollowing(actionPanel.data.uid) ? t('unfollow') : t('follow')}</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (actionPanel?.data?.uid) {
                                                    navigate('/profile/' + actionPanel.data.uid);
                                                    _onBack?.();
                                                    setActionPanel(null);
                                                }
                                            }}
                                            className="action-btn"
                                        >
                                            <i className="fa-solid fa-user"></i>
                                            <span>Profil Gör</span>
                                        </button>
                                        <button onClick={() => { setMsg(`@${actionPanel.data.username} `); setActionPanel(null); }} className="action-btn">
                                            <i className="fa-solid fa-at"></i>
                                            <span>Bahset</span>
                                        </button>
                                        {isAdmin && (
                                            <>
                                                <button onClick={() => handleAction(roomState.mutedUsers?.includes(actionPanel.data.uid) ? 'unmute' : 'mute')} className="action-btn warning">
                                                    <i className="fa-solid fa-microphone-slash"></i>
                                                    <span>{roomState.mutedUsers?.includes(actionPanel.data.uid) ? 'Sesi Aç' : 'Sustur'}</span>
                                                </button>
                                                <button onClick={() => handleAction('kick')} className="action-btn danger">
                                                    <i className="fa-solid fa-user-xmark"></i>
                                                    <span>Odadan At</span>
                                                </button>
                                                <button onClick={() => handleAction('block')} className="action-btn danger">
                                                    <i className="fa-solid fa-ban"></i>
                                                    <span>Engelle</span>
                                                </button>
                                            </>
                                        )}
                                        {pb.authStore.model?.id === roomState.ownerUid && actionPanel.data.uid !== roomState.ownerUid && (
                                            <div style={{ gridColumn: '1 / -1', background: 'rgba(139,92,246,0.1)', border: '1px dashed #8b5cf6', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <button
                                                    onClick={() => handleAction('toggle_mod')}
                                                    className="action-btn"
                                                    style={{ background: 'var(--premium-gradient)', color: '#fff', fontWeight: 800, border: 'none' }}
                                                >
                                                    <i className="fa-solid fa-user-shield"></i>
                                                    <span>{roomState.admins?.includes(actionPanel.data.uid) ? 'Moderatörlüğü Al' : 'Moderatör Yap'}</span>
                                                </button>
                                                <p style={{ color: '#a78bfa', fontSize: 11, textAlign: 'center', margin: 0, fontWeight: 700 }}>
                                                    Bu yetki, odada oda silme işlemi dışında tüm işlemleri yapabilmesini sağlar.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button onClick={() => handleAction(roomState.lockedSeats[actionPanel.data] ? 'unlock_seat' : 'lock_seat')} className="action-btn">
                                        <i className={`fa-solid ${roomState.lockedSeats[actionPanel.data] ? 'fa-lock-open' : 'fa-lock'}`}></i>
                                        <span>{roomState.lockedSeats[actionPanel.data] ? 'Kilidi Aç' : 'Koltuk Kilitle'}</span>
                                    </button>
                                )}
                            </div>
                            <button className="panel-cancel" onClick={() => setActionPanel(null)}>{t('close')}</button>
                        </div>
                    </div>
                )
            }

            {/* ===== PAYLAŞIM MODALI ===== */}
            {
                showShareModal && (
                    <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
                        <div className="modal-content share-modal-v9" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{t('share_room')}</h2>
                                <button className="close-modal" onClick={() => setShowShareModal(false)}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="share-preview-card">
                                    <div className="spc-msg-input">
                                        <label>{t('your_message_optional')}</label>
                                        <textarea
                                            placeholder={`${pb.authStore.model?.username} sizi ${roomState.name} odasına davet ediyor! 🎙️`}
                                            value={shareMsg}
                                            onChange={e => setShareMsg(e.target.value)}
                                        />
                                    </div>

                                    <div className="spc-room-card">
                                        <div className="spc-room-visual">
                                            {roomState.ownerAvatar ? (
                                                <img src={roomState.ownerAvatar} alt="" />
                                            ) : (
                                                <div className="spc-room-placeholder">🎙️</div>
                                            )}
                                            <div className="spc-room-badges">
                                                <span><i className="fa-solid fa-user"></i> {roomState.viewerCount}</span>
                                                {roomState.seatedCount > 0 && <span><i className="fa-solid fa-microphone"></i> {roomState.seatedCount}</span>}
                                            </div>
                                        </div>
                                        <div className="spc-room-info">
                                            <div className="spc-room-name">{roomState.name}</div>
                                            <div className="spc-room-owner">@{roomState.ownerName} &bull; Oda Sahibi</div>
                                        </div>
                                        <div className="spc-room-join-tag">Hemen Katıl <i className="fa-solid fa-chevron-right"></i></div>
                                    </div>
                                </div>

                                <div className="share-actions-v9">
                                    <button className="share-btn-main post" onClick={async () => {
                                        setIsSharing(true);
                                        try {
                                            const defaultMsg = `${pb.authStore.model?.username} sizi ${roomState.name} odasına davet ediyor! 🎙️`;
                                            const finalMsg = shareMsg.trim() || defaultMsg;

                                            await pb.collection('posts').create({
                                                content: `[ROOM_INVITE]${JSON.stringify({
                                                    roomId: roomId,
                                                    roomName: roomState.name,
                                                    ownerName: roomState.ownerName,
                                                    ownerAvatar: roomState.ownerAvatar,
                                                    viewerCount: roomState.viewerCount,
                                                    seatedCount: roomState.seatedCount,
                                                    message: finalMsg
                                                })}`,
                                                author: pb.authStore.model?.id
                                            });

                                            window.dispatchEvent(new CustomEvent('in-app-notification', {
                                                detail: { title: t('shared'), body: t('shared_desc') }
                                            }));
                                            setShowShareModal(false);
                                        } catch (e) {
                                            alert(t('post_error'));
                                        } finally {
                                            setIsSharing(false);
                                        }
                                    }} disabled={isSharing}>
                                        <i className="fa-solid fa-paper-plane"></i>
                                        <span>{isSharing ? t('sharing') : t('share_post')}</span>
                                    </button>

                                    <button className="share-btn-main link" onClick={() => {
                                        const shareLink = `https://lovemtch.shop/join-room/${roomId}`;
                                        navigator.clipboard.writeText(shareLink);

                                        window.dispatchEvent(new CustomEvent('in-app-notification', {
                                            detail: {
                                                title: '🔗 Bağlantı Kopyalandı',
                                                body: 'Bu link mobil uygulamayı açar, yoksa Play Store\'a yönlendirir.'
                                            }
                                        }));
                                        setShowShareModal(false);
                                    }}>
                                        <i className="fa-solid fa-link"></i>
                                        <span>Bağlantıyı Kopyala</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Full Screen Video */}
            {
                fullScreenStream && (
                    <div className="full-screen-video" onClick={() => setFullScreenStream(null)}>
                        <VideoPreview stream={fullScreenStream} />
                        <button className="close-full-video"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                )
            }

            {/* Minimal Custom Toast */}
            {
                toastMsg && (
                    <div className="custom-toast">
                        {toastMsg}
                    </div>
                )
            }

            {/* Bottom Bar */}
            <footer className="footer-v13">
                <div className="footer-content">
                    <div style={{ flex: 1, position: 'relative' }}>
                        {showMentionSuggester && filteredMentionUsers.length > 0 && (
                            <div className="mention-suggester">
                                {filteredMentionUsers.map(u => (
                                    <div key={u.uid} className="mention-item" onClick={() => insertMention(u.username)}>
                                        <img src={u.avatar || '/assets/jack.png'} alt="" />
                                        <span>{u.username}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="input-wrap" style={{ opacity: (roomState?.chatDisabled && !isAdmin) ? 0.5 : 1 }}>
                            <input
                                value={msg}
                                disabled={roomState?.chatDisabled && !isAdmin}
                                onChange={e => handleInputChange(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && msg.trim()) {
                                        if (roomState?.chatDisabled && !isAdmin) return;
                                        if (roomState?.slowMode && !isAdmin) {
                                            const now = Date.now();
                                            if (now - lastMsgTime < 5000) {
                                                const remaining = Math.ceil((5000 - (now - lastMsgTime)) / 1000);
                                                window.dispatchEvent(new CustomEvent('in-app-notification', {
                                                    detail: { title: t('slow_mode_active'), body: t('wait_n_seconds_msg').replace('${remaining}', remaining.toString()) }
                                                }));
                                                return;
                                            }
                                            setLastMsgTime(now);
                                        }
                                        actions.sendMessage(msg);
                                        setMsg('');
                                        setShowMentionSuggester(false);
                                    }
                                }}
                                placeholder={(roomState?.chatDisabled && !isAdmin) ? t('chat_disabled_here') : t('chat_placeholder_mention')}
                            />
                            <button className="send-btn" disabled={!msg.trim() || (roomState?.chatDisabled && !isAdmin)} onClick={() => {
                                if (msg.trim()) {
                                    if (roomState?.chatDisabled && !isAdmin) return;
                                    if (roomState?.slowMode && !isAdmin) {
                                        const now = Date.now();
                                        if (now - lastMsgTime < 5000) {
                                            const remaining = Math.ceil((5000 - (now - lastMsgTime)) / 1000);
                                            window.dispatchEvent(new CustomEvent('in-app-notification', {
                                                detail: { title: t('slow_mode_active'), body: t('wait_n_seconds_msg').replace('${remaining}', remaining.toString()) }
                                            }));
                                            return;
                                        }
                                        setLastMsgTime(now);
                                    }
                                    actions.sendMessage(msg);
                                    setMsg('');
                                    setShowMentionSuggester(false);
                                }
                            }}><i className="fa-solid fa-paper-plane"></i></button>
                        </div>
                    </div>

                    <button className="leave-btn" onClick={() => {
                        if (isSeated) {
                            actions.leaveSeat();
                        } else {
                            onLeave();
                        }
                    }}>
                        <i className={`fa-solid ${isSeated ? 'fa-user-minus' : 'fa-arrow-right-from-bracket'}`}></i>
                    </button>

                    <div className="control-group-v2">
                        <div className={`media-expandable-group ${isMediaGroupExpanded ? 'expanded' : ''}`}>
                            <button className={`control-btn ${isCameraOn ? 'active' : ''}`} onClick={(e) => {
                                e.stopPropagation();
                                if (!isSeated) {
                                    showToast(language === 'tr' ? 'Önce bir koltuğa oturmalısınız!' : 'You must sit on a seat first!');
                                    return;
                                }
                                actions.toggleCamera();
                            }}>
                                <i className={`fa-solid ${isCameraOn ? 'fa-video' : 'fa-video-slash'}`}></i>
                            </button>
                            <button
                                className={`control-btn ${isMicOn ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isSeated) {
                                        showToast(language === 'tr' ? 'Önce bir koltuğa oturmalısınız!' : 'You must sit on a seat first!');
                                        return;
                                    }
                                    if (!isMicOn && roomState?.mutedUsers?.includes(pb.authStore.model?.id)) {
                                        window.dispatchEvent(new CustomEvent('in-app-notification', {
                                            detail: { title: '⚠️ Yetki Engeli', body: 'Şu anda bu odada konuşamazsınız (Susturuldunuz).' }
                                        }));
                                        return;
                                    }
                                    actions.toggleMic();
                                }}
                            >
                                <i className={`fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
                            </button>
                        </div>
                        <button
                            className={`control-btn main-media-toggle ${isMediaGroupExpanded ? 'active' : ''}`}
                            onClick={() => setIsMediaGroupExpanded(!isMediaGroupExpanded)}
                        >
                            <i className={`fa-solid ${isMediaGroupExpanded ? 'fa-xmark' : 'fa-microphone'}`}></i>
                        </button>
                    </div>
                </div>
            </footer>

            <style>{`
                .lm-room-v9 { height: 100%; position: relative; background: #08090d; display: flex; flex-direction: column; overflow: hidden; }
                .room-bg-layer { 
                    position: absolute; inset: 0; z-index: 0; 
                    background: radial-gradient(circle at 50% 50%, #1a1b26 0%, #08090d 100%);
                }
                
                /* Arkaplan Parçacıkları */
                .bg-particles { position: absolute; inset: 0; pointer-events: none; }
                .particle { position: absolute; background: #8b5cf6; border-radius: 50%; filter: blur(2px); opacity: 0.2; animation: floatParticle 20s infinite linear; }
                @keyframes floatParticle {
                    0% { transform: translateY(100vh) scale(0); opacity: 0; }
                    20% { opacity: 0.4; }
                    100% { transform: translateY(-100px) scale(1.5); opacity: 0; }
                }

                /* Seat Styling */
                .seat-wrapper-v9 { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                .circle-v9 {
                    position: relative; width: 68px; height: 68px; border-radius: 24px;
                    background: rgba(255,255,255,0.03); border: 1.5px solid rgba(255,255,255,0.06);
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    cursor: pointer;
                }
                .circle-v9:active { transform: scale(0.92); }
                .circle-v9.active { background: rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.3); }
                .circle-v9.talking { border-color: #8b5cf6; box-shadow: 0 0 20px rgba(139, 92, 246, 0.4); }
                .circle-v9.locked { background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2); }

                .seat-inner-container { position: relative; width: 100%; height: 100%; border-radius: inherit; overflow: hidden; z-index: 2; }
                .video-container { width: 100%; height: 100%; }
                .avatar-img { width: 100%; height: 100%; object-fit: cover; }
                
                .empty-seat { color: rgba(255,255,255,0.2); font-size: 18px; }
                .circle-v9.locked .empty-seat { color: #ef4444; }

                .seat-border-glow {
                    position: absolute; inset: -3px; border-radius: 27px;
                    background: linear-gradient(135deg, #8b5cf6, #ec4899);
                    opacity: 0; transition: 0.3s; z-index: 1;
                }
                .circle-v9.talking .seat-border-glow { opacity: 0.6; animation: borderPulse 1.5s infinite; }
                @keyframes borderPulse { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } 100% { opacity: 0.3; transform: scale(1); } }

                .speaking-waves { position: absolute; inset: -15px; pointer-events: none; z-index: 0; }
                .wave { position: absolute; inset: 0; border: 2px solid #8b5cf6; border-radius: 24px; opacity: 0; animation: waveAnim 2s infinite; }
                .wave:nth-child(2) { animation-delay: 0.6s; }
                .wave:nth-child(3) { animation-delay: 1.2s; }
                @keyframes waveAnim { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.8); opacity: 0; } }

                .host-badge, .leader-badge {
                    position: absolute; bottom: -4px; right: -4px; width: 22px; height: 22px;
                    border-radius: 8px; display: flex; align-items: center; justify-content: center;
                    font-size: 10px; color: #fff; z-index: 10; border: 2px solid #08090d;
                }
                .host-badge { background: linear-gradient(135deg, #f59e0b, #ef4444); }
                .leader-badge { background: linear-gradient(135deg, #3b82f6, #8b5cf6); }

                .name-tag-v10 {
                    background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
                    padding: 4px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);
                    max-width: 80px; text-align: center;
                }
                .name-text { color: rgba(255,255,255,0.8); font-size: 10px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
                .name-tag-v10.host .name-text { color: #fcd34d; }

                /* ===== YENİ HEADER STİLİ ===== */
                .room-header-v9 {
                    position: relative; z-index: 1000;
                    padding: 44px 12px 10px;
                    display: flex; align-items: center;
                    gap: 8px;
                    background: linear-gradient(to bottom, var(--glass-bg-accent) 0%, transparent 100%);
                    backdrop-filter: blur(10px);
                }
                .header-left { display: flex; gap: 6px; flex-shrink: 0; }
                /* Geri / Mini buton - lobiye gönderir, odadan çikmaz */
                .header-back-btn { background: rgba(255,255,255,0.08) !important; color: #a78bfa !important; border-color: rgba(167,139,250,0.25) !important; }
                .header-back-btn:hover { background: rgba(167,139,250,0.15) !important; }
                .header-right { position: relative; display: flex; gap: 6px; flex-shrink: 0; }
                .header-dropdown { position: absolute; top: 46px; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 6px; min-width: 200px; z-index: 1100; box-shadow: var(--shadow-premium); }
                .header-dropdown button { width: 100%; text-align: left; background: none; border: none; color: var(--text-primary); padding: 10px 14px; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 10px; display: flex; align-items: center; gap: 10px; transition: 0.15s; }
                .header-dropdown button:hover { background: var(--glass-bg-alt); }
                .header-icon-btn { width: 34px; height: 34px; border-radius: 12px; background: var(--glass-bg-alt); border: 1px solid var(--glass-border); color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; transition: 0.2s; flex-shrink: 0; }
                .header-icon-btn:hover { background: var(--glass-bg-accent); }
                .header-icon-btn.danger { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.15); }

                /* Orta oda bilgi bar */
                .room-info-bar { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
                .room-owner-avatar { width: 38px; height: 38px; border-radius: 14px; object-fit: cover; border: 2px solid var(--glass-border); flex-shrink: 0; }
                .room-owner-placeholder { background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: #fff; }
                .room-info-text { flex: 1; min-width: 0; }
                .room-info-name { color: var(--text-primary); font-weight: 900; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
                /* Oda ad\u0131 t\u0131klanabilir olunca pointer + hafif parlaklık */
                .room-info-name-clickable { cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; gap: 4px; }
                .room-info-name-clickable:hover { opacity: 0.75; }
                .room-info-name-clickable:active { opacity: 0.55; transform: scale(0.97); }
                .room-info-meta { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; margin-top: 4px; }
                .rim-chip { padding: 2px 7px; border-radius: 8px; font-size: 9px; font-weight: 800; display: flex; align-items: center; gap: 3px; white-space: nowrap; flex-shrink: 0; }
                .rim-owner { background: rgba(168,85,247,0.12); color: #c084fc; border: 1px solid rgba(168,85,247,0.2); }
                .rim-viewers { background: rgba(59,130,246,0.12); color: #93c5fd; border: 1px solid rgba(59,130,246,0.2); }
                .rim-seats { background: rgba(34,197,94,0.12); color: #86efac; border: 1px solid rgba(34,197,94,0.2); }
                .rim-followers { background: rgba(245,158,11,0.12); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }

                /* Boost ilerleme satırı */
                .boost-progress-row { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
                .boost-lv-badge { padding: 2px 7px; border-radius: 8px; font-size: 9px; font-weight: 900; flex-shrink: 0; }
                .boost-bar-wrap { flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 99px; position: relative; overflow: hidden; }
                .boost-bar-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease; }
                .boost-bar-label { font-size: 8px; font-weight: 800; color: #555; flex-shrink: 0; white-space: nowrap; }


                .seat-toggle-row { display: flex; justify-content: center; padding: 4px 20px; position: relative; z-index: 20; opacity: 0.8; }
                .seat-toggle-btn { background: rgba(0,0,0,0.5); border: none; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; transition: 0.2s; }
                .seat-toggle-btn:hover { background: rgba(0,0,0,0.8); }

                /* ===== KOLTUK IZGARA DÜZENLERİ ===== */
                
                /* ===== DUYURU PANOSU SİSTEMİ (Defter Stili) ===== */
                .notebook-style {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 280px;
                    background: linear-gradient(135deg, rgba(20,20,30,0.95), rgba(30,30,45,0.95));
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(139, 92, 246, 0.4);
                    border-left: 8px solid #8b5cf6;
                    border-radius: 0 16px 16px 0;
                    box-shadow: 10px 10px 30px rgba(0,0,0,0.6);
                    z-index: 50;
                    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    padding-left: 14px;
                }
                .notebook-style.collapsed {
                    transform: translateY(-50%) translateX(calc(-100% + 56px));
                    cursor: pointer;
                }
                .notebook-style.collapsed:hover {
                    transform: translateY(-50%) translateX(calc(-100% + 64px));
                }
                .notebook-rings {
                    position: absolute;
                    left: 2px;
                    top: 15px;
                    bottom: 15px;
                    width: 10px;
                    background-image: radial-gradient(circle, #888 40%, transparent 50%);
                    background-size: 10px 24px;
                    opacity: 0.6;
                }
                .notebook-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 12px 12px 4px;
                }
                .notebook-toggle {
                    background: none;
                    border: none;
                    color: #a78bfa;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .notebook-content {
                    padding: 0 12px 16px 4px;
                    animation: lm-fade-in 0.3s ease;
                }

                /* ===== KOLTUK IZGARA DÜZENLERİ ===== */
                .seat-grid-container-4x4 {
                    position: relative; z-index: 10;
                    padding: 12px 16px 0;
                    display: grid;
                    gap: 10px;
                    align-content: start;
                    transition: all 0.3s ease;
                }
                /* 8 Koltuk: 4+4 (2 sütun × 4 satır) - aragını büykük göstermek için */
                .seat-grid-container-4x4.layout-8 {
                    grid-template-columns: repeat(4, 1fr);
                    grid-template-rows: repeat(2, auto);
                }
                /* 12 Koltuk: 4+4+4 (4 sütun × 3 satır) */
                .seat-grid-container-4x4.layout-12 {
                    grid-template-columns: repeat(4, 1fr);
                    grid-template-rows: repeat(3, auto);
                }
                /* 16 Koltuk: 4x4 */
                .seat-grid-container-4x4.layout-16 {
                    grid-template-columns: repeat(4, 1fr);
                    grid-template-rows: repeat(4, auto);
                    gap: 8px;
                    padding: 8px 12px;
                }

                .seat-collapsed .seat-grid-container-4x4 { display: none; }
                .seat-collapsed .chat-area-v9 { flex: 1; max-height: none; overflow-y: auto; }
                
                .layout-grid-fixed { display: flex; justify-content: center; width: 100%; }
                .layout-preview-box { 
                    background: rgba(139, 92, 246, 0.1); 
                    border: 1px solid #8b5cf6; 
                    color: #fff; 
                    padding: 20px; 
                    border-radius: 20px; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    gap: 10px; 
                    width: 100%;
                }
                .layout-preview-box i { font-size: 28px; }

                /* Mobil Uyumluluk */
                @media (max-width: 480px) {
                    .seat-grid-container-4x4 { grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 10px; }
                }

                .chat-area-v9 { flex: 1; position: relative; z-index: 10; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
                .chat-area-v9::-webkit-scrollbar { width: 4px; }
                .chat-area-v9::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.2); border-radius: 10px; }
                
                .bubble-v9 { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards; max-width: 85%; }
                .bubble-v9.chat .msg-inner { display: flex; gap: 10px; align-items: flex-start; background: var(--glass-bg-alt); padding: 10px 14px; border-radius: 18px; transition: 0.3s; border: 1px solid var(--glass-border); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .bubble-v9.chat:hover .msg-inner { background: var(--glass-bg-accent); border-color: rgba(139, 92, 246, 0.3); }
                
                /* BUBBLE THEMES & ANIMATIONS */
                .bubble-classic .msg-inner { border-left: 3px solid var(--purple-main); }
                
                .bubble-neon .msg-inner { 
                    border: 1px solid rgba(236,72,153,0.3); 
                    box-shadow: 0 0 10px rgba(236,72,153,0.1); 
                    animation: neonGlow 2s infinite alternate; 
                }
                @keyframes neonGlow { 
                    from { box-shadow: 0 0 5px rgba(236,72,153,0.1); border-color: rgba(236,72,153,0.2); }
                    to { box-shadow: 0 0 15px rgba(236,72,153,0.3); border-color: rgba(236,72,153,0.5); }
                }

                .bubble-love .msg-inner { 
                    border: 1px solid rgba(239,68,68,0.2); 
                    animation: loveFloat 3s infinite ease-in-out;
                }
                @keyframes loveFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }

                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.9) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .chat-avatar { width: 24px; height: 24px; border-radius: 8px; }
                .msg-content { display: flex; flex-direction: column; }
                .uname { font-weight: 900; font-size: 11px; margin-bottom: 2px; }
                .utext { color: var(--text-primary); font-size: 12px; font-weight: 600; line-height: 1.3; }
                .bubble-v9.system { display: flex; justify-content: center; }
                .sys-inner { display: inline-flex; align-items: center; gap: 6px; background: var(--glass-bg-accent); padding: 6px 14px; border-radius: 999px; font-size: 10px; font-weight: 800; color: var(--text-dim); border: 1px solid var(--glass-border); }
                .sys-icon { font-size: 11px; }

                .footer-v13 { padding: 10px 15px 15px; position: relative; z-index: 2000; }
                .footer-content { display: flex; gap: 8px; align-items: center; background: var(--glass-bg-alt); backdrop-filter: blur(20px); padding: 8px; border-radius: 20px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-small); overflow: visible !important; }
                .control-group-v2 { position: relative; display: flex; align-items: center; overflow: visible; }
                .main-media-toggle { background: var(--purple-main) !important; color: #fff !important; border: none !important; z-index: 2; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .main-media-toggle.active { transform: rotate(90deg); background: #333 !important; }
                .media-expandable-group { 
                    position: absolute; bottom: 0; right: 0; 
                    display: flex; flex-direction: column; gap: 8px; 
                    opacity: 0; visibility: hidden; pointer-events: none; 
                    transform: translateY(0); transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    z-index: 10001;
                }
                .media-expandable-group.expanded { 
                    opacity: 1; visibility: visible; pointer-events: auto; 
                    transform: translateY(-52px); 
                }
                .control-btn { width: 38px; height: 38px; border-radius: 14px; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
                .control-btn:active { transform: scale(0.9); }
                .control-btn.active { background: #22c55e; border-color: #22c55e; color: #fff; }
                .input-wrap { flex: 1; height: 38px; background: var(--bg-deep); border-radius: 14px; display: flex; align-items: center; padding: 0 4px 0 10px; border: 1px solid var(--border); }
                .input-wrap input { flex: 1; background: transparent; border: none; color: var(--text-primary); outline: none; font-size: 12px; font-weight: 600; }
                .send-btn { width: 30px; height: 30px; border-radius: 10px; background: var(--premium-gradient); border: none; color: #fff; }
                .leave-btn { width: 38px; height: 38px; border-radius: 14px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.1); }

                .full-screen-video { position: fixed; inset: 0; z-index: 3000; background: #000; }
                .close-full-video { position: absolute; top: 50px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.5); color: #fff; border: none; font-size: 20px; }

                .action-panel-bottom { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-radius: 24px 24px 0 0; padding: 24px; animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 2001; box-shadow: 0 -10px 40px rgba(0,0,0,0.1); border-top: 1px solid var(--border); }
                .panel-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
                .panel-avatar { width: 64px; height: 64px; border-radius: 24px; object-fit: cover; border: 2px solid var(--border); }
                .panel-title h3 { margin: 0; color: var(--text-primary); font-size: 20px; font-weight: 950; }
                .panel-title p { margin: 4px 0 0; color: var(--text-dim); font-size: 13px; font-weight: 700; }
                
                .user-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
                
                .action-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-secondary); padding: 16px; border-radius: 16px; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.2s; }
                .action-btn i { font-size: 20px; color: var(--purple-main); }
                .action-btn:active { transform: scale(0.95); background: var(--bg-deep); }
                
                .action-btn.warning { background: rgba(234, 179, 8, 0.1); color: #eab308; border-color: rgba(234, 179, 8, 0.1); }
                .action-btn.warning i { color: #eab308; }
                
                .action-btn.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.1); }
                .action-btn.danger i { color: #ef4444; }

                .panel-cancel { width: 100%; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-dim); padding: 16px; border-radius: 16px; font-weight: 800; margin-top: 20px; cursor: pointer; }

                /* Takıpçi satırı */
                .follower-row { display: flex; align-items: center; gap: 12px; background: var(--bg-primary); padding: 10px 14px; border-radius: 14px; border: 1px solid var(--border); }
                .follower-avatar { width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 15px; flex-shrink: 0; overflow: hidden; }
                
                .seat-mute-icon {
                    position: absolute; top: -6px; right: -6px; width: 22px; height: 22px;
                    background: #ef4444; border: 2px solid #050505; color: #fff;
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 10px; z-index: 10; box-shadow: 0 4px 8px rgba(0,0,0,0.5);
                }

                /* Minimal Toast Notification */
                .custom-toast {
                    position: fixed;
                    top: 100px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(17, 17, 17, 0.9);
                    border: 1px solid rgba(168, 85, 247, 0.4);
                    color: #fff;
                    padding: 10px 24px;
                    border-radius: 30px;
                    font-size: 12px;
                    font-weight: 800;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    z-index: 10000;
                    backdrop-filter: blur(8px);
                    animation: toastSlideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes toastSlideDown {
                    from { opacity: 0; transform: translate(-50%, -20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

                /* ===== SHARE MODAL STYLES ===== */
                .share-modal-v9 { max-width: 440px !important; }
                .share-preview-card { background: var(--bg-primary); border-radius: 20px; padding: 16px; border: 1px solid var(--border); }
                .spc-msg-input label { display: block; font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
                .spc-msg-input textarea { width: 100%; background: var(--bg-deep); border: 1px solid var(--border); border-radius: 12px; padding: 12px; color: var(--text-primary); font-size: 13px; font-weight: 600; resize: none; height: 70px; outline: none; transition: 0.2s; }
                .spc-msg-input textarea:focus { border-color: var(--purple-main); background: var(--bg-card); }
                
                .spc-room-card { margin-top: 16px; background: var(--bg-card); border-radius: 16px; overflow: hidden; border: 1px solid var(--border); display: flex; align-items: center; padding: 10px; gap: 12px; }
                .spc-room-visual { width: 50px; height: 50px; border-radius: 12px; position: relative; overflow: hidden; flex-shrink: 0; }
                .spc-room-visual img { width: 100%; height: 100%; object-fit: cover; }
                .spc-room-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; font-size: 20px; }
                .spc-room-badges { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; opacity: 0; transition: 0.3s; }
                .spc-room-card:hover .spc-room-badges { opacity: 1; }
                .spc-room-badges span { font-size: 8px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 2px; }
                
                .spc-room-info { flex: 1; min-width: 0; }
                .spc-room-name { color: var(--text-primary); font-weight: 900; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .spc-room-owner { color: var(--text-dim); font-size: 10px; font-weight: 700; margin-top: 2px; }
                .spc-room-join-tag { font-size: 10px; font-weight: 900; color: var(--purple-main); display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--glass-bg-accent); border-radius: 8px; }

                .share-actions-v9 { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
                .share-btn-main { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; border-radius: 16px; font-weight: 800; font-size: 14px; cursor: pointer; border: none; transition: 0.2s; }
                .share-btn-main:active { transform: scale(0.97); }
                .share-btn-main.post { background: var(--premium-gradient); color: #fff; box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3); }
                .share-btn-main.link { background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); }
                .share-btn-main i { font-size: 18px; }

                @keyframes mentionPulse {
                    from { opacity: 0.8; transform: scale(1); }
                    to { opacity: 1; transform: scale(1.02); }
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .mention-suggester {
                    position: absolute; bottom: 50px; left: 0; right: 0;
                    background: var(--bg-card); backdrop-filter: blur(20px);
                    border-radius: 16px; border: 1px solid var(--purple-main);
                    padding: 8px; z-index: 100; box-shadow: var(--shadow-premium);
                    animation: slideUp 0.2s ease-out;
                }
                .mention-item {
                    display: flex; alignItems: center; gap: 10px; padding: 10px;
                    border-radius: 12px; cursor: pointer; transition: 0.2s;
                }
                .mention-item:hover { background: var(--glass-bg-accent); }
                .mention-item img { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--purple-main); }
                .mention-item span { color: var(--text-primary); font-size: 13px; font-weight: 800; }
            `}</style>
        </div>
    );
}
