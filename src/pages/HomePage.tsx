import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../pb';
import { useLanguage } from '../context/LanguageContext';


/**
 * =========================================================================
 *  LOVEMATCH V4 - PREMIUM HOME (SUGO / SOMATCH STYLE)
 *  Design: Dark Velvet / Glassmorphism / Premium Cards
 * =========================================================================
 */

const Typewriter = ({ words }: { words: string[] }) => {
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [currentText, setCurrentText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const currentWord = words[currentWordIndex];

        if (isDeleting) {
            timer = setTimeout(() => {
                setCurrentText(prev => prev.slice(0, -1));
                if (currentText.length <= 1) { // Prevents empty state lingering too long
                    setIsDeleting(false);
                    setCurrentWordIndex((prev) => (prev + 1) % words.length);
                }
            }, 70); // Yavaşlatılmış silme
        } else {
            timer = setTimeout(() => {
                setCurrentText(currentWord.slice(0, currentText.length + 1));
                if (currentText === currentWord) {
                    timer = setTimeout(() => setIsDeleting(true), 3500); // Daha uzun süre ekranda kalsın
                }
            }, 120); // Yavaşlatılmış yazma
        }
        return () => clearTimeout(timer);
    }, [currentText, isDeleting, currentWordIndex, words]);

    return (
        <span style={{ borderRight: '3px solid #a78bfa', paddingRight: '4px', animation: 'blink 1s step-end infinite', textShadow: '0 0 15px rgba(167, 139, 250, 0.6)' }}>
            {currentText}
        </span>
    );
};

