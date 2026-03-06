import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pb } from '../pb';
import { SocialService } from '../utils/social';

interface ChatContact {
    id: string;
    username: string;
    color: string;
    isVIP?: boolean;
    premiumBadge?: boolean;
    lastMessage?: string;
    lastMessageTime?: string;
    unread?: number;
    online?: boolean;
    bubbleStyle?: string;
    avatar?: string;
}

export default function ChatPage() {
    const [activeTab, setActiveTab] = useState<'messages' | 'online'>('messages');
    const [openChat, setOpenChat] = useState<ChatContact | null>(null);
    const [newMsg, setNewMsg] = useState('');
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [onlineIds, setOnlineIds] = useState<string[]>([]);
    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const socket = (window as any).socket;
    const user = pb.authStore.model;
    const navigate = useNavigate();
    const location = useLocation();

    // ── Pre-fetch Contacts & Online Status ──
    useEffect(() => {
        const fetchContacts = async () => {
            if (!user?.id) return;
            setLoadingContacts(true);
            try {
                const friends = await SocialService.getFriends();

                // Get recent DM participants
                const lastDMs = await pb.collection('direct_messages').getList(1, 30, {
                    filter: `sender='${user.id}' || receiver='${user.id}'`,
                    sort: '-created',
                    expand: 'sender,receiver'
                });

                const recentUsers: any[] = [];
                lastDMs.items.forEach((lastMsg: any) => {
                    const otherId = lastMsg.sender === user.id ? lastMsg.receiver : lastMsg.sender;
                    const otherUser = lastDMs.items.find((m: any) => (m.sender === otherId || m.receiver === otherId) && m.expand)?.expand;
                    const other = otherUser?.sender?.id === otherId ? otherUser.sender : otherUser?.receiver;

                    if (other && !friends.find((f: any) => f.id === other.id) && !recentUsers.find((r: any) => r.id === other.id)) {
                        recentUsers.push(other);
                    }
                });

                const all = [...friends, ...recentUsers];
                const mapped: ChatContact[] = all.map((u: any) => ({
                    id: u.id,
                    username: u.username || u.name || 'Anonim',
                    color: u.color || 'var(--purple-main)',
                    isVIP: u.isVIP,
                    premiumBadge: u.premiumBadge,
                    bubbleStyle: u.bubbleStyle || 'classic',
                    avatar: u.avatar,
                    online: onlineIds.includes(u.id)
                }));
                setContacts(mapped);

                // Auto-open from URL
                const params = new URLSearchParams(location.search);
                const targetUid = params.get('userId');
                if (targetUid && targetUid !== user.id) {
                    const found = mapped.find((c: any) => c.id === targetUid);
                    if (found) {
                        setOpenChat(found);
                    } else {
                        const targetUser = await pb.collection('users').getOne(targetUid).catch(() => null);
                        if (targetUser) {
                            const newC: ChatContact = {
                                id: targetUser.id,
                                username: targetUser.username || targetUser.name || 'Anonim',
                                color: targetUser.color || 'var(--purple-main)',
                                isVIP: targetUser.isVIP,
                                premiumBadge: targetUser.premiumBadge,
                                bubbleStyle: targetUser.bubbleStyle || 'classic',
                                avatar: targetUser.avatar
                            };
                            setContacts(prev => [newC, ...prev]);
                            setOpenChat(newC);
                        }
                    }
                }
            } catch (e) { console.error(e); }
            finally { setLoadingContacts(false); }
        };

        fetchContacts();
    }, [user?.id]);

    // ── Socket Listeners ──
    useEffect(() => {
        if (!socket) return;

        const handleOnline = (data: any) => setOnlineIds(data.list || []);
        const handleTyping = ({ senderId, typing }: any) => {
            if (openChat?.id === senderId) {
                setTypingUsers(prev => ({ ...prev, [senderId]: typing }));
            }
        };
        const handleSeen = (data: any) => {
            setMessages(prev => prev.map((m: any) => data.messageIds.includes(m.id) ? { ...m, read: true } : m));
        };

        socket.on('online_users_updated', handleOnline);
        socket.on('receive_dm_typing', handleTyping);
        socket.on('dm_seen_update', handleSeen);

        return () => {
            socket.off('online_users_updated', handleOnline);
            socket.off('receive_dm_typing', handleTyping);
            socket.off('dm_seen_update', handleSeen);
        };
    }, [socket, openChat?.id]);

    // ── REAL-TIME MESSAGES (PocketBase Subscription) ──
    useEffect(() => {
        if (!user?.id || !openChat?.id) {
            setMessages([]);
            return;
        }

        const fetchMsgs = async () => {
            try {
                const res = await pb.collection('direct_messages').getList(1, 100, {
                    sort: 'created',
                    filter: `(sender='${user.id}' && receiver='${openChat.id}') || (sender='${openChat.id}' && receiver='${user.id}')`
                });
                const mapped = res.items.map((m: any) => ({
                    id: m.id,
                    me: m.sender === user.id,
                    text: m.text,
                    read: m.read,
                    time: new Date(m.created).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                }));
                setMessages(mapped);

                // Mark as seen
                const unread = res.items.filter((m: any) => m.receiver === user.id && !m.read);
                if (unread.length > 0) {
                    for (const m of unread) {
                        pb.collection('direct_messages').update(m.id, { read: true }).catch(() => { });
                    }
                    socket?.emit('dm_seen', { messageIds: unread.map((u: any) => u.id), senderId: openChat.id, receiverId: user.id });
                }
            } catch (e) { console.error(e); }
        };
        fetchMsgs();

        const unsubscribe = pb.collection('direct_messages').subscribe('*', async (e: any) => {
            if (e.action === 'create') {
                const m = e.record;
                const isThisChat = (m.sender === user.id && m.receiver === openChat.id) || (m.sender === openChat.id && m.receiver === user.id);
                if (isThisChat) {
                    const isNew = !messages.find((existing: any) => existing.id === m.id);
                    if (isNew) {
                        setMessages(prev => [...prev, {
                            id: m.id,
                            me: m.sender === user.id,
                            text: m.text,
                            read: m.read,
                            time: new Date(m.created).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                        }]);

                        if (m.receiver === user.id && !m.read) {
                            pb.collection('direct_messages').update(m.id, { read: true }).catch(() => { });
                            socket?.emit('dm_seen', { messageIds: [m.id], senderId: openChat.id, receiverId: user.id });
                        }
                    }
                }
            } else if (e.action === 'update') {
                setMessages(prev => prev.map((m: any) => m.id === e.record.id ? { ...m, read: e.record.read } : m));
            }
        });

        return () => {
            unsubscribe.then((unsub: any) => unsub());
        };
    }, [user?.id, openChat?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingUsers]);

    const send = async () => {
        if (!newMsg.trim() || !openChat || !user?.id) return;
        const text = newMsg.trim();
        setNewMsg('');
        socket?.emit('dm_typing', { receiverId: openChat.id, typing: false });

        try {
            const record = await pb.collection('direct_messages').create({
                sender: user.id,
                receiver: openChat.id,
                text: text,
                read: false
            });

            socket?.emit('dm_message', {
                id: record.id,
                senderId: user.id,
                receiverId: openChat.id,
                text: text,
                username: user.username || user.name
            });
        } catch (e) {
            alert('Mesaj gönderilemedi.');
        }
    };

    const handleBack = () => {
        if (openChat) setOpenChat(null);
        else navigate('/home');
    };

    useEffect(() => {
        const handler = (e: any) => {
            if (openChat) {
                e.preventDefault();
                setOpenChat(null);
            }
        };
        window.addEventListener('app-back-button', handler);
        return () => window.removeEventListener('app-back-button', handler);
    }, [openChat]);

    const filteredContacts = contacts.filter(c =>
        c.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const onlineList = contacts.filter(c => onlineIds.includes(c.id));

    const Avatar = ({ user, size = 48 }: { user: ChatContact | any, size?: number }) => {
        const pbUrl = user.avatar ? (user.collectionId ? pb.files.getUrl(user, user.avatar) : pb.files.getUrl({ collectionId: 'users', id: user.id }, user.avatar)) : null;

        return (
            <div style={{
                width: size, height: size, borderRadius: '28%',
                background: pbUrl ? 'var(--bg-card-alt)' : (user.color || 'var(--purple-main)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: size * 0.5, flexShrink: 0, position: 'relative', overflow: 'hidden',
                border: '1px solid var(--glass-border)', boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                transition: 'transform 0.3s ease'
            }}>
                {pbUrl ? (
                    <img src={pbUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                ) : (
                    <i className="fa-solid fa-user" style={{ color: 'rgba(255,255,255,0.2)', fontSize: size * 0.4 }}></i>
                )}
            </div>
        );
    };

    // ── Single Chat View ──
    if (openChat) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-deep)', animation: 'lm-slide-up 0.3s ease' }}>
                {/* Chat Header */}
                <div style={{
                    padding: '60px 24px 20px', display: 'flex', alignItems: 'center', gap: 18,
                    background: 'var(--bg-deep)', backdropFilter: 'blur(30px)',
                    borderBottom: '1px solid var(--glass-border)', zIndex: 10
                }}>
                    <div onClick={handleBack} className="header-icon-btn" style={{ background: 'var(--glass-bg)', color: '#fff' }}>
                        <i className="fa-solid fa-chevron-left"></i>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Avatar user={openChat} size={48} />
                        {onlineIds.includes(openChat.id) && (
                            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: '50%', background: '#22c55e', border: '3.5px solid var(--bg-deep)', boxShadow: '0 0 10px #22c55e' }}></div>
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 950, fontSize: 18, color: '#fff', letterSpacing: '-0.5px' }}>
                            {openChat.username}
                        </div>
                        <div style={{ fontSize: 11, color: onlineIds.includes(openChat.id) ? '#22c55e' : 'var(--text-dim)', fontWeight: 800, marginTop: 2 }}>
                            {typingUsers[openChat.id] ? (
                                <span className="animate-pulse">Yazıyor... ✍️</span>
                            ) : onlineIds.includes(openChat.id) ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </div>
                    </div>
                </div>

                {/* ── Animasyonlu Mesaj Balonları ── */}
                <style>{`
                    @keyframes bubble-in-right {
                        0% { opacity: 0; transform: translateX(40px) scale(0.85); }
                        60% { transform: translateX(-6px) scale(1.03); }
                        100% { opacity: 1; transform: translateX(0) scale(1); }
                    }
                    @keyframes bubble-in-left {
                        0% { opacity: 0; transform: translateX(-40px) scale(0.85); }
                        60% { transform: translateX(6px) scale(1.03); }
                        100% { opacity: 1; transform: translateX(0) scale(1); }
                    }
                    @keyframes typing-dot {
                        0%, 80%, 100% { transform: scale(0.7); opacity: 0.3; }
                        40% { transform: scale(1.1); opacity: 1; }
                    }
                    @keyframes neon-pulse {
                        0%, 100% { box-shadow: 0 0 8px rgba(124,77,255,0.6), 0 0 20px rgba(124,77,255,0.3); }
                        50% { box-shadow: 0 0 20px rgba(124,77,255,0.9), 0 0 40px rgba(124,77,255,0.5); }
                    }
                    @keyframes heart-pop {
                        0% { transform: scale(0) rotate(-20deg); opacity: 0; }
                        70% { transform: scale(1.3) rotate(5deg); opacity: 1; }
                        100% { transform: scale(1) rotate(0deg); opacity: 1; }
                    }
                `}</style>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }} className="no-scrollbar">
                    {messages.length === 0 && (
                        <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5 }}>
                            <div style={{ fontSize: 56, marginBottom: 15, animation: 'lm-bounce 2s infinite' }}>💬</div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>İlk mesajı gönder ve sohbet başlasın!</div>
                        </div>
                    )}

                    {messages.map((m, idx) => {
                        // Balona göre stil seç - karşı tarafın bubble_style'ına göre değişir
                        const style = m.me ? 'myStyle' : (openChat.bubbleStyle || 'classic');

                        // Benim balonlarım için arka plan
                        const myBg = 'linear-gradient(135deg, #7c4dff 0%, #e040fb 100%)';
                        const myShadow = '0 8px 25px rgba(124, 77, 255, 0.45)';
                        const myBorderRadius = '22px 22px 6px 22px';

                        // Karşı kişi balonları - stil seçeneği
                        const theirRadius = '22px 22px 22px 6px';
                        let theirBg = 'rgba(255,255,255,0.07)';
                        let theirBorder = '1px solid rgba(255,255,255,0.1)';
                        let theirShadow = '0 8px 20px rgba(0,0,0,0.25)';
                        let theirExtra: React.CSSProperties = {};

                        if (style === 'neon') {
                            theirBg = 'rgba(124,77,255,0.12)';
                            theirBorder = '1px solid rgba(124,77,255,0.5)';
                            theirExtra = { animation: 'neon-pulse 2s ease-in-out infinite' };
                        } else if (style === 'glass') {
                            theirBg = 'rgba(255,255,255,0.1)';
                            theirBorder = '1px solid rgba(255,255,255,0.25)';
                            theirExtra = { backdropFilter: 'blur(20px)' };
                        }

                        return (
                            <div key={m.id || idx} style={{
                                display: 'flex',
                                justifyContent: m.me ? 'flex-end' : 'flex-start',
                                alignItems: 'flex-end',
                                gap: 8,
                                animation: m.me ? 'bubble-in-right 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'bubble-in-left 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                                animationDelay: `${Math.min(idx * 0.04, 0.3)}s`
                            }}>
                                {/* Karşı kişi avatarı */}
                                {!m.me && (
                                    <div style={{ flexShrink: 0, marginBottom: 2 }}>
                                        <Avatar user={openChat} size={30} />
                                    </div>
                                )}

                                {/* Mesaj balonu */}
                                <div style={{
                                    maxWidth: '78%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: m.me ? 'flex-end' : 'flex-start',
                                }}>
                                    <div style={{
                                        padding: '12px 17px',
                                        borderRadius: m.me ? myBorderRadius : theirRadius,
                                        fontSize: 14.5,
                                        lineHeight: 1.55,
                                        position: 'relative',
                                        background: m.me ? myBg : theirBg,
                                        color: '#fff',
                                        border: m.me ? 'none' : theirBorder,
                                        boxShadow: m.me ? myShadow : theirShadow,
                                        fontWeight: 550,
                                        letterSpacing: '0.01em',
                                        wordBreak: 'break-word',
                                        transition: 'transform 0.15s ease',
                                        ...theirExtra
                                    }}>
                                        {m.text}
                                    </div>

                                    {/* Zaman + Okundu durumu */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        marginTop: 4,
                                        paddingLeft: m.me ? 0 : 4,
                                        paddingRight: m.me ? 4 : 0,
                                        justifyContent: m.me ? 'flex-end' : 'flex-start'
                                    }}>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>{m.time}</span>
                                        {m.me && (
                                            <span style={{
                                                fontSize: 12,
                                                color: m.read ? '#38bdf8' : 'rgba(255,255,255,0.25)',
                                                transition: 'color 0.4s ease',
                                                fontWeight: 900
                                            }}>
                                                {m.read ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Yazıyor animasyonu */}
                    {typingUsers[openChat.id] && (
                        <div style={{
                            display: 'flex', gap: 8, alignItems: 'flex-end',
                            animation: 'bubble-in-left 0.3s ease both'
                        }}>
                            <Avatar user={openChat} size={28} />
                            <div style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '12px 18px',
                                borderRadius: '20px 20px 20px 4px',
                                display: 'flex', gap: 5, alignItems: 'center'
                            }}>
                                {[0, 1, 2].map(i => (
                                    <div key={i} style={{
                                        width: 7, height: 7, borderRadius: '50%',
                                        background: 'rgba(124,77,255,0.8)',
                                        animation: `typing-dot 1.2s ease-in-out ${i * 0.18}s infinite`
                                    }} />
                                ))}
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '10px 16px 20px', background: 'rgba(6, 4, 26, 0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-dark)', padding: '6px 6px 6px 16px', borderRadius: 30, border: '1px solid var(--glass-border)' }}>
                        <input
                            value={newMsg}
                            onChange={e => {
                                setNewMsg(e.target.value);
                                socket?.emit('dm_typing', { receiverId: openChat.id, typing: e.target.value.length > 0 });
                            }}
                            onKeyDown={e => e.key === 'Enter' && send()}
                            placeholder="Bir mesaj yaz..."
                            style={{ flex: 1, background: 'none', border: 'none', color: '#fff', outline: 'none', fontSize: 15 }}
                        />
                        <button
                            onClick={send}
                            style={{
                                width: 44, height: 44, borderRadius: '50%', background: newMsg.trim() ? 'var(--purple-main)' : 'var(--bg-card)',
                                border: 'none', color: '#fff', cursor: 'pointer', transition: '0.3s',
                                boxShadow: newMsg.trim() ? '0 5px 15px rgba(124, 77, 255, 0.4)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <i className="fa-solid fa-paper-plane" style={{ transform: 'translateX(-2px)' }} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Chat List View ──
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-deep)', paddingBottom: '75px' }}>
            <div style={{ padding: '50px 20px 20px', animation: 'lm-slide-down 0.4s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 950, letterSpacing: '-1.5px', margin: 0, background: 'var(--premium-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mesajlar</h1>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div onClick={() => setShowSearch(!showSearch)} style={{ width: 44, height: 44, borderRadius: '15px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}><i className="fa-solid fa-magnifying-glass"></i></div>
                    </div>
                </div>

                {showSearch && (
                    <div style={{ marginBottom: 20, animation: 'lm-slide-down 0.2s ease' }}>
                        <input
                            autoFocus
                            placeholder="Kullanıcı ara..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '14px 20px', borderRadius: 20, background: 'var(--bg-card)',
                                border: '1px solid var(--glass-border)', color: '#fff', fontSize: 15, outline: 'none'
                            }}
                        />
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 8, background: 'var(--bg-card)', padding: 6, borderRadius: 24, border: '1px solid var(--glass-border)' }}>
                    {['Sohbetler', 'Çevrimiçi'].map((t, i) => (
                        <div
                            key={t}
                            onClick={() => setActiveTab(i === 0 ? 'messages' : 'online')}
                            style={{
                                flex: 1, padding: '12px', textAlign: 'center', borderRadius: 18, fontSize: 14, fontWeight: 800,
                                background: (i === 0 && activeTab === 'messages') || (i === 1 && activeTab === 'online') ? 'var(--purple-main)' : 'transparent',
                                color: (i === 0 && activeTab === 'messages') || (i === 1 && activeTab === 'online') ? '#fff' : 'var(--text-dim)',
                                transition: 'all 0.3s ease', cursor: 'pointer',
                                boxShadow: (i === 0 && activeTab === 'messages') || (i === 1 && activeTab === 'online') ? '0 5px 15px rgba(124, 77, 255, 0.4)' : 'none'
                            }}
                        >{t}</div>
                    ))}
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }} className="no-scrollbar">
                {activeTab === 'messages' ? (
                    loadingContacts ? (
                        <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>Yükleniyor...</div>
                    ) : filteredContacts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.3 }}>
                            <div style={{ fontSize: 60, marginBottom: 20 }}>💬</div>
                            <div style={{ fontWeight: 800 }}>Henüz bir mesajın yok.</div>
                        </div>
                    ) : (
                        filteredContacts.map(c => (
                            <div
                                key={c.id}
                                onClick={() => setOpenChat(c)}
                                className="lm-premium-card"
                                style={{
                                    display: 'flex', gap: 16, padding: '16px', cursor: 'pointer',
                                    transition: 'transform 0.2s', position: 'relative', overflow: 'hidden'
                                }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <Avatar user={c} size={56} />
                                    {onlineIds.includes(c.id) && (
                                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '3.5px solid var(--bg-deep)' }}></div>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-white)' }}>
                                            {c.username}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        Sohbeti başlatmak için dokun 💌
                                    </div>
                                </div>
                            </div>
                        ))
                    )
                ) : (
                    onlineList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 100, opacity: 0.2 }}>
                            <i className="fa-solid fa-moon" style={{ fontSize: 40, marginBottom: 15 }}></i>
                            <div>Herkes uyuyor sanırım...</div>
                        </div>
                    ) : (
                        onlineList.map(u => (
                            <div
                                key={u.id}
                                onClick={() => setOpenChat(u)}
                                className="lm-premium-card"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 16, padding: '16px', cursor: 'pointer'
                                }}
                            >
                                <Avatar user={u} size={56} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-white)' }}>{u.username}</div>
                                    <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 800, marginTop: 4 }}>Çevrimiçi</div>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
}
