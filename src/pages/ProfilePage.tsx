import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SocialService } from '../utils/social';
import { pb } from '../pb';
import { StoreService } from '../utils/store';
import { useLanguage } from '../context/LanguageContext';
const BUBBLE_STYLES = [
    { id: 'classic', name: 'Klasik', icon: <i className="fa-solid fa-square"></i>, class: 'bubble-classic', desc: 'Sade ve şık', color: '#8b5cf6' },
    { id: 'gold', name: 'Premium Altın', icon: <i className="fa-solid fa-crown"></i>, class: 'owner-glow', desc: 'Altın parlaklık', color: '#fbbf24' },
    { id: 'neon', name: 'Neon Siber', icon: <i className="fa-solid fa-bolt"></i>, class: 'bubble-neon', desc: 'Siber mavisi', color: '#06b6d4' },
    { id: 'love', name: 'Aşk Esintisi', icon: <i className="fa-solid fa-heart"></i>, class: 'bubble-love', desc: 'Pembe romantik', color: '#ec4899' },
    { id: 'forest', name: 'Doğa Huzuru', icon: <i className="fa-solid fa-leaf"></i>, class: 'bubble-forest', desc: 'Yeşil huzur', color: '#10b981' },
];

// ── Animated counter
function AnimNum({ value }: { value: number }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const step = Math.ceil(value / 20);
        const t = setInterval(() => {
            start = Math.min(start + step, value);
            setDisplay(start);
            if (start >= value) clearInterval(t);
        }, 40);
        return () => clearInterval(t);
    }, [value]);
    return <>{display.toLocaleString()}</>;
}

type SettingsPage = null | 'security' | 'privacy' | 'notifications' | 'help' | 'bubbles' | 'tags' | 'vip' | 'appearance';