export default function HomePage({ onOpenParty, onOpen1v1Match }: { onOpenParty: () => void, onOpen1v1Match: () => void }) {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');


    const [showPostModal, setShowPostModal] = useState(false);
    const [newPostText, setNewPostText] = useState('');
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);

    const { t } = useLanguage();
    const categories = ['all', 'popular', 'new', 'nearby'];


    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleCreatePost = async () => {
        if (!newPostText.trim() && !selectedImage) return;
        setIsPosting(true);
        try {
            // Resim varsa FormData ile gönder (dosya yükleme zorunluluğu)
            if (selectedImage) {
                const formData = new FormData();
                formData.append('content', newPostText.trim());
                formData.append('author', pb.authStore.model?.id || '');
                formData.append('image', selectedImage);
                await pb.collection('posts').create(formData);
            } else {
                // Sadece metin varsa JSON ile gönder (daha güvenilir)
                await pb.collection('posts').create({
                    content: newPostText.trim(),
                    author: pb.authStore.model?.id || '',
                    likes: [],
                    comments: [],
                });
            }

            setNewPostText('');
            setSelectedImage(null);
            setImagePreview(null);
            setShowPostModal(false);
            fetchData(); // Postu anında listele
        } catch (err: any) {
            console.error('[Post] Oluşturma hatası:', err);
            // PocketBase hata detayını göster
            const detail = err?.data?.data ? JSON.stringify(err.data.data) : err?.message || 'Bilinmeyen hata';
            alert(`Paylaşım başarısız! \n${detail}`);
        } finally {
            setIsPosting(false);
        }
    };

    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    const handleLikePost = async (postId: string) => {
        try {
            const post = posts.find(p => p.id === postId);
            if (!post) return;

            const userId = pb.authStore.model?.id;
            const likes = post.likes || [];

            let newLikes;
            if (likes.includes(userId)) {
                newLikes = likes.filter((id: string) => id !== userId);
            } else {
                newLikes = [...likes, userId];
            }

            // Optimistic update
            setPosts(posts.map(p => p.id === postId ? { ...p, likes: newLikes } : p));

            await pb.collection('posts').update(postId, { likes: newLikes });
        } catch (err) {
            console.error("Like error:", err);
            fetchData(); // Revert on error
        }
    };

    const handleDoubleTap = useCallback((postId: string) => {
        handleLikePost(postId);
    }, [posts]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Aktif kullanıcıları sadece animasyonda kullanmak için getir
            const userList = await pb.collection('users').getList(1, 10, {
                sort: '-updated',
                filter: `id != "${pb.authStore.model?.id}" && avatar != ""`
            });
            setUsers(userList.items);

            // Feed Filtreleme Mantığı
            let sortOrder = '-created';
            let filterQuery = '';

            if (activeCategory === 'popular') {
                sortOrder = '-updated';
                filterQuery = 'likes != null';
            } else if (activeCategory === 'new') {
                sortOrder = '-created';
            } else if (activeCategory === 'nearby') {
                sortOrder = 'created';
            }


            const postList = await pb.collection('posts').getList(1, 15, {
                sort: sortOrder,
                expand: 'author',
                filter: filterQuery
            });
            setPosts(postList.items);
        } catch (e) {
            console.error("Home fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, activeCategory]); // searchQuery ve activeCategory değişince tetikle

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div style={{
            minHeight: '100%',
            background: 'var(--bg-deep)',
            paddingBottom: 100,
            overflowX: 'hidden'
        }}>
            {/* --- Premium Header --- */}
            <header style={{
                padding: '50px 20px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                animation: 'lm-slide-down 0.5s ease'
            }}>
                <div>
                    {showSearch ? (
                        <input
                            autoFocus
                            placeholder={t('search_user')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => !searchQuery && setShowSearch(false)}
                            style={{
                                background: 'var(--glass-bg-alt)',
                                border: 'none',
                                borderRadius: 20,
                                padding: '8px 16px',
                                color: 'var(--text-primary)',
                                width: 200,
                                outline: 'none'
                            }}
                        />
                    ) : (
                        <h1 style={{
                            fontSize: 24,
                            fontWeight: 900,
                            margin: 0,
                            color: 'var(--text-primary)',
                            letterSpacing: '-1px'
                        }}>{t('discover')}</h1>
                    )}

                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div onClick={() => setShowPostModal(true)} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--premium-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(124, 77, 255, 0.4)' }}>
                        <i className="fa-solid fa-plus" style={{ fontSize: 18, color: '#fff' }}></i>
                    </div>
                    <div onClick={() => setShowSearch(!showSearch)} style={{ width: 40, height: 40, borderRadius: '50%', background: showSearch ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}></i>
                    </div>
                    <div onClick={() => {
                        setShowNotifications(!showNotifications);
                        // Fetch notifications logic here if needed
                    }} style={{ width: 40, height: 40, borderRadius: '50%', background: showNotifications ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', position: 'relative' }}>
                        <i className="fa-solid fa-bell" style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}></i>
                        {notifications.length > 0 && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} />}
                    </div>
                </div>
            </header>

            {/* Notifications Dropdown */}
            {showNotifications && (
                <div style={{
                    position: 'absolute', top: 80, right: 20, width: 300, background: 'var(--bg-card)',
                    borderRadius: 16, padding: 16, zIndex: 100, border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-premium)', animation: 'lm-slide-down 0.2s ease'
                }}>
                    <h3 style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{t('notifications')}</h3>
                    {notifications.length === 0 ? (
                        <p style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>{t('no_new_notifications')}</p>
                    ) : (

                        notifications.map((n, i) => (
                            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #333', fontSize: 12, color: '#ccc' }}>
                                {n.message}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* --- Hero Action Header --- */}
            <section style={{ margin: '14px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Dynamic Text Area */}
                <div style={{ padding: '0 8px', textAlign: 'left' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.5px', opacity: 0.9 }}>
                        <Typewriter words={[t('typewriter_1'), t('typewriter_2'), t('typewriter_3')]} />
                    </h2>
                </div>

                {/* Sleek Horizontal Action Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Inline CSS for the animations to avoid duplicate classes */}
                    <style>{`
                        @keyframes floatUser1 {
                            0% { transform: translate(0, 0) scale(1); }
                            25% { transform: translate(120px, 30px) scale(1.1); }
                            50% { transform: translate(60px, 50px) scale(0.9); }
                            75% { transform: translate(20px, 30px) scale(1.05); }
                            100% { transform: translate(0, 0) scale(1); }
                        }
                        @keyframes floatUser2 {
                            0% { transform: translate(0, 0) scale(1); }
                            33% { transform: translate(-100px, 40px) scale(0.9); }
                            66% { transform: translate(-40px, -10px) scale(1.1); }
                            100% { transform: translate(0, 0) scale(1); }
                        }
                        @keyframes floatUser3 {
                            0% { transform: translate(0, 0) scale(1); }
                            25% { transform: translate(80px, -20px) scale(1.1); }
                            50% { transform: translate(140px, 10px) scale(0.9); }
                            75% { transform: translate(50px, 40px) scale(1); }
                            100% { transform: translate(0, 0) scale(1); }
                        }
                        @keyframes floatHeartRoom {
                            0% { transform: translateY(0) scale(0.8) rotate(0deg); opacity: 0; }
                            20% { opacity: 0.6; }
                            80% { opacity: 0.6; }
                            100% { transform: translateY(-70px) scale(1.2) rotate(20deg); opacity: 0; }
                        }
                    `}</style>
                    <div
                        onClick={onOpen1v1Match}
                        style={{
                            position: 'relative', overflow: 'hidden', padding: '16px 20px',
                            background: 'rgba(236, 72, 153, 0.08)',
                            border: '1.5px solid rgba(236, 72, 153, 0.4)',
                            borderRadius: '24px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                            boxShadow: '0 8px 20px rgba(236, 72, 153, 0.1)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        {/* Floating Avatars Overlay */}
                        {users.slice(0, 3).map((u, i) => (
                            <div key={u.id} style={{
                                position: 'absolute',
                                width: 26, height: 26, borderRadius: '50%',
                                backgroundImage: `url(${u.avatar ? pb.files.getUrl(u, u.avatar) : 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + u.id})`,
                                backgroundSize: 'cover', backgroundPosition: 'center',
                                border: '1px solid rgba(255,255,255,0.4)',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                opacity: 0.7,
                                top: i === 0 ? '5px' : i === 1 ? '40px' : '20px',
                                left: i === 0 ? '10px' : i === 1 ? '70%' : '30%',
                                animation: `floatUser${i + 1} ${12 + i * 2}s linear infinite`,
                                pointerEvents: 'none',
                                zIndex: 0
                            }} />
                        ))}

                        <div style={{ position: 'absolute', top: '50%', right: -20, transform: 'translateY(-50%)', width: 80, height: 80, background: '#ec4899', borderRadius: '50%', filter: 'blur(35px)', opacity: 0.4 }} />
                        <div style={{
                            width: 50, height: 50, borderRadius: 18, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
                            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)', zIndex: 1
                        }}>⚡</div>
                        <div style={{ flex: 1, zIndex: 1 }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 16, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {t('fast_match')}
                                <span style={{ padding: '2px 6px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: 9, fontWeight: 800 }}>{t('live')}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t('find_soulmate')}</div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, zIndex: 1 }}></i>
                    </div>

                    <div
                        onClick={onOpenParty}
                        style={{
                            position: 'relative', overflow: 'hidden', padding: '16px 20px',
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1.5px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: '24px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                            boxShadow: '0 8px 20px rgba(56, 189, 248, 0.1)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        {/* Floating Hearts Overlay */}
                        {[...Array(6)].map((_, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                fontSize: 14 + (i % 3) * 4,
                                color: i % 2 === 0 ? '#ec4899' : '#8b5cf6',
                                left: `${15 + i * 15}%`,
                                bottom: '-20px',
                                opacity: 0,
                                animation: `floatHeartRoom ${3 + (i % 3)}s ease-in infinite`,
                                animationDelay: `${i * 0.4}s`,
                                pointerEvents: 'none',
                                zIndex: 0,
                                filter: 'drop-shadow(0 0 5px rgba(236,72,153,0.5))'
                            }}>
                                {i % 3 === 0 ? '✨' : '♥️'}
                            </div>
                        ))}

                        <div style={{ position: 'absolute', top: '50%', right: -20, transform: 'translateY(-50%)', width: 80, height: 80, background: '#38bdf8', borderRadius: '50%', filter: 'blur(35px)', opacity: 0.4 }} />
                        <div style={{
                            width: 50, height: 50, borderRadius: 18, background: 'linear-gradient(135deg, #38bdf8, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
                            boxShadow: '0 4px 12px rgba(56, 189, 248, 0.4)', zIndex: 1
                        }}>🎉</div>
                        <div style={{ flex: 1, zIndex: 1 }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 16, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {t('party_room')}
                                <span style={{ padding: '2px 6px', borderRadius: 8, background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa', fontSize: 9, fontWeight: 800 }}>{t('open')}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t('join_fun')}</div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, zIndex: 1 }}></i>
                    </div>
                </div>
            </section>


            {/* --- Content Filter --- */}
            <div className="no-scrollbar" style={{ display: 'flex', gap: 10, padding: '0 20px', marginBottom: 20 }}>
                {
                    categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 20,
                                border: '1px solid ' + (activeCategory === cat ? 'var(--purple-main)' : 'var(--glass-border)'),
                                background: activeCategory === cat ? 'var(--premium-gradient)' : 'var(--glass-bg)',
                                color: activeCategory === cat ? '#fff' : 'var(--text-primary)',
                                fontSize: 13,
                                fontWeight: 800,
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer',
                                boxShadow: activeCategory === cat ? 'var(--shadow-premium)' : 'none'
                            }}
                        >
                            {cat}
                        </button>
                    ))
                }
            </div>

            {/* --- Social Feed (Lovematch Spirit) --- */}
            < section style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {
                    loading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} style={{ height: 200, borderRadius: 28, background: 'var(--glass-bg)', animation: 'pulse 1.5s infinite' }} />
                        ))
                    ) : posts.map((post, i) => (
                        <div
                            key={post.id}
                            onDoubleClick={() => handleDoubleTap(post.id)}
                            style={{
                                padding: '16px',
                                background: 'var(--bg-card)',
                                borderRadius: 24,
                                border: '1px solid var(--border)',
                                animation: `lm-slide-up 0.6s ease ${i * 0.1}s backwards`
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <div
                                    onClick={() => navigate('/profile/' + post.expand?.author?.id)}
                                    style={{
                                        width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-card)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                                        overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {post.expand?.author?.avatar ? (
                                        <img src={pb.files.getUrl(post.expand.author, post.expand.author.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="author avatar" />
                                    ) : (
                                        <i className="fa-solid fa-user" style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)' }}></i>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>{post.expand?.author?.username || t('anonymous')}</div>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
                                        {new Date(post.created).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)',
                                marginBottom: 12, fontWeight: 500
                            }}>
                                {post.content.startsWith('[ROOM_INVITE]') ? (() => {
                                    try {
                                        const data = JSON.parse(post.content.replace('[ROOM_INVITE]', ''));
                                        return (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); onOpenParty(); }}
                                                style={{
                                                    background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.15) 0%, rgba(0, 0, 0, 0.4) 100%)',
                                                    borderRadius: 20,
                                                    padding: 20,
                                                    border: '1px solid rgba(124, 77, 255, 0.3)',
                                                    cursor: 'pointer',
                                                    marginTop: 8,
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    transition: '0.3s'
                                                }}
                                                className="room-invite-card"
                                            >
                                                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: 'rgba(124, 77, 255, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }} />

                                                <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <i className="fa-solid fa-envelope-open-text"></i> {t('room_invite')}
                                                </div>

                                                <div style={{ color: 'var(--text-primary)', fontSize: 13, marginBottom: 15, fontStyle: 'italic', opacity: 0.9 }}>
                                                    "{data.message || t('invites_you')}"
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #7c4dff, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                                        {data.ownerAvatar ? <img src={data.ownerAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} /> : '🎙️'}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.roomName}</div>
                                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, marginTop: 2 }}>@{data.ownerName} &bull; {t('room_owner')}</div>
                                                    </div>
                                                    <div style={{
                                                        background: 'var(--premium-gradient)',
                                                        color: '#fff',
                                                        padding: '8px 14px',
                                                        borderRadius: 12,
                                                        fontSize: 11,
                                                        fontWeight: 900,
                                                        boxShadow: '0 4px 12px rgba(124, 77, 255, 0.3)'
                                                    }}>
                                                        {t('join_btn')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } catch (e) {
                                        return post.content;
                                    }
                                })() : post.content}
                            </div>

                            {post.image && !post.content.startsWith('[ROOM_INVITE]') && (
                                <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
                                    <img src={pb.files.getUrl(post, post.image)} alt="post image" style={{ width: '100%', display: 'block' }} />
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div
                                    onClick={() => handleLikePost(post.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: post.likes?.includes(pb.authStore.model?.id) ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    <i className={`fa-${post.likes?.includes(pb.authStore.model?.id) ? 'solid' : 'regular'} fa-heart`} style={{ fontSize: 16 }}></i> {post.likes?.length || 0}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700, cursor: 'pointer' }}>
                                    <i className="fa-regular fa-comment" style={{ fontSize: 16 }}></i> {post.comments?.length || 0}
                                </div>
                            </div>
                        </div>
                    ))}
            </section >

            {/* --- Post Modal --- */}
            {
                showPostModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={() => setShowPostModal(false)}>
                        <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-deep)', borderRadius: '24px 24px 0 0', padding: 24, animation: 'lm-slide-up 0.3s ease', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{t('new_post')}</h3>
                                <button onClick={() => setShowPostModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16 }}><i className="fa-solid fa-xmark"></i></button>
                            </div>
                            <textarea
                                value={newPostText}
                                onChange={e => setNewPostText(e.target.value)}
                                placeholder={t('share_thought')}
                                style={{ width: '100%', height: 120, background: 'var(--bg-deep)', borderRadius: 16, border: '1px solid var(--border)', color: 'var(--text-primary)', padding: 16, fontSize: 16, resize: 'none', outline: 'none', marginBottom: 12 }}
                            />

                            {imagePreview && (
                                <div style={{ position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <img src={imagePreview} style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} alt="preview" />
                                    <button
                                        onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                                        style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    >
                                        <i className="fa-solid fa-xmark" style={{ fontSize: 12 }}></i>
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                                    <i className="fa-solid fa-image" style={{ color: 'var(--purple-light)' }}></i>
                                    <span>{t('add_image')}</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                                </label>
                            </div>

                            <button
                                onClick={handleCreatePost}
                                disabled={isPosting || (!newPostText.trim() && !selectedImage)}
                                style={{ width: '100%', padding: 16, borderRadius: 16, background: 'var(--premium-gradient)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, opacity: (!newPostText.trim() && !selectedImage || isPosting) ? 0.5 : 1, boxShadow: '0 8px 20px rgba(124, 77, 255, 0.3)' }}
                            >
                                {isPosting ? t('sharing') : t('share')}
                            </button>
                        </div>
                    </div>
                )
            }
            <style>{`
                .hero-cards {
                    padding: 0 20px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .hero-card {
                    position: relative;
                    border-radius: 26px;
                    padding: 20px 16px 18px;
                    overflow: hidden;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    min-height: 140px;
                    border: 1px solid rgba(255,255,255,0.12);
                    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
                    animation: heroFloat 4s ease-in-out infinite;
                }

                .hero-card:active {
                    transform: scale(0.98);
                }

                .hero-card-match {
                    background: radial-gradient(circle at top, rgba(255, 255, 255, 0.25), transparent 60%),
                        linear-gradient(135deg, #ff3d81 0%, #ff8cc7 100%);
                }

                .hero-card-party {
                    background: radial-gradient(circle at top, rgba(255, 255, 255, 0.25), transparent 60%),
                        linear-gradient(135deg, #7c4dff 0%, #b388ff 100%);
                    animation-delay: 0.4s;
                }

                .hero-card-glow {
                    position: absolute;
                    inset: -30% -30% auto auto;
                    width: 120px;
                    height: 120px;
                    background: rgba(255,255,255,0.35);
                    filter: blur(30px);
                    animation: heroGlow 3s ease-in-out infinite;
                }

                .hero-card-sparkle {
                    position: absolute;
                    top: -10px;
                    right: -10px;
                    width: 80px;
                    height: 80px;
                    background: radial-gradient(circle, rgba(255,255,255,0.9), transparent 70%);
                    opacity: 0.6;
                    animation: heroSparkle 2.6s ease-in-out infinite;
                }

                .hero-card-content {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .hero-card-icon {
                    font-size: 32px;
                    margin-bottom: 8px;
                    animation: heroIconPulse 2s ease-in-out infinite;
                }

                .hero-card-title {
                    font-weight: 900;
                    font-size: 16px;
                    color: #fff;
                }

                .hero-card-sub {
                    font-size: 10px;
                    color: rgba(255,255,255,0.85);
                    font-weight: 700;
                }

                .hero-card-pill {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    border-radius: 999px;
                    font-size: 10px;
                    font-weight: 800;
                    color: #fff;
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.25);
                    z-index: 3;
                    backdrop-filter: blur(8px);
                }

                .hero-card-pill.alt {
                    background: rgba(255,255,255,0.2);
                    color: #1f1f1f;
                }

                .hero-card-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
                    animation: heroDot 1.5s ease-in-out infinite;
                }

                @keyframes heroFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }

                @keyframes heroGlow {
                    0%, 100% { opacity: 0.35; transform: scale(0.9); }
                    50% { opacity: 0.7; transform: scale(1.05); }
                }

                @keyframes heroSparkle {
                    0%, 100% { transform: rotate(0deg) scale(1); opacity: 0.6; }
                    50% { transform: rotate(15deg) scale(1.2); opacity: 0.9; }
                }

                @keyframes heroIconPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.08); }
                }

                @keyframes heroDot {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.4); }
                }

                @media (prefers-reduced-motion: reduce) {
                    .hero-card,
                    .hero-card-glow,
                    .hero-card-sparkle,
                    .hero-card-icon,
                    .hero-card-dot {
                        animation: none !important;
                    }
                }
            `}</style>
        </div >
    );
}
