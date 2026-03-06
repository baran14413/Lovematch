import { useState, useEffect, useRef } from 'react';
import { pb } from '../pb';
import { io, Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const SERVER_URL = ''; // Proxied via Caddy

type Phase = 'lobby' | 'matching' | 'chat';

export default function OneVsOneMatchPage({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>('lobby');
    const [matchProgress, setMatchProgress] = useState(0);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [matchedUser, setMatchedUser] = useState<any>(null);
    const matchedUserRef = useRef<any>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const roomIdRef = useRef<string | null>(null); // For background reconnects

    const [chat, setChat] = useState<any[]>([]);
    const [msg, setMsg] = useState('');

    const [showLeaveWarning, setShowLeaveWarning] = useState(false);
    const [showEndOptions, setShowEndOptions] = useState(false);
    const [partnerDecision, setPartnerDecision] = useState<string | null>(null);

    const [micOn, setMicOn] = useState(false);
    const [voiceConnected, setVoiceConnected] = useState(false);

    const localStream = useRef<MediaStream | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const remoteAudio = useRef<HTMLAudioElement | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const user = pb.authStore.model;

    useEffect(() => {
        if (!user) return;
        const s = io(SERVER_URL);
        setSocket(s);

        s.on('connect', () => {
            if (roomIdRef.current) {
                s.emit('join_1v1_room_reconnect', roomIdRef.current);
            }
        });

        s.on('1v1_matched', ({ roomId, partner }) => {
            setRoomId(roomId);
            roomIdRef.current = roomId;
            setMatchedUser(partner);
            matchedUserRef.current = partner;
            setPhase('chat');
            setMatchProgress(100);

            const avatarUrl = user.avatar ? pb.files.getUrl(user, user.avatar) : '';

            s.emit('join_room', {
                roomId,
                uid: user.id,
                name: user.username || user.name || 'Sen',
                avatar: avatarUrl,
                color: 'var(--purple-main)'
            });
        });

        s.on('receive_message', (message: any) => {
            setChat(prev => {
                // aynı mesaj eklenmesin (optimistic duplicate check)
                if (prev.find(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        });

        s.on('1v1_partner_decision', (decision: string) => {
            setPartnerDecision(decision);
            if (decision === 'decline') {
                alert('Eşleştiğin kişi sohbeti uzatmak istemedi.');
                cleanupAndClose();
            }
        });

        s.on('1v1_dm_start', () => {
            cleanupVoice();
            if (s) {
                s.emit('leave_1v1_pool');
                if (roomIdRef.current) s.emit('leave_1v1_room', roomIdRef.current);
            }
            const targetUid = matchedUserRef.current?.uid;
            onClose();
            if (targetUid) {
                navigate(`/chat?userId=${targetUid}`);
            }
        });

        s.on('user_ready_voice', async (senderId: string) => {
            if (localStream.current) {
                createPeerConnection(senderId, s, true);
            }
        });

        s.on('webrtc_offer', async ({ sender, offer }) => {
            const pc = createPeerConnection(sender, s, false);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            s.emit('webrtc_answer', { target: sender, answer });
        });

        s.on('webrtc_answer', async ({ answer }) => {
            const pc = peerConnection.current;
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        s.on('webrtc_ice_candidate', async ({ candidate }) => {
            const pc = peerConnection.current;
            if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        s.on('partner_left', () => {
            if (!showEndOptions) {
                alert('Eşleştiğin kullanıcı ayrıldı.');
            }
            cleanupVoice();
            setPhase('lobby');
            setRoomId(null);
            setMatchedUser(null);
            setChat([]);
            setShowEndOptions(false);
        });

        return () => {
            cleanupVoice();
            if (s) {
                s.emit('leave_1v1_pool');
                s.disconnect();
            }
        };
    }, []);

    const startMatching = () => {
        if (!socket || !user) return;
        setPhase('matching');
        setMatchProgress(0);

        const avatarUrl = user.avatar ? pb.files.getUrl(user, user.avatar) : '';

        socket.emit('join_1v1_pool', {
            uid: user.id,
            name: user.name || user.username || 'İsimsiz',
            avatar: avatarUrl
        });

        let p = 0;
        const iv = setInterval(() => {
            p += Math.random() * 15;
            if (p > 95) p = 95;
            setMatchProgress(p);
        }, 1000);

        return () => clearInterval(iv);
    };

    const cancelMatching = () => {
        if (!socket) return;
        socket.emit('leave_1v1_pool');
        setPhase('lobby');
        setMatchProgress(0);
    };

    const createPeerConnection = (targetId: string, s: Socket, isInitiator: boolean) => {
        if (peerConnection.current) return peerConnection.current;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnection.current = pc;
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current!));
        }
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                s.emit('webrtc_ice_candidate', { target: targetId, candidate: event.candidate });
            }
        };
        pc.ontrack = (event) => {
            if (!remoteAudio.current) {
                const audio = new Audio();
                audio.autoplay = true;
                remoteAudio.current = audio;
            }
            remoteAudio.current.srcObject = event.streams[0];
        };
        if (isInitiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                s.emit('webrtc_offer', { target: targetId, offer });
            });
        }
        return pc;
    };

    const joinVoice = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStream.current = stream;
            setVoiceConnected(true);
            setMicOn(true);
            socket?.emit('ready_for_voice');
        } catch (err) {
            console.error("Mic error:", err);
            alert("Sese bağlanılamadı! Mikrofon iznini kontrol edin.");
        }
    };

    const toggleMic = () => {
        if (!localStream.current) return;
        const enabled = localStream.current.getAudioTracks()[0].enabled;
        localStream.current.getAudioTracks()[0].enabled = !enabled;
        setMicOn(!enabled);
    };

    const cleanupVoice = () => {
        localStream.current?.getTracks().forEach(t => t.stop());
        localStream.current = null;
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        setVoiceConnected(false);
        setMicOn(false);
    };

    const handleSend = () => {
        if (!msg.trim() || !socket || !user || !roomId) return;

        const tempMsg = {
            id: Date.now().toString(),
            text: msg,
            uid: user.id,
            name: user.name || user.username || 'Sen',
            icon: '💬',
            color: 'var(--purple-main)',
            createdAt: new Date().toISOString()
        };

        // Optimistic append
        setChat(prev => [...prev, tempMsg]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

        socket.emit('send_message', tempMsg);
        setMsg('');
    };

    const cleanupAndClose = () => {
        cleanupVoice();
        if (socket) socket.emit('leave_1v1_room', roomId);
        setPhase('lobby');
        setRoomId(null);
        roomIdRef.current = null;
        setMatchedUser(null);
        setChat([]);
        setShowLeaveWarning(false);
        setShowEndOptions(false);
    };

    const handleLeaveRequest = () => {
        setShowLeaveWarning(true);
    };

    const [timeLeft, setTimeLeft] = useState(180);
    const matchEndTime = useRef<number | null>(null);

    useEffect(() => {
        if (phase === 'chat' && !showEndOptions) {
            // Absolute time checking
            if (!matchEndTime.current) {
                matchEndTime.current = Date.now() + 180 * 1000;
            }

            const timer = setInterval(() => {
                const remaining = Math.max(0, Math.floor((matchEndTime.current! - Date.now()) / 1000));
                setTimeLeft(remaining);

                if (remaining === 0) {
                    setShowEndOptions(true);
                    clearInterval(timer);
                }
            }, 1000);

            return () => clearInterval(timer);
        } else {
            matchEndTime.current = null; // reset for next match
        }
    }, [phase, showEndOptions]);

    const acceptDM = () => {
        socket?.emit('1v1_decision', { targetRoom: roomId, decision: 'accept' });
        setPartnerDecision('waiting');
    };

    const declineDM = () => {
        socket?.emit('send_message', { room: roomId, text: 'Kullanıcı eşleşmeyi sonlandırdı.', sys: true });
        socket?.emit('1v1_decision', { targetRoom: roomId, decision: 'decline' });
        cleanupAndClose();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg-deep)', color: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Ambient Background */}
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%', background: 'radial-gradient(circle at center, rgba(124, 77, 255, 0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Header */}
            <div style={{
                padding: '50px 20px 15px',
                display: 'flex',
                alignItems: 'center',
                gap: 15,
                background: 'rgba(6, 4, 26, 0.8)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid var(--glass-border)',
                zIndex: 10
            }}>
                <div onClick={phase === 'chat' ? handleLeaveRequest : onClose} style={{
                    width: 40, height: 40, borderRadius: 12, background: 'var(--glass-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}>
                    <i className="fa-solid fa-chevron-left"></i>
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>1v1 Eşleşme</div>
                    {phase === 'chat' && <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 800 }}>● CANLI BAĞLANTI</div>}
                </div>
                {phase === 'chat' && (
                    <div style={{
                        background: timeLeft < 30 ? 'rgba(239, 68, 68, 0.2)' : 'var(--glass-bg)',
                        padding: '6px 14px', borderRadius: 20, fontSize: 14, fontWeight: 900,
                        color: timeLeft < 30 ? '#ef4444' : '#fff', border: '1px solid var(--glass-border)'
                    }}>
                        {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes radar-spin { 100% { transform: rotate(360deg); } }
                @keyframes match-pulse { 0% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.4); } 70% { box-shadow: 0 0 0 30px rgba(236, 72, 153, 0); } 100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0); } }
                @keyframes float-avatar { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .radar-container { position: relative; width: 200px; height: 200px; margin: 0 auto 40px; border-radius: 50%; border: 2px solid rgba(139, 92, 246, 0.3); background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%); box-shadow: 0 0 40px rgba(139, 92, 246, 0.2); }
                .radar-container::after { content: ''; position: absolute; inset: 0; border-radius: 50%; border: 1px dashed rgba(236, 72, 153, 0.4); animation: radar-spin 10s linear infinite; }
                .radar-core { position: absolute; inset: 40px; background: var(--premium-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 50px; z-index: 10; animation: match-pulse 2s infinite; }
                .radar-core img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; padding: 4px; background: #000; }
                
                .match-vs-box { position: relative; width: 100%; padding: 30px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .match-avatar { width: 90px; height: 90px; border-radius: 30px; background: var(--glass-bg); display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 900; border: 2px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); object-fit: cover; z-index: 2; overflow: hidden; }
                .match-avatar.left { animation: slideInLeft 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); border-color: #ec4899; box-shadow: 0 0 30px rgba(236, 72, 153, 0.3); }
                .match-avatar.right { animation: slideInRight 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); border-color: #8b5cf6; box-shadow: 0 0 30px rgba(139, 92, 246, 0.3); }
                
                .match-vs-text { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 45px; font-weight: 950; font-style: italic; background: linear-gradient(135deg, #fcd34d, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.5)); z-index: 1; animation: zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards 0.2s; }
                
                @keyframes slideInLeft { from { transform: translateX(-100px) rotate(-20deg); opacity: 0; } to { transform: translateX(0) rotate(0); opacity: 1; } }
                @keyframes slideInRight { from { transform: translateX(100px) rotate(20deg); opacity: 0; } to { transform: translateX(0) rotate(0); opacity: 1; } }
                @keyframes zoomIn { from { transform: translate(-50%, -50%) scale(0); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
            `}</style>

            {/* Lobby Phase */}
            {phase === 'lobby' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, animation: 'lm-fade-in 0.5s ease' }}>

                    <div className="radar-container">
                        <div className="radar-core">
                            {user?.avatar ? (
                                <img src={pb.files.getUrl(user, user.avatar)} alt="Me" />
                            ) : (
                                <span>😎</span>
                            )}
                        </div>
                    </div>

                    <h2 style={{ fontSize: 36, fontWeight: 950, marginBottom: 12, textAlign: 'center', letterSpacing: '-1.5px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Ruh Eşini Bul
                    </h2>
                    <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginBottom: 50, padding: '0 20px', lineHeight: 1.6, fontSize: 16, fontWeight: 600 }}>
                        Evrenin derinliklerinden sana uygun kişiyi arıyoruz. Anonim sohbete hazır mısın?
                    </p>
                    <button
                        onClick={startMatching}
                        style={{ width: '100%', maxWidth: 300, fontSize: 18, padding: '18px 0', borderRadius: 24, background: 'var(--premium-gradient)', border: 'none', color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 30px rgba(236, 72, 153, 0.4)', transition: '0.3s' }}
                    >
                        RADARI ÇALIŞTIR <i className="fa-solid fa-satellite-dish" style={{ marginLeft: 8 }}></i>
                    </button>
                </div>
            )}

            {/* Matching Phase */}
            {phase === 'matching' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, animation: 'lm-scale-up 0.4s ease' }}>

                    <div className="match-vs-box">
                        <div className="match-avatar left">
                            {user?.avatar ? <img src={pb.files.getUrl(user, user.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="fa-solid fa-user"></i>}
                        </div>
                        <div className="match-vs-text">VS</div>
                        <div className="match-avatar right" style={{ animation: 'match-pulse 1s infinite alternate' }}>
                            <i className="fa-solid fa-user-secret" style={{ color: '#8b5cf6' }}></i>
                        </div>
                    </div>

                    <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 15, background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Taranıyor...
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 40, fontWeight: 700, textAlign: 'center' }}>
                        Frekanslar eşleştiriliyor, lütfen bekle! <br /> Algoritma çalışıyor...
                    </div>

                    <div style={{ width: '100%', maxWidth: 300, height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ height: '100%', width: `${matchProgress}%`, background: 'var(--premium-gradient)', borderRadius: 12, transition: 'width 0.3s ease', boxShadow: '0 0 10px rgba(168, 85, 247, 0.8)' }} />
                    </div>

                    <button
                        onClick={cancelMatching}
                        style={{ marginTop: 50, padding: '12px 30px', borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                    >
                        Taramayı Durdur
                    </button>
                </div>
            )}

            {/* Chat Phase */}
            {phase === 'chat' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'lm-slide-up 0.4s ease' }}>
                    {/* Partner Bar */}
                    <div style={{
                        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 15,
                        background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--glass-border)'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: 18, background: 'var(--premium-gradient)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                                boxShadow: '0 5px 15px rgba(236, 72, 153, 0.3)', overflow: 'hidden'
                            }}>
                                {matchedUser?.avatar ? (
                                    <img src={matchedUser.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <i className="fa-solid fa-user-secret" style={{ color: 'rgba(255,255,255,0.2)' }}></i>
                                )}
                            </div>
                            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, background: '#22c55e', borderRadius: '50%', border: '3px solid var(--bg-deep)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 17, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {matchedUser?.name} <span style={{ fontSize: 10, background: 'var(--glass-bg)', padding: '2px 8px', borderRadius: 8, color: 'var(--text-dim)' }}>GİZLİ</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 800, marginTop: 2 }}>Şu an çevrimiçi</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div onClick={() => voiceConnected ? toggleMic() : joinVoice()} style={{
                                width: 40, height: 40, borderRadius: 14,
                                background: voiceConnected ? (micOn ? '#22c55e' : 'rgba(239, 68, 68, 0.15)') : 'rgba(255,255,255,0.05)',
                                color: voiceConnected && !micOn ? '#ef4444' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: voiceConnected && micOn ? '0 5px 15px rgba(34, 197, 94, 0.3)' : 'none',
                                transition: '0.3s'
                            }}>
                                <i className={`fa-solid ${voiceConnected ? (micOn ? 'fa-microphone' : 'fa-microphone-slash') : 'fa-phone'}`} style={{ fontSize: 16 }}></i>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }} className="no-scrollbar">
                        <div style={{
                            textAlign: 'center', padding: '24px', borderRadius: 24,
                            background: 'rgba(124, 77, 255, 0.1)', border: '1px solid rgba(124, 77, 255, 0.2)',
                            marginBottom: 20
                        }}>
                            <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
                            <div style={{ color: 'var(--purple-light)', fontWeight: 900, fontSize: 16 }}>Eşleşme Tamamlandı!</div>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5, fontWeight: 600 }}>Ruh eşinle tanışmaya hazır ol. İlk mesajı sen gönder!</div>
                        </div>

                        {chat.map((m, idx) => {
                            const isMe = m.uid === user?.id;
                            return (
                                <div key={idx} style={{
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    animation: 'lm-slide-up 0.3s ease'
                                }}>
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: m.sys ? '12px' : (isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px'),
                                        background: m.sys ? 'rgba(255,255,255,0.1)' : (isMe ? 'var(--premium-gradient)' : 'var(--bg-card)'),
                                        color: m.sys ? '#fbbf24' : '#fff',
                                        fontSize: 14,
                                        fontWeight: m.sys ? 800 : 500,
                                        lineHeight: 1.5,
                                        textAlign: m.sys ? 'center' : 'left',
                                        border: (isMe || m.sys) ? 'none' : '1px solid var(--glass-border)',
                                        boxShadow: isMe ? '0 5px 15px rgba(124, 77, 255, 0.2)' : 'none'
                                    }}>
                                        {m.text}
                                    </div>
                                    {!m.sys && (
                                        <div style={{
                                            fontSize: 9, opacity: 0.5, marginTop: 4,
                                            textAlign: isMe ? 'right' : 'left', fontWeight: 800
                                        }}>
                                            {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '10px 15px', background: 'rgba(6, 4, 26, 0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
                        <div style={{
                            display: 'flex', gap: 10, background: 'var(--bg-dark)',
                            borderRadius: 24, padding: '4px 4px 4px 15px', alignItems: 'center',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <input
                                style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 14, outline: 'none', height: 36 }}
                                placeholder="Bir şeyler yaz..."
                                value={msg}
                                onChange={e => setMsg(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                            />
                            <div onClick={handleSend} style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: msg.trim() ? 'var(--premium-gradient)' : 'var(--glass-bg)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                transition: '0.3s', color: '#fff'
                            }}>
                                <i className="fa-solid fa-paper-plane" style={{ fontSize: 13 }}></i>
                            </div>
                        </div>
                    </div>

                    {/* Çıkış Uyarı Modalı */}
                    {showLeaveWarning && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                            <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '30px 20px', textAlign: 'center', width: '100%', maxWidth: 320, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', animation: 'lm-scale-up 0.3s ease' }}>
                                <div style={{ fontSize: 50, marginBottom: 15 }}>⚠️</div>
                                <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Emin misin?</h3>
                                <p style={{ color: '#999', fontSize: 14, marginBottom: 30, lineHeight: 1.5 }}>Çıkış yaparsan bu eşleşme tamamen sonlandırılacak ve kişiyi bir daha göremeyeceksin.</p>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => setShowLeaveWarning(false)} style={{ flex: 1, padding: 14, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 800 }}>Vazgeç</button>
                                    <button onClick={cleanupAndClose} style={{ flex: 1, padding: 14, borderRadius: 16, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 900 }}>Çıkış Yap</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Süre Bitti & End Options Modalı */}
                    {showEndOptions && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'lm-fade-in 0.5s ease' }}>
                            <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
                                <h2 style={{ fontSize: 32, fontWeight: 950, marginBottom: 10, background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Süre Doldu!</h2>
                                <p style={{ color: '#aaa', fontSize: 15, marginBottom: 40, fontWeight: 600 }}>1v1 anonim sohbetin süresi bitti. Dilersen DM (Özel Mesaj) kısmına taşıyıp konuşmaya devam edebilirsiniz.</p>

                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 50 }}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--premium-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #ec4899', zIndex: 2, transform: 'translateX(10px)', boxShadow: '0 0 30px rgba(236,72,153,0.4)', animation: 'slideInLeft 0.5s ease' }}>
                                        {user?.avatar ? <img src={pb.files.getUrl(user, user.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>👤</span>}
                                    </div>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #8b5cf6', zIndex: 1, transform: 'translateX(-10px)', boxShadow: '0 0 30px rgba(139,92,246,0.4)', animation: 'slideInRight 0.5s ease' }}>
                                        {matchedUser?.avatar ? <img src={matchedUser.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🕵️</span>}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                                    {partnerDecision === 'waiting' ? (
                                        <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, textAlign: 'center', padding: 20 }}>
                                            Karşı tarafın onayı bekleniyor... ⏳
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={acceptDM} style={{ padding: '16px', borderRadius: 20, background: 'var(--premium-gradient)', border: 'none', color: '#fff', fontSize: 16, fontWeight: 900, boxShadow: '0 10px 20px rgba(236, 72, 153, 0.3)', cursor: 'pointer' }}>
                                                Yazışmaya DM'de Devam Et ✨
                                            </button>
                                            <button onClick={declineDM} style={{ padding: '16px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                                                Teşekkürler, Sonlandır (Reddet)
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