export default function ProfilePage() {
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const { id: profileId } = useParams();
    const [userData, setUserData] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [followers, setFollowers] = useState<any[]>([]);
    const [following, setFollowing] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);

    // Modals
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showListModal, setShowListModal] = useState<{ type: 'followers' | 'following' | 'likes', data: any[] } | null>(null);
    const [settingsPage, setSettingsPage] = useState<SettingsPage>(null);
    const [editingPost, setEditingPost] = useState<any | null>(null);
    const [editPostContent, setEditPostContent] = useState('');
    const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
    // Tema durumu - localStorage'dan okuyoruz
    const [activeTheme, setActiveTheme] = useState<'dark' | 'light'>(
        () => (localStorage.getItem('app-theme') || 'dark') as 'dark' | 'light'
    );
    // Tema değişikliğinde body sınıfını güncelle
    const applyTheme = (t: 'dark' | 'light') => {
        setActiveTheme(t);
        localStorage.setItem('app-theme', t);
        if (t === 'light') document.body.classList.add('theme-light');
        else document.body.classList.remove('theme-light');
    };
    // Başlangıçta kaydedilen temayı uygula
    const [_themeApplied] = useState(() => {
        const saved = localStorage.getItem('app-theme');
        if (saved === 'light') document.body.classList.add('theme-light');
        return true;
    });
    const [viewProfileId, setViewProfileId] = useState<string | null>(null);
    const [likesModalPost, setLikesModalPost] = useState<any | null>(null);
    const [commentingPost, setCommentingPost] = useState<any | null>(null);


    // Edit fields
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editTags, setEditTags] = useState('');

    // Privacy / Notification prefs (local state only — extend to PocketBase as needed)
    const [notifMessages, setNotifMessages] = useState(true);
    const [notifMentions, setNotifMentions] = useState(true);
    const [notifActivity, setNotifActivity] = useState(false);
    const [privacyOnline, setPrivacyOnline] = useState(true);
    const [privacyProfile, setPrivacyProfile] = useState(false);
    const [timeLeft, setTimeLeft] = useState("");
    const [storePrice, setStorePrice] = useState("29,99 ₺");

    useEffect(() => {
        const handleBack = (e: Event) => {
            if (showEditModal) { setShowEditModal(false); e.preventDefault(); }
            else if (settingsPage) { setSettingsPage(null); e.preventDefault(); }
            else if (showSettingsModal) { setShowSettingsModal(false); e.preventDefault(); }
            else if (showListModal) { setShowListModal(null); e.preventDefault(); }
            else if (editingPost) { setEditingPost(null); e.preventDefault(); }
            else if (likesModalPost) { setLikesModalPost(null); e.preventDefault(); }
            else if (commentingPost) { setCommentingPost(null); e.preventDefault(); }
        };
        window.addEventListener('app-back-button', handleBack);
        return () => window.removeEventListener('app-back-button', handleBack);
    }, [showEditModal, settingsPage, showSettingsModal, showListModal, editingPost, likesModalPost, commentingPost]);

    useEffect(() => {
        if (viewProfileId) {
            navigate(`/profile/${viewProfileId}`);
            setViewProfileId(null);
        }
    }, [viewProfileId, navigate]);

    const fetchAll = async () => {
        const targetId = profileId || pb.authStore.model?.id;
        if (!targetId) return;
        setLoading(true);
        try {
            const user = await pb.collection('users').getOne(targetId);
            setUserData(user);
            setEditName(user.username || user.name || '');
            setEditBio(user.bio || 'LoveMatch macerama yeni başladım! 🎉');
            setEditTags(user.tags || 'müzik,oyun,seyahat');
            setSelectedBubble(user.bubbleStyle || 'classic');

            window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: user }));

            // Followers/Following — handle both array and CSV string format safely
            const parseSafe = (val: any): string[] => {
                if (!val) return [];
                if (Array.isArray(val)) return val.filter(Boolean);
                if (typeof val === 'string') {
                    if (val.startsWith('[') && val.endsWith(']')) {
                        try { return JSON.parse(val).filter(Boolean); } catch (e) { }
                    }
                    if (val.trim()) return val.split(',').map(v => v.trim()).filter(Boolean);
                }
                return [];
            };

            const fers = parseSafe(user.followers);
            const fing = parseSafe(user.following);
            setFollowers(fers);
            setFollowing(fing);

            // Sync authStore if viewing own profile
            if (targetId === pb.authStore.model?.id) {
                pb.authStore.save(pb.authStore.token, user);
            }

            if (pb.authStore.model) {
                const f = pb.authStore.model.following;
                const myFollowing = parseSafe(f);
                setIsFollowing(myFollowing.includes(targetId));
            }
            const postList = await pb.collection('posts').getList(1, 50, {
                filter: `author = "${targetId}"`,
                sort: '-created',
                expand: 'author'
            });
            setPosts(postList.items);
        } catch (e) { console.error('Fetch error:', e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, [profileId]);

    useEffect(() => {
        if (!userData?.isVIP || !userData?.vipUntil) return;

        const timer = setInterval(() => {
            const until = new Date(userData.vipUntil).getTime();
            const now = Date.now();
            const diff = until - now;

            if (diff <= 0) {
                setTimeLeft("Süreniz Doldu");
                clearInterval(timer);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            let str = "";
            if (days > 0) str += `${days}g `;
            str += `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            setTimeLeft(str);
        }, 1000);

        return () => clearInterval(timer);
    }, [userData?.isVIP, userData?.vipUntil]);

    useEffect(() => {
        if (settingsPage === 'vip') {
            const checkStore = async () => {
                const prod = await StoreService.getProduct('vip_01');
                if (prod && prod.price) {
                    setStorePrice(prod.price);
                }
            };
            checkStore();
        }
    }, [settingsPage]);

    // Listen for authStore changes to keep current user's profile synced
    useEffect(() => {
        const isMyProfile = !profileId || profileId === pb.authStore.model?.id;
        if (!isMyProfile) return;

        const unsubscribe = pb.authStore.onChange((_, model) => {
            if (model) {
                setUserData(model);
                const pSafe = (v: any): string[] => Array.isArray(v) ? v.filter(Boolean) : (typeof v === 'string' && v.trim() ? v.split(',').filter(Boolean) : []);
                const fing = pSafe(model.following);
                const fers = pSafe(model.followers);
                setFollowing(fing);
                setFollowers(fers);
            }
        }, true);
        return () => unsubscribe();
    }, [profileId]);

    const handleSaveProfile = async () => {
        if (!pb.authStore.model) return;
        const safeName = editName.trim();
        if (safeName.length < 2) { alert('Kullanıcı adı en az 2 karakter olmalı!'); return; }
        try {
            const fileInput = document.getElementById('avatar-file-input') as HTMLInputElement;
            const formData = new FormData();
            formData.append('username', safeName);
            formData.append('bio', editBio.trim());
            formData.append('tags', editTags.trim());

            if (fileInput?.files?.[0]) {
                formData.append('avatar', fileInput.files[0]);
            }

            const updated = await pb.collection('users').update(pb.authStore.model.id, formData);
            setUserData(updated);
            pb.authStore.save(pb.authStore.token, updated);
            window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updated }));
            setShowEditModal(false);
        } catch (e: any) {
            if (e?.data?.data?.username) {
                alert('Bu kullanıcı adı zaten alınmış!');
            } else {
                alert('Güncelleme hatası! Lütfen tekrar deneyin.');
            }
        }
    };

    const handleUpdateBubble = async () => {
        if (!pb.authStore.model || !selectedBubble) return;
        try {
            const updated = await pb.collection('users').update(pb.authStore.model.id, { bubbleStyle: selectedBubble });
            setUserData(updated);
            pb.authStore.save(pb.authStore.token, updated);
            window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updated }));
            alert('Sohbet balonun güncellendi! ✨');
        } catch (e) { alert('Hata oluştu!'); }
    };

    const handleUpdateTags = async () => {
        if (!pb.authStore.model) return;
        try {
            const updated = await pb.collection('users').update(pb.authStore.model.id, { tags: editTags });
            setUserData(updated);
            pb.authStore.save(pb.authStore.token, updated);
            window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updated }));
            alert('İlgi alanların güncellendi! ✨');
        } catch (e) { alert('Hata oluştu!'); }
    };



    const handleDeletePost = async (id: string) => {
        if (!confirm('Bu gönderiyi silmek istiyor musun?')) return;
        try {
            await pb.collection('posts').delete(id);
            setPosts(prev => prev.filter(p => p.id !== id));
        } catch (e) { alert('Silme hatası!'); }
    };

    const fetchUserList = async (ids: string[]) => {
        if (ids.length === 0) return [];
        try {
            // Support both PocketBase IDs and usernames (backward compat)
            const idFilters = ids.filter(v => v.length >= 10 && /^[a-z0-9]+$/i.test(v)).map(id => `id="${id}"`);
            const nameFilters = ids.filter(v => v.length < 10 || !/^[a-z0-9]+$/i.test(v)).map(u => `username="${u}"`);
            const allFilters = [...idFilters, ...nameFilters];
            if (allFilters.length === 0) return [];
            const res = await pb.collection('users').getFullList({
                filter: allFilters.join(' || ')
            });
            return res;
        } catch (e) { return []; }
    };

    const handleLogout = () => {
        if (!confirm('Çıkış yapmak istediğine emin misin?')) return;
        pb.authStore.clear();
        window.location.reload();
    };


    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 44, height: 44, border: '3px solid var(--purple)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Profil yükleniyor…</div>
        </div>
    );

    const tags = (userData?.tags || 'müzik,oyun,seyahat').split(',').filter(Boolean);

    return (
        <div className="page" style={{ background: 'var(--bg-deep)', overflowY: 'auto' }}>

            {/* ── COVER + AVATAR ── */}
            <div style={{ position: 'relative', height: 190 }}>
                <div style={{
                    height: 145,
                    background: `linear-gradient(135deg, ${BUBBLE_STYLES.find(b => b.id === userData?.bubbleStyle)?.color || userData?.color || '#8b5cf6'} 0%, var(--bg-deep) 100%)`,
                    position: 'relative', overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: `radial-gradient(circle at 20% 30%, ${BUBBLE_STYLES.find(b => b.id === userData?.bubbleStyle)?.color || userData?.color || '#8b5cf6'}40 0%, transparent 70%)`
                    }} />
                    {/* animated orbs */}
                    {[...Array(6)].map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            left: `${10 + i * 16}%`, top: `${10 + (i % 3) * 30}%`,
                            width: 60 + i * 10, height: 60 + i * 10,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.05)',
                            animation: `pulse ${2 + i * 0.4}s ease-in-out infinite`
                        }} />
                    ))}
                </div>

                {/* Avatar */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 24,
                    width: 88, height: 88, borderRadius: 28,
                    background: (userData?.color || 'var(--purple)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 44, border: '4px solid var(--bg-primary)',
                    boxShadow: `0 8px 24px ${userData?.color || '#8b5cf680'}`,
                    overflow: 'hidden',
                    outline: userData?.isVIP ? '3px solid #f59e0b' : 'none',
                    outlineOffset: userData?.isVIP ? '2px' : '0'
                }}>
                    {userData?.isVIP && (
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(245, 158, 11, 0.4), transparent 60%)', zIndex: 1, pointerEvents: 'none' }} />
                    )}
                    {userData?.avatar ? (
                        <img src={pb.files.getUrl(userData, userData.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <i className="fa-solid fa-user" style={{ color: 'rgba(255,255,255,0.2)' }}></i>
                    )}
                    <div style={{
                        position: 'absolute', bottom: 4, right: 4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#10b981', border: '2px solid var(--bg-primary)'
                    }} />
                </div>

                {/* Header buttons */}
                <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowSettingsModal(true)} style={{
                        width: 38, height: 38, borderRadius: 13,
                        background: 'var(--glass-bg-accent)', backdropFilter: 'blur(8px)',
                        border: '1px solid var(--glass-border)', color: 'var(--text-primary)',
                        cursor: 'pointer', fontSize: 16
                    }}>
                        <i className="fa-solid fa-cog"></i>
                    </button>
                    <button onClick={() => navigator.share?.({ url: window.location.href })} style={{
                        width: 38, height: 38, borderRadius: 13,
                        background: 'var(--glass-bg-accent)', backdropFilter: 'blur(8px)',
                        border: '1px solid var(--glass-border)', color: 'var(--text-primary)',
                        cursor: 'pointer', fontSize: 16
                    }}>
                        <i className="fa-solid fa-share-nodes"></i>
                    </button>
                </div>
            </div>

            {/* ── PROFILE INFO ── */}
            <div style={{ padding: '14px 24px 28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ fontSize: 24, fontWeight: 950, margin: 0, letterSpacing: '-0.8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {userData?.username || 'Kullanıcı'}
                            <div style={{ display: 'flex', gap: 4 }}>
                                {userData?.premiumBadge && (
                                    <div title="Premium Üye" style={{
                                        width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)', color: '#fff'
                                    }}>
                                        <i className="fa-solid fa-gem"></i>
                                    </div>
                                )}
                                {userData?.isVIP && (
                                    <div title="VIP Üye" style={{
                                        padding: '0 8px', height: 24, borderRadius: 8, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                                        color: '#000', fontSize: 10, fontWeight: 950, display: 'flex', alignItems: 'center', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'
                                    }}>VIP</div>
                                )}
                            </div>
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                @{userData?.username?.toLowerCase().replace(/\s/g, '_') || 'user'}
                            </div>
                            {userData?.isVIP && (
                                <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <i className="fa-solid fa-gem" style={{ fontSize: 10 }}></i> VIP AKTİF
                                </div>
                            )}
                        </div>
                    </div>
                    {(!profileId || profileId === pb.authStore.model?.id) ? (
                        <button onClick={() => setShowEditModal(true)} style={{
                            padding: '10px 20px', borderRadius: 20,
                            background: 'var(--purple)', border: 'none',
                            color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13
                        }}>{t('edit')}</button>
                    ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={async () => {
                                    try {
                                        const myId = pb.authStore.model?.id;
                                        if (!myId) return;

                                        if (isFollowing) {
                                            const targetId = userData?.id;
                                            if (!targetId) throw new Error('Kullanıcı bulunamadı');
                                            await SocialService.unfollowUser(targetId);
                                            setIsFollowing(false);
                                            // Update the display count on this profile
                                            setFollowers(prev => prev.filter(id => id !== myId));
                                            setToast({ message: 'Takipten çıkıldı', type: 'success' });
                                        } else {
                                            const targetId = userData?.id;
                                            if (!targetId) throw new Error('Takip edilecek kullanıcı bulunamadı');
                                            await SocialService.followUser(targetId);
                                            setIsFollowing(true);
                                            // Update the display count on this profile
                                            setFollowers(prev => [...prev.filter(id => id !== myId), myId]);
                                            setToast({ message: 'Takip edildi! 🎉', type: 'success' });
                                        }
                                        setTimeout(() => setToast(null), 3000);
                                    } catch (e: any) {
                                        setToast({ message: e.message || 'Hata oluştu!', type: 'error' });
                                        setTimeout(() => setToast(null), 3500);
                                        console.error(e);
                                    }
                                }}
                                style={{
                                    height: 42, padding: '0 24px', borderRadius: 21,
                                    background: isFollowing ? 'var(--glass-bg-alt)' : 'var(--purple)',
                                    border: isFollowing ? '1px solid var(--glass-border)' : 'none',
                                    color: isFollowing ? 'var(--text-primary)' : '#fff', fontWeight: 900, cursor: 'pointer', fontSize: 14,
                                    boxShadow: isFollowing ? 'none' : '0 8px 20px rgba(139, 92, 246, 0.3)',
                                    transition: '0.3s'
                                }}
                            >{isFollowing ? t('unfollow') : t('follow')}</button>
                            <button
                                onClick={() => navigate(`/chat?userId=${profileId}`)}
                                style={{
                                    height: 42, padding: '0 24px', borderRadius: 21,
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)', fontWeight: 900, cursor: 'pointer', fontSize: 14,
                                    transition: '0.3s'
                                }}
                            >Mesaj</button>
                        </div>
                    )}
                </div>

                {/* TOAST Rendering */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 3000, background: toast.type === 'success' ? '#10b981' : '#ef4444',
                        color: '#fff', padding: '12px 24px', borderRadius: 20, fontWeight: 800,
                        boxShadow: '0 8px 30px rgba(0,0,0,0.4)', animation: 'lm-slide-down 0.4s'
                    }}>
                        {toast.message}
                    </div>
                )}

                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
                    {userData?.bio || 'LoveMatch macerama yeni başladım! 🎉'}
                </p>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {tags.map((t: string) => (
                        <span key={t} style={{
                            padding: '5px 12px', background: 'rgba(139,92,246,0.12)',
                            color: 'var(--purple-light)', borderRadius: 12,
                            fontSize: 11, fontWeight: 700, border: '1px solid rgba(139,92,246,0.2)'
                        }}>#{t.trim()}</span>
                    ))}
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 26 }}>
                    {[
                        { val: posts.length, label: t('posts') || 'Gönderi', click: null },
                        {
                            val: followers.length, label: t('followers'), click: async () => {
                                const data = await fetchUserList(followers);
                                setShowListModal({ type: 'followers', data });
                            }
                        },
                        {
                            val: following.length, label: t('following_stat') || 'Takip', click: async () => {
                                const data = await fetchUserList(following);
                                setShowListModal({ type: 'following', data });
                            }
                        },
                    ].map((s, i) => (
                        <div key={i} onClick={s.click || undefined} style={{
                            textAlign: 'center', background: 'var(--glass-bg)',
                            borderRadius: 22, padding: '16px 8px',
                            border: '1px solid var(--glass-border)', cursor: s.click ? 'pointer' : 'default',
                            backdropFilter: 'blur(10px)', transition: 'all 0.3s'
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 950, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                                <AnimNum value={s.val} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 4 }}>
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── POSTS ── */}
            <div style={{ padding: '0 20px 30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>Paylaşımlarım</div>
                    <div style={{ fontSize: 11, color: 'var(--purple-light)', fontWeight: 700 }}>{posts.length} gönderi</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {posts.length === 0 ? (
                        <div className="lm-premium-card" style={{
                            padding: 40,
                            textAlign: 'center', border: '1px solid var(--glass-border)'
                        }}>
                            <div style={{ fontSize: 50, marginBottom: 15, opacity: 0.3 }}>📮</div>
                            <div style={{ fontSize: 15, fontWeight: 900 }}>Henüz gönderin yok</div>
                            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, fontWeight: 600 }}>Keşfet sayfasından bir şeyler paylaşmaya ne dersin?</p>
                        </div>
                    ) : posts.map(p => (
                        <div key={p.id} className="lm-premium-card" style={{
                            padding: 20,
                            animation: 'lm-slide-up 0.5s ease'
                        }}>
                            {/* Post header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <div onClick={() => setViewProfileId(userData?.id)} style={{
                                    width: 44, height: 44, borderRadius: 15, cursor: 'pointer',
                                    background: userData?.avatar ? 'transparent' : (userData?.color || 'var(--purple)'),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden'
                                }}>
                                    {userData?.avatar ? (
                                        <img src={pb.files.getUrl(userData, userData.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <i className="fa-solid fa-user" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }}></i>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                                        {userData?.username || 'Anonim'}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
                                        {new Date(p.created).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                {/* Edit/Delete actions for own profile */}
                                {(!profileId || profileId === pb.authStore.model?.id) && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <div onClick={() => { setEditingPost(p); setEditPostContent(p.content); }}
                                            style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--purple-light)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <i className="fa-solid fa-pen-to-square" style={{ fontSize: 13 }}></i>
                                        </div>
                                        <div onClick={() => handleDeletePost(p.id)}
                                            style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(239,68,68,0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(239,68,68,0.1)' }}>
                                            <i className="fa-solid fa-trash-can" style={{ fontSize: 13 }}></i>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Post content */}
                            <div
                                className={`post-content-wrap ${userData?.bubbleStyle ? `bubble-${userData.bubbleStyle}` : ''}`}
                                style={{
                                    position: 'relative',
                                    fontSize: 14, lineHeight: 1.7, color: '#e2e8f0', marginBottom: 16, whiteSpace: 'pre-wrap',
                                    padding: userData?.bubbleStyle ? '12px 14px' : '0',
                                    borderRadius: userData?.bubbleStyle ? '18px 18px 4px 18px' : '0', userSelect: 'none'
                                }}>
                                {p.content.startsWith('[ROOM_INVITE]') ? (() => {
                                    try {
                                        const data = JSON.parse(p.content.replace('[ROOM_INVITE]', ''));
                                        return (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); navigate('/party'); }}
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
                                            >
                                                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: 'rgba(124, 77, 255, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }} />

                                                <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <i className="fa-solid fa-envelope-open-text"></i> Oda Daveti
                                                </div>

                                                <div style={{ color: '#fff', fontSize: 13, marginBottom: 15, fontStyle: 'italic', opacity: 0.9 }}>
                                                    "{data.message || 'Sizi odaya davet ediyor!'}"
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--glass-bg)', padding: 12, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #7c4dff, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                                        {data.ownerAvatar ? <img src={data.ownerAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} /> : '🎙️'}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ color: '#fff', fontWeight: 900, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.roomName}</div>
                                                        <div style={{ color: 'var(--text-on-glass-dim)', fontSize: 10, fontWeight: 700, marginTop: 2 }}>@{data.ownerName} &bull; Oda Sahibi</div>
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
                                                        KATIL
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } catch (e) {
                                        return <>{p.content}</>;
                                    }
                                })() : p.content}
                                {p.image && !p.content.startsWith('[ROOM_INVITE]') && (
                                    <img src={pb.files.getUrl(p, p.image)} alt="p" style={{ width: '100%', borderRadius: 12, marginTop: 12, border: '1px solid rgba(255,255,255,0.05)', userSelect: 'none', pointerEvents: 'none' }} />
                                )}
                            </div>

                            {/* Post actions */}
                            <div style={{
                                display: 'flex', gap: 16, borderTop: '1px solid var(--border)',
                                paddingTop: 14, marginTop: 4
                            }}>
                                <div onClick={async () => {
                                    if (Array.isArray(p.likes) && p.likes.length > 0) {
                                        const filter = p.likes.map((id: string) => `id="${id}"`).join(' || ');
                                        const res = await pb.collection('users').getList(1, 50, { filter });
                                        setShowListModal({ type: 'likes', data: res.items });
                                    }
                                }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: (Array.isArray(p.likes) && p.likes.includes(pb.authStore.model?.id)) ? '#ef4444' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                    <i className={(Array.isArray(p.likes) && p.likes.includes(pb.authStore.model?.id)) ? "fa-solid fa-heart" : "fa-regular fa-heart"} style={{ fontSize: 16 }}></i>
                                    {Array.isArray(p.likes) ? p.likes.length : 0}
                                </div>
                                <div onClick={() => { setCommentingPost(p); }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                    <i className="fa-regular fa-comment" style={{ fontSize: 16 }}></i>
                                    {Array.isArray(p.comments) ? p.comments.length : 0}
                                </div>
                                <div onClick={() => {
                                    const link = window.location.origin + '/post/' + p.id;
                                    navigator.clipboard.writeText(link);
                                    alert('Link kopyalandı! 🔗');
                                }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, marginLeft: 'auto', cursor: 'pointer' }}>
                                    <i className="fa-solid fa-share-nodes" style={{ fontSize: 14 }}></i>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─────────────── EDIT PROFILE MODAL ─────────────── */}
            {showEditModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                    <div className="animate-fade-up premium-modal" style={{ flex: 1, padding: '40px 24px 24px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 900 }}>{t('edit_profile')}</h2>
                            <div onClick={() => setShowEditModal(false)} style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>✕</div>
                        </div>

                        {/* Avatar Picker */}
                        <div style={{ marginBottom: 26, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: 110, height: 110, borderRadius: 36,
                                    background: 'rgba(255,255,255,0.03)', border: '2px solid var(--purple)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)'
                                }}>
                                    {(document.getElementById('avatar-file-input') as HTMLInputElement)?.files?.[0] ? (
                                        <img src={URL.createObjectURL((document.getElementById('avatar-file-input') as HTMLInputElement).files![0])} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : userData?.avatar ? (
                                        <img src={pb.files.getUrl(userData, userData.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <i className="fa-solid fa-user" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 40 }}></i>
                                    )}
                                </div>
                                <label style={{
                                    position: 'absolute', bottom: -10, right: -10, width: 38, height: 38,
                                    background: 'var(--purple)', borderRadius: '50%', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '3px solid var(--bg-primary)'
                                }}>
                                    <span style={{ fontSize: 16 }}>📷</span>
                                    <input type="file" id="avatar-file-input" accept="image/*" style={{ display: 'none' }}
                                        onChange={() => {
                                            // Force re-render to show preview
                                            setEditName(editName + ' ');
                                            setEditName(editName.trim());
                                        }} />
                                </label>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 18, fontWeight: 700, textTransform: 'uppercase' }}>Profil Fotoğrafını Değiştir</div>
                        </div>

                        <div style={{ marginBottom: 18 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Kullanıcı adı</label>
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                                style={{ width: '100%', padding: '14px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: '#fff', outline: 'none', fontSize: 15, fontFamily: 'inherit' }} />
                        </div>

                        <div style={{ marginBottom: 26 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Biyografi</label>
                            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
                                style={{ width: '100%', padding: '14px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: '#fff', outline: 'none', fontSize: 14, resize: 'none', fontFamily: 'inherit' }} />
                        </div>

                        <button onClick={handleSaveProfile} style={{
                            width: '100%', height: 56, borderRadius: 22,
                            background: 'var(--purple)', border: 'none', color: '#fff',
                            fontWeight: 900, fontSize: 16, cursor: 'pointer',
                            boxShadow: '0 12px 28px rgba(124,58,237,0.35)', fontFamily: 'inherit'
                        }}>{t('save')}</button>
                    </div>
                </div>
            )}

            {/* ─────────────── SETTINGS MODAL ─────────────── */}
            {showSettingsModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Scrool Fix: Modal container should handle overflow touch elegantly */}
                    <div className="animate-fade-up premium-modal" style={{
                        flex: 1,
                        padding: '40px 24px 24px',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        display: 'block' // Flex here can break scrolling in some Android webviews, switching to block
                    }}>

                        {/* Back header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            {settingsPage && (
                                <div onClick={() => setSettingsPage(null)} style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>←</div>
                            )}
                            <h2 style={{ fontSize: 20, fontWeight: 900, flex: 1 }}>
                                {!settingsPage && 'Ayarlar'}
                                {settingsPage === 'security' && '🛡️ Hesap & Güvenlik'}
                                {settingsPage === 'appearance' && '🎨 Görünüm & Tema'}
                                {settingsPage === 'bubbles' && '💬 Sohbet Balonları'}
                                {settingsPage === 'tags' && '🎨 İlgi Alanlarını Düzenle'}
                                {settingsPage === 'privacy' && '🔒 Gizlilik Ayarları'}
                                {settingsPage === 'notifications' && '🔔 Bildirim Tercihleri'}
                                {settingsPage === 'help' && '🆘 Yardım & Destek'}
                                {settingsPage === 'vip' && '💎 VIP Ayrıcalıkları'}

                            </h2>
                            {!settingsPage && (
                                <div onClick={() => setShowSettingsModal(false)} style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>✕</div>
                            )}
                        </div>

                        {/* ── Main settings list ── */}
                        {!settingsPage && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { id: 'vip', icon: '👑', label: 'VIP Ayrıcalıkları', color: '#f59e0b', sub: 'Özel odalar, elit profil' },
                                    { id: 'appearance', icon: '🎨', label: 'Görünüm & Tema', color: '#8b5cf6', sub: 'Tema ve Sohbet Balonları' },
                                    { id: 'tags', icon: '✨', label: 'İlgi Alanları', color: '#10b981', sub: 'Seni tanımlayan etiketler' },
                                    { id: 'security', icon: '🛡️', label: 'Hesap & Güvenlik', color: '#6366f1', sub: 'Güvenlik merkezini yönet' },
                                    { id: 'help', icon: '🆘', label: 'Yardım & Destek', color: '#06b6d4', sub: 'Bize ulaş, destek al' },
                                ].map(item => (
                                    <div key={item.id} onClick={() => setSettingsPage(item.id as SettingsPage)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, background: 'var(--glass-bg)', cursor: 'pointer', border: '1px solid var(--border)', transition: '0.2s' }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 14, background: `${item.color}20`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{item.icon}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, fontSize: 14 }}>{item.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
                                        </div>
                                        <span style={{ color: 'var(--text-on-glass-muted)', fontSize: 18 }}>›</span>
                                    </div>
                                ))}

                                <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />

                                <button onClick={handleLogout} style={{
                                    width: '100%', height: 52, borderRadius: 18,
                                    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                    border: '1px solid rgba(239,68,68,0.15)', fontWeight: 800,
                                    cursor: 'pointer', fontSize: 14, fontFamily: 'inherit'
                                }}>🚪 Güvenli Çıkış Yap</button>
                            </div>
                        )}

                        {/* ===== GÖRÜNÜM & TEMA SAYFASI ===== */}
                        {settingsPage === 'appearance' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Theme Selection */}
                                <div className="animate-fade-up">
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                                        Uygulama Teması
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                                        <button
                                            onClick={() => applyTheme('dark')}
                                            style={{
                                                padding: '24px 20px', borderRadius: 24,
                                                background: activeTheme === 'dark' ? 'rgba(139,92,246,0.12)' : '#111',
                                                border: `2px solid ${activeTheme === 'dark' ? '#8b5cf6' : 'rgba(255,255,255,0.06)'}`,
                                                cursor: 'pointer', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                display: 'flex', alignItems: 'center', gap: 18, textAlign: 'left',
                                                boxShadow: activeTheme === 'dark' ? '0 10px 30px rgba(139,92,246,0.15)' : 'none'
                                            }}
                                        >
                                            <div style={{ width: 56, height: 56, borderRadius: 18, background: activeTheme === 'dark' ? '#8b5cf6' : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🌙</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ color: '#fff', fontWeight: 900, fontSize: 15 }}>Koyu Tema (Default)</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, marginTop: 2 }}>Göz yormayan şık arayüz</div>
                                            </div>
                                            {activeTheme === 'dark' && (
                                                <div style={{ color: '#8b5cf6' }}><i className="fa-solid fa-circle-check"></i></div>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => applyTheme('light')}
                                            style={{
                                                padding: '24px 20px', borderRadius: 24,
                                                background: activeTheme === 'light' ? 'rgba(139,92,246,0.12)' : 'rgba(255, 255, 255, 0.05)',
                                                border: `2px solid ${activeTheme === 'light' ? '#8b5cf6' : 'rgba(255, 255, 255, 0.05)'}`,
                                                cursor: 'pointer', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                display: 'flex', alignItems: 'center', gap: 18, textAlign: 'left',
                                                boxShadow: activeTheme === 'light' ? '0 10px 30px rgba(139,92,246,0.15)' : 'none',
                                                color: '#fff'
                                            }}
                                        >
                                            <div style={{ width: 56, height: 56, borderRadius: 18, background: activeTheme === 'light' ? '#8b5cf6' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>☀️</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ color: 'inherit', fontWeight: 900, fontSize: 15 }}>Açık Tema (Beta)</div>
                                                <div style={{ color: 'inherit', opacity: 0.6, fontSize: 11, fontWeight: 700, marginTop: 2 }}>Ferah ve canlı arayüz</div>
                                            </div>
                                            {activeTheme === 'light' && (
                                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#8b5cf6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</div>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Language Selection */}
                                <div className="animate-fade-up">
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                                        {language === 'tr' ? 'Uygulama Dili' : 'App Language'}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <button
                                            onClick={() => setLanguage('tr')}
                                            style={{
                                                padding: '16px', borderRadius: 20,
                                                background: language === 'tr' ? 'rgba(139,92,246,0.12)' : '#111',
                                                border: `2px solid ${language === 'tr' ? '#8b5cf6' : 'rgba(255,255,255,0.06)'}`,
                                                cursor: 'pointer', transition: '0.3s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                                color: '#fff', fontWeight: 800
                                            }}
                                        >
                                            <span style={{ fontSize: 20 }}>🇹🇷</span> Türkçe
                                        </button>
                                        <button
                                            onClick={() => setLanguage('en')}
                                            style={{
                                                padding: '16px', borderRadius: 20,
                                                background: language === 'en' ? 'rgba(139,92,246,0.12)' : '#111',
                                                border: `2px solid ${language === 'en' ? '#8b5cf6' : 'rgba(255,255,255,0.06)'}`,
                                                cursor: 'pointer', transition: '0.3s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                                color: '#fff', fontWeight: 800
                                            }}
                                        >
                                            <span style={{ fontSize: 20 }}>🇺🇸</span> English
                                        </button>
                                    </div>
                                </div>

                                {/* Bubble Selection Integrated */}
                                <div className="animate-fade-up" style={{ marginTop: 10, animationDelay: '0.1s' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
                                        Sohbet Balonu Stili
                                        {selectedBubble !== userData?.bubbleStyle && <span style={{ color: '#d946ef', animation: 'pulse 2s infinite' }}>Yeni Seçim ✨</span>}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                                        {BUBBLE_STYLES.map((b) => (
                                            <div key={b.id} onClick={() => setSelectedBubble(b.id)} style={{
                                                padding: '16px 20px', borderRadius: 24,
                                                background: selectedBubble === b.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                                                border: `1.5px solid ${selectedBubble === b.id ? (b.color || '#8b5cf6') : 'rgba(255,255,255,0.06)'}`,
                                                display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: '0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                                transform: selectedBubble === b.id ? 'scale(1.02)' : 'scale(1)',
                                                boxShadow: selectedBubble === b.id ? `0 10px 25px ${b.color}15` : 'none'
                                            }}>
                                                <div style={{
                                                    width: 50, height: 50, borderRadius: 16,
                                                    background: `${b.color}15`, border: `1px solid ${b.color}30`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                                                    boxShadow: selectedBubble === b.id ? `0 0 20px ${b.color}30` : 'none'
                                                }}>
                                                    {b.icon}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>{b.name}</div>
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                                        <div className={b.class} style={{ fontSize: 9, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: b.color || '#8b5cf6' }}>
                                                            {userData?.bubbleStyle === b.id ? 'Aktif' : 'Stil'}
                                                        </div>
                                                        {b.id === 'rainbow' && <div style={{ fontSize: 9, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', fontWeight: 800, color: '#ffbdc5' }}>PREMIUM</div>}
                                                    </div>
                                                </div>
                                                {selectedBubble === b.id && <div style={{ color: (b.color || '#8b5cf6'), fontSize: 20 }}>✦</div>}
                                            </div>
                                        ))}
                                    </div>

                                    {selectedBubble !== userData?.bubbleStyle && (
                                        <button
                                            onClick={handleUpdateBubble}
                                            className="p-btn-glow"
                                            style={{
                                                marginTop: 20, height: 54, borderRadius: 20,
                                                background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
                                                boxShadow: '0 8px 25px rgba(139, 92, 246, 0.3)',
                                                width: '100%', border: 'none', color: '#fff', fontWeight: 900, cursor: 'pointer'
                                            }}
                                        >
                                            Yeni Stili Uygula ✨
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                        }

                        {/* ── Security Page ── */}
                        {
                            settingsPage === 'security' && (
                                <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    {/* Security Status Card */}
                                    <div style={{
                                        padding: 24, borderRadius: 32, background: 'rgba(99,102,241,0.08)',
                                        border: '1px solid rgba(99,102,241,0.15)', position: 'relative', overflow: 'hidden'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                                            <div style={{ width: 64, height: 64, borderRadius: 22, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🛡️</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 16, fontWeight: 950, color: '#fff' }}>Hesap Koruması</div>
                                                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 800, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                                                    Yüksek Seviye Güvenlik
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { key: 'email', label: 'E-posta Adresi', value: userData?.email, icon: '📧', color: '#3b82f6' },
                                            { key: 'pass', label: 'Giriş Şifresi', value: '••••••••••••', icon: '🔑', color: '#8b5cf6' },
                                            { key: 'auth', label: 'İki Faktörlü Doğrulama', value: 'Google Authenticator', icon: '📱', color: '#10b981' },
                                            { key: 'sessions', label: 'Aktif Oturumlar', value: 'Şu anki VDS Sunucusu', icon: '💻', color: '#f59e0b' },
                                        ].map(item => (
                                            <div key={item.key} style={{
                                                display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
                                                borderRadius: 24, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                                cursor: 'pointer', transition: '0.2s'
                                            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                                                <div style={{ width: 44, height: 44, borderRadius: 14, background: `${item.color}18`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{item.icon}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
                                                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', marginTop: 3 }}>{item.value}</div>
                                                </div>
                                                <div style={{ color: 'var(--text-on-glass-muted)', fontSize: 18 }}>›</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ marginTop: 10, padding: 20, borderRadius: 24, border: '1.5px dashed rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                                        <div style={{ color: '#ef4444', fontWeight: 950, fontSize: 14, marginBottom: 6 }}>Tehlikeli Bölge</div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6, marginBottom: 16 }}>
                                            Hesabını sildiğinde tüm mesajların, odaların ve takipçilerin kalıcı olarak temizlenir.
                                        </p>
                                        <button style={{
                                            width: '100%', height: 46, borderRadius: 16, border: 'none', background: '#ef4444',
                                            color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.2)'
                                        }} onClick={() => { if (confirm('Emin misiniz? Geri dönüşü yok!')) alert('Destek ile iletişime geçin.'); }}>
                                            HESABI KALICI OLARAK SİL
                                        </button>
                                    </div>
                                </div>
                            )
                        }


                        {/* ── VIP Page ── */}
                        {
                            settingsPage === 'vip' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{
                                        padding: '30px 20px', borderRadius: 32,
                                        background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.1), rgba(0,0,0,0.3))',
                                        border: '1px solid rgba(245, 108, 11, 0.2)', position: 'relative', overflow: 'hidden'
                                    }}>
                                        {userData?.isVIP && (
                                            <div style={{
                                                position: 'absolute', top: 12, right: 12, padding: '4px 10px',
                                                borderRadius: 12, background: 'rgba(245, 108, 11, 0.2)',
                                                color: '#f59e0b', fontSize: 10, fontWeight: 900
                                            }}>
                                                AKTİF ÜYELİK
                                            </div>
                                        )}
                                        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                                            <div style={{ fontSize: 60, marginBottom: 16 }}>👑</div>
                                            <h3 style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 950, letterSpacing: '-1px', marginBottom: 8 }}>
                                                LoveMatch <span style={{ color: '#f59e0b' }}>VIP</span>
                                            </h3>

                                            {userData?.isVIP && userData?.vipUntil ? (
                                                <div style={{ marginBottom: 24 }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Kalan Süre</div>
                                                    <div style={{ fontSize: 32, fontWeight: 950, color: '#f59e0b', marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
                                                        {timeLeft || "Hesaplanıyor..."}
                                                    </div>
                                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4 }}>
                                                        Harika görünüyorsun! Tüm ayrıcalıkların tanımlandı. ✨
                                                    </div>
                                                </div>
                                            ) : (
                                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 32, lineHeight: 1.5 }}>
                                                    Tüm sınırları kaldır, topluluğun zirvesine yerleş ve eşsiz avantajların tadını çıkar.
                                                </p>
                                            )}

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
                                                {[
                                                    { icon: '🌟', text: 'Özel Odalara Tam Erişim' },
                                                    { icon: '🥇', text: 'Altın VIP Rozeti ve Profil Parlaması' },
                                                    { icon: '♾️', text: 'Limitsiz Arkadaşlık İstekleri' },
                                                    { icon: '🎭', text: 'Tüm Maskot Öğelerini Ücretsiz Kullan' },
                                                    { icon: '💬', text: 'Özel VIP Sohbet Balonları' },
                                                ].map((feat, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <span style={{ fontSize: 18 }}>{feat.icon}</span>
                                                        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{feat.text}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {(!userData?.isVIP) && (
                                                <>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                        <button
                                                            onClick={async () => {
                                                                const success = await StoreService.purchase('vip_01');
                                                                if (success) {
                                                                    alert("Tebrikler! Aylık VIP üyeliğiniz aktif edildi.");
                                                                    fetchAll();
                                                                }
                                                            }}
                                                            style={{
                                                                width: '100%', height: 60, borderRadius: 20, border: 'none',
                                                                background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
                                                                color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                                                                boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)', transition: '0.3s'
                                                            }}
                                                        >
                                                            Aylık VIP Abonelik ({storePrice})
                                                        </button>

                                                        <button
                                                            onClick={async () => {
                                                                const success = await StoreService.purchase('vip_01');
                                                                if (success) {
                                                                    alert("Tebrikler! Tek seferlik paket tanımlandı ve rozetiniz eklendi.");
                                                                    fetchAll();
                                                                }
                                                            }}
                                                            style={{
                                                                width: '100%', height: 60, borderRadius: 20, border: '2px solid #f59e0b',
                                                                background: 'rgba(245, 158, 11, 0.1)',
                                                                color: '#f59e0b', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                                                                transition: '0.3s'
                                                            }}
                                                        >
                                                            Tek Ürün (Rozet + 30 Gün VIP)
                                                        </button>
                                                    </div>

                                                    <button
                                                        onClick={async () => {
                                                            alert("Üyelik durumu kontrol ediliyor... Lütfen bekleyin.");
                                                            await StoreService.init(true); // Force refresh
                                                            alert("Google Play verileri tazelendi. Eğer ödemeniz görünüyorsa VIP özellikleriniz otomatik aktif olacaktır. Yansımazsa uygulamayı kapatıp açın.");
                                                            fetchAll();
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textDecoration: 'underline', marginTop: 12, cursor: 'pointer' }}
                                                    >
                                                        Satın Alımı Geri Yükle / Senkronize Et
                                                    </button>

                                                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 20 }}>
                                                        Satın alım Google Play Store üzerinden güvenle gerçekleştirilir. İstediğin zaman iptal edebilirsin.
                                                    </p>
                                                </>
                                            )}
                                            {userData?.isVIP && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    <button
                                                        onClick={() => {
                                                            alert("Üyeliğiniz aktif! Keyfini çıkarın. ✨");
                                                        }}
                                                        style={{
                                                            width: '100%', height: 60, borderRadius: 24, border: '1px solid rgba(245, 158, 11, 0.3)',
                                                            background: 'rgba(255,255,255,0.02)',
                                                            color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 16, cursor: 'default'
                                                        }}
                                                    >
                                                        Üyeliğin Tadını Çıkar ✨
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            await StoreService.init(true);
                                                            alert("Üyelik verileri Google Play ile senkronize edildi. Eğer VIP yansımadıysa lütfen uygulamayı kapatıp açın.");
                                                            fetchAll();
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textDecoration: 'underline' }}
                                                    >
                                                        Üyeliği Yeniden Senkronize Et
                                                    </button>
                                                </div>
                                            )}

                                            {/* Diagonstic Logs */}
                                            <div style={{ marginTop: 30, padding: 16, borderRadius: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sistem Durumu</span>
                                                    <span style={{ fontSize: 10, color: '#10b981', fontWeight: 800 }}>{(StoreService as any).status}</span>
                                                </div>
                                                <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 10, textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                                    {(StoreService as any).lastLogs.length === 0 ? "Kayıt yok." : (StoreService as any).lastLogs.map((l: string, idx: number) => (
                                                        <div key={idx} style={{ marginBottom: 4 }}>- {l}</div>
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={() => { StoreService.init(true); fetchAll(); }}
                                                    style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 10, border: 'none', fontWeight: 700 }}
                                                >
                                                    Sistemi Tazele
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: 24, borderRadius: 24, background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center'
                                    }}>
                                        <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Destek Lazım mı?</div>
                                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>VIP özellikleriyle ilgili her türlü sorunda canlı desteğe yazabilirsin.</div>
                                    </div>
                                </div>
                            )
                        }

                        {/* ── Tags Page ── */}
                        {
                            settingsPage === 'tags' && (
                                <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {/* Header Section */}
                                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                        <div style={{ fontSize: 64, marginBottom: 12, animation: 'bounce 3s infinite' }}>✨</div>
                                        <h3 style={{ fontSize: 22, fontWeight: 950, color: '#fff', letterSpacing: '-0.5px' }}>Seni Tanıyalım!</h3>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                                            İlgi alanlarını ekleyerek kafa dengi insanlarla <br /> daha kolay eşleşebilirsin.
                                        </p>
                                    </div>

                                    {/* Interactive Tag Input */}
                                    <div style={{
                                        padding: 24, borderRadius: 32, background: 'rgba(255,255,255,0.02)',
                                        border: '2px solid rgba(255,255,255,0.06)', position: 'relative'
                                    }}>
                                        <div style={{ fontSize: 10, fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Şu Anki Etiketlerin</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 40 }}>
                                            {editTags.split(',').filter(Boolean).length === 0 ? (
                                                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, fontStyle: 'italic' }}>Henüz bir ilgi alanı eklemedin...</div>
                                            ) : (
                                                editTags.split(',').filter(Boolean).map((t, idx) => (
                                                    <div key={idx} className="animate-scale-up" style={{
                                                        padding: '8px 16px', background: 'rgba(16,185,129,0.1)', color: '#10b981',
                                                        borderRadius: 14, fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8,
                                                        border: '1px solid rgba(16,185,129,0.2)'
                                                    }}>
                                                        #{t.trim()}
                                                        <span onClick={() => {
                                                            const newTags = editTags.split(',').filter(Boolean).filter((_, i) => i !== idx).join(',');
                                                            setEditTags(newTags);
                                                        }} style={{ cursor: 'pointer', opacity: 0.5 }}>✕</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', margin: '24px 0' }} />

                                        <div style={{ position: 'relative' }}>
                                            <input
                                                value={editTags}
                                                onChange={e => setEditTags(e.target.value)}
                                                placeholder="Virgülle ayırarak yaz (Örn: Müzik, Dans, Kodlama)"
                                                style={{
                                                    width: '100%', padding: '16px 20px', background: 'rgba(0,0,0,0.2)',
                                                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18,
                                                    color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'inherit'
                                                }}
                                            />
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Her kelimeden sonra virgül koyun</span>
                                                <span>{editTags.split(',').filter(Boolean).length} etiket</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Suggestion Chips */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase' }}>Popüler Aramalar</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {['🎮 Oyun', '🎶 Müzik', '✈️ Seyahat', '🎬 Film', '🍜 Yemek', '🏀 Spor', '💻 Teknoloji', '📚 Kitap'].map(item => (
                                                <div key={item}
                                                    onClick={() => {
                                                        const clean = item.split(' ')[1];
                                                        if (!editTags.includes(clean)) {
                                                            setEditTags(prev => prev ? `${prev},${clean}` : clean);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '10px 18px', borderRadius: 20, background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.05)', color: '#ccc', fontSize: 13,
                                                        fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                                                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button onClick={handleUpdateTags} className="p-btn-glow" style={{
                                        height: 60, borderRadius: 22, background: 'linear-gradient(90deg, #10b981, #059669)',
                                        fontSize: 16, fontWeight: 950, letterSpacing: '0.5px'
                                    }}>
                                        İlgi Alanlarımı Güncelle ✨
                                    </button>
                                </div>
                            )
                        }



                        {
                            settingsPage === 'privacy' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { label: 'Çevrimiçi durumunu göster', sub: 'Diğerleri seni aktif görebilir', val: privacyOnline, set: setPrivacyOnline },
                                        { label: 'Profil herkese açık', sub: 'Kapalıysa sadece takipçiler görebilir', val: privacyProfile, set: setPrivacyProfile },
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
                                            </div>
                                            <div onClick={() => item.set(!item.val)} style={{
                                                width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
                                                background: item.val ? 'var(--purple)' : 'rgba(255,255,255,0.1)',
                                                position: 'relative', transition: '0.3s', flexShrink: 0
                                            }}>
                                                <div style={{
                                                    position: 'absolute', top: 3, left: item.val ? 26 : 4,
                                                    width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: '0.3s'
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ padding: '14px 16px', borderRadius: 18, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', cursor: 'pointer' }}
                                        onClick={() => alert('Hesap silme işlemi için destek@lovematch.app adresine yazın.')}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>Hesabı Sil</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Geri alınamaz işlem</div>
                                    </div>
                                </div>
                            )
                        }

                        {/* ── Notifications Page ── */}
                        {
                            settingsPage === 'notifications' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { label: 'Mesaj bildirimleri', sub: 'Yeni mesajlar için bildir', val: notifMessages, set: setNotifMessages },
                                        { label: 'Etiket bildirimleri', sub: '@mention olunduğunda bildir', val: notifMentions, set: setNotifMentions },
                                        { label: 'Aktivite bildirimleri', sub: 'Beğeni ve yorum bildirimleri', val: notifActivity, set: setNotifActivity },
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
                                            </div>
                                            <div onClick={() => item.set(!item.val)} style={{
                                                width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
                                                background: item.val ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                                                position: 'relative', transition: '0.3s', flexShrink: 0
                                            }}>
                                                <div style={{
                                                    position: 'absolute', top: 3, left: item.val ? 26 : 4,
                                                    width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: '0.3s'
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }

                        {/* ── Help Page ── */}
                        {
                            settingsPage === 'help' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                        { icon: '📩', title: 'Bize Ulaş', sub: 'destek@lovematch.app', action: () => window.open('mailto:destek@lovematch.app'), color: '#06b6d4' },
                                        { icon: '⭐', title: 'Uygulamayı Değerlendir', sub: 'Görüşleriniz çok değerli', action: () => alert('Teşekkürler! 5 yıldız 🌟'), color: '#f59e0b' },
                                    ].map((item, i) => (
                                        <div key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', cursor: 'pointer', border: '1px solid var(--border)' }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 14, background: `${item.color || 'rgba(6,182,212,0.12)'}`, color: item.color || '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{item.icon}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
                                            </div>
                                            <span style={{ color: 'var(--text-on-glass-muted)', fontSize: 18 }}>›</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                                        LoveMatch v1.0.0 • Sevgiyle yapıldı 💜
                                    </div>
                                </div>
                            )
                        }
                    </div >
                </div >
            )
            }

            {/* ─────────────── EDIT POST MODAL ─────────────── */}
            {
                editingPost && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(1,2,6,0.92)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <div className="animate-scale-up premium-modal" style={{ width: '100%', maxWidth: 380, borderRadius: 36, padding: 28 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 900 }}>Gönderiyi Düzenle</h2>
                                <div onClick={() => setEditingPost(null)} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>✕</div>
                            </div>
                            <textarea value={editPostContent} onChange={e => setEditPostContent(e.target.value)} rows={5}
                                style={{ width: '100%', borderRadius: 18, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', padding: '14px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                            <button onClick={async () => {
                                try {
                                    await pb.collection('posts').update(editingPost.id, { content: editPostContent });
                                    setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editPostContent } : p));
                                    setEditingPost(null);
                                } catch (e) { alert('Hata!'); }
                            }} style={{
                                width: '100%', height: 52, borderRadius: 18,
                                background: 'var(--purple)', border: 'none', color: '#fff',
                                fontWeight: 900, fontSize: 15, marginTop: 18, cursor: 'pointer',
                                boxShadow: '0 10px 24px rgba(124,58,237,0.3)', fontFamily: 'inherit'
                            }}>Güncelle</button>
                        </div>
                    </div>
                )
            }

            {/* ─────────────── LIST MODAL (Followers/Following) ─────────────── */}
            {
                showListModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(1,2,6,0.95)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column' }}>
                        <div className="animate-fade-up" style={{ flex: 1, padding: '60px 24px 24px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                                <h2 style={{ fontSize: 24, fontWeight: 950, letterSpacing: '-0.5px' }}>
                                    {showListModal.type === 'followers' ? 'Takipçiler' : showListModal.type === 'following' ? 'Takip Edilenler' : 'Beğenenler'}
                                </h2>
                                <div onClick={() => setShowListModal(null)} style={{ width: 44, height: 44, borderRadius: 16, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>✕</div>
                            </div>

                            {showListModal.data.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
                                    <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
                                    <div>Henüz kimse yok</div>
                                </div>
                            ) : showListModal.data.map(u => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div onClick={() => { navigate(`/profile/${u.id}`); setShowListModal(null); }} style={{ width: 52, height: 52, borderRadius: 18, background: u.avatar ? 'transparent' : (u.color || 'var(--purple)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {u.avatar ? (
                                            <img src={pb.files.getUrl(u, u.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                        ) : (
                                            <i className="fa-solid fa-user" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 24 }}></i>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }} onClick={() => { navigate(`/profile/${u.id}`); setShowListModal(null); }}>
                                        <div style={{ fontWeight: 800, fontSize: 15 }}>{u.username}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.id.slice(0, 8)}</div>
                                    </div>

                                    {(!profileId || profileId === pb.authStore.model?.id) && showListModal.type !== 'likes' && (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {showListModal.type === 'followers' && !SocialService.isFollowing(u.id) && (
                                                <button
                                                    onClick={async () => {
                                                        await SocialService.followUser(u.id);
                                                        setToast({ message: 'Geri takip edildi! 🤝', type: 'success' });
                                                        setTimeout(() => setToast(null), 3000);
                                                        setShowListModal({ ...showListModal }); // Re-render check
                                                    }}
                                                    style={{ padding: '6px 12px', borderRadius: 10, background: 'var(--purple)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                                                >{t('follow_back')}</button>
                                            )}
                                            {showListModal.type === 'followers' && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('Bu takipçiyi listeden çıkarmak istiyor musun?')) {
                                                            await SocialService.removeFollower(u.id);
                                                            setShowListModal({ ...showListModal, data: showListModal.data.filter(x => x.id !== u.id) });
                                                        }
                                                    }}
                                                    style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                                >Çıkar</button>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (confirm('Bu kullanıcıyı engellemek istediğine emin misin?')) {
                                                        await SocialService.blockUser(u.id);
                                                        setShowListModal({ ...showListModal, data: showListModal.data.filter(x => x.id !== u.id) });
                                                    }
                                                }}
                                                style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            ><i className="fa-solid fa-ban"></i></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* ─────────────── COMMENTS MODAL ─────────────── */}
            {
                commentingPost && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(1,2,6,0.95)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column' }}>
                        <div className="animate-fade-up" style={{ flex: 1, padding: '40px 24px 24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h2 style={{ fontSize: 20, fontWeight: 950 }}>Yorumlar ({Array.isArray(commentingPost.comments) ? commentingPost.comments.length : 0})</h2>
                                <div onClick={() => setCommentingPost(null)} style={{ width: 44, height: 44, borderRadius: 16, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }} className="no-scrollbar">
                                {(!Array.isArray(commentingPost.comments) || commentingPost.comments.length === 0) ? (
                                    <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
                                        <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
                                        <div>İlk yorumu sen yap!</div>
                                    </div>
                                ) : commentingPost.comments.map((c: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                                        <div onClick={() => { if (c.uid) { navigate(`/profile/${c.uid}`); setCommentingPost(null); } }} style={{ width: 44, height: 44, borderRadius: 16, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}>
                                            {c.avatar ? (
                                                <img src={pb.files.getUrl({ collectionId: 'users', id: c.uid }, c.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <i className="fa-solid fa-user" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }}></i>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <div onClick={() => { if (c.uid) { navigate(`/profile/${c.uid}`); setCommentingPost(null); } }} style={{ fontWeight: 800, fontSize: 14, cursor: 'pointer', color: '#fff' }}>{c.username}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{new Date(c.created || c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                            <div className={c.bubbleStyle ? `bubble-${c.bubbleStyle}` : ''} style={{
                                                fontSize: 13, color: '#e2e8f0', lineHeight: 1.5,
                                                background: 'rgba(255,255,255,0.04)', padding: '10px 14px',
                                                borderRadius: '0 20px 20px 20px', display: 'inline-block',
                                                border: '1px solid rgba(255,255,255,0.05)'
                                            }}>{c.text}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)' }}>
                                <input
                                    id="comment-input"
                                    placeholder="Bir şeyler yaz..."
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '0 10px', fontSize: 14, outline: 'none' }}
                                    onKeyPress={async (e) => {
                                        if (e.key === 'Enter') {
                                            const input = e.target as HTMLInputElement;
                                            if (!input.value.trim()) return;
                                            try {
                                                const newComment = {
                                                    uid: pb.authStore.model?.id,
                                                    username: pb.authStore.model?.username || 'user',
                                                    avatar: pb.authStore.model?.avatar || '',
                                                    bubbleStyle: pb.authStore.model?.bubbleStyle || 'classic',
                                                    text: input.value,
                                                    created: new Date().toISOString()
                                                };
                                                const updatedComments = [...(commentingPost.comments || []), newComment];
                                                await pb.collection('posts').update(commentingPost.id, { comments: updatedComments });
                                                setCommentingPost({ ...commentingPost, comments: updatedComments });
                                                setPosts(prev => prev.map(p => p.id === commentingPost.id ? { ...p, comments: updatedComments } : p));
                                                input.value = '';
                                                SocialService.notifyPostComment(commentingPost, newComment.username, newComment.text);
                                            } catch (err) { alert('Hata oluştu'); }
                                        }
                                    }}
                                />
                                <div style={{ width: 44, height: 44, borderRadius: 16, background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => {
                                    const input = document.getElementById('comment-input') as HTMLInputElement;
                                    if (input) {
                                        const event = new KeyboardEvent('keypress', { key: 'Enter' });
                                        input.dispatchEvent(event);
                                    }
                                }}>
                                    <i className="fa-solid fa-paper-plane" style={{ fontSize: 16, color: '#fff' }}></i>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <div style={{ height: 100 }} />
        </div >
    );
}
