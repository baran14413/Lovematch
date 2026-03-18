import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { pb } from '../pb';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

/**
 * LOVEMATCH REBORN V15 - ULTRA STABLE AUDIO & VIDEO
 * Fix: 
 *  - Ses kesik kesik → TURN sunucu eklendi, audio constraints optimize edildi
 *  - Kamera siyah → remote stream state ile senkronize edildi
 *  - Peer yeniden bağlanma fırtınası → createPeer stabilize edildi
 */

// ICE Sunucu Listesi - STUN + TURN (Maksimum Bağlanabilirlik)
// NAT, Firewall, 4G/WiFi farklılıklarını aşmak için çok sayıda sunucu
const ICE_SERVERS = [
    // Google STUN
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Cloudflare STUN
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Twilio STUN
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Metered TURN (ücretsiz, güvenilir)
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    // Xirsys ücretsiz TURN
    { urls: 'stun:fr-turn1.xirsys.com' },
    { urls: 'turn:fr-turn1.xirsys.com:80?transport=udp', username: 'KfYd3jSJKEi9Nq9_m6bv', credential: 'KfYd3jSJKEi9Nq9_m6bv' },
    { urls: 'turn:fr-turn1.xirsys.com:80?transport=tcp', username: 'KfYd3jSJKEi9Nq9_m6bv', credential: 'KfYd3jSJKEi9Nq9_m6bv' },
    // Numb TURN
    { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' },
    // BenOnvif TURN
    { urls: 'turn:relay1.expressturn.com:3478', username: 'efNMCOMTPW7AXXFM22', credential: 'Ene3bSwsbrg2Zjl2' }
];

// Optimize ses kalite ayarları - Ultra Düşük Gecikme
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,      // Yankı iptali aktif
    noiseSuppression: true,      // Gürültü bastırma aktif
    autoGainControl: true,       // Otomatik kazanç
    // @ts-ignore
    googEchoCancellation: true,  // Chrome için ek yankı iptali
    googNoiseSuppression: true,  // Chrome için ek gürültü bastırma
    googHighpassFilter: true,    // Yüksek geçiş filtresi (alçak frekans gürültüsü gider)
    googTypingNoiseDetection: true, // Klavye gürültüsünü algıla
    sampleRate: 48000,           // Yüksek kalite örnekleme
    channelCount: 1,             // Mono - bant genişliğini optimize eder
};

export function usePartyRoom(roomId: string) {
    const { socket, isConnected: socketConnected, authStatus } = useSocket();
    const [roomState, setRoomState] = useState<any>(null);
    const [chat, setChat] = useState<any[]>([]);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // React state olarak remoteStreams → component re-render için
    const [remoteStreamsState, setRemoteStreamsState] = useState<Map<string, MediaStream>>(new Map());

    // Mesh WebRTC Refs
    const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStream = useRef<MediaStream | null>(null);
    // Hem ref hem de state olarak saklıyoruz
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

    // Voice Detection Refs
    const audioContext = useRef<AudioContext | null>(null);
    const analyzer = useRef<AnalyserNode | null>(null);
    const micSource = useRef<MediaStreamAudioSourceNode | null>(null);
    const lastVolumeRef = useRef(0);
    const micOnRef = useRef(false);
    const vadFrameRef = useRef<number>(0);

    // Remote stream güncelleme - hem ref hem state'i güncelle (React'in görmesi için)
    const updateRemoteStream = useCallback((socketId: string, stream: MediaStream) => {
        remoteStreamsRef.current.set(socketId, stream);
        // Yeni Map oluşturarak React'i re-render'a zorla
        setRemoteStreamsState(new Map(remoteStreamsRef.current));
    }, []);

    // ICE candidate kuyruğu - remote description olmadan ICE ekleme engeli
    const iceCandidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

    // Bekleyen ICE candidate'leri ekle
    const flushIceCandidates = useCallback(async (pc: RTCPeerConnection, socketId: string) => {
        const queued = iceCandidateQueue.current.get(socketId) || [];
        iceCandidateQueue.current.delete(socketId);
        for (const c of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(e =>
                console.warn('[ICE] Queue flush failed:', e)
            );
        }
    }, []);

    // Peer bağlantısı oluştur
    const createPeer = useCallback((targetSocketId: string, stream?: MediaStream) => {
        // Eğer zaten bağlı bir PC varsa, sadece yeni track'leri ekle ve devam et
        const existing = peers.current.get(targetSocketId);
        if (existing && (existing.connectionState === 'connected' || existing.connectionState === 'connecting')) {
            if (stream) {
                stream.getTracks().forEach(track => {
                    const alreadyAdded = existing.getSenders().some(s => s.track?.id === track.id);
                    if (!alreadyAdded) {
                        existing.addTrack(track, stream);
                    }
                });
            }
            return existing;
        }

        // Eğer PC kopmuşsa veya hiç yoksa yeni oluştur
        if (existing) {
            existing.close();
            peers.current.delete(targetSocketId);
        }

        const pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
            iceTransportPolicy: 'all',      // TURN'ü de dene
            bundlePolicy: 'max-bundle',      // Bant genişliği tasarrufu
            rtcpMuxPolicy: 'require'         // RTCP multiplexing
        });

        // ICE adayı gönder
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket?.emit('webrtc_signal', {
                    to: targetSocketId,
                    signal: event.candidate,
                    type: 'ice'
                });
            }
        };

        // Renegotiation (Yeni track eklendiğinde teklif gönder)
        pc.onnegotiationneeded = () => {
            sendOffer(targetSocketId);
        };

        // ICE bağlantı durumu değişirse log'la
        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE State (${targetSocketId.slice(-4)}):`, pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                // ICE restart dene
                pc.restartIce();
            }
        };

        // Uzak taraftan track geldiğinde
        pc.ontrack = (event) => {
            console.log('[WebRTC] Track:', event.track.kind, 'from:', targetSocketId.slice(-4));

            let rStream = remoteStreamsRef.current.get(targetSocketId);
            if (!rStream) {
                rStream = new MediaStream();
            }

            // Aynı kind track zaten varsa değiştir
            const existingTracks = rStream.getTracks().filter(t => t.kind === event.track.kind);
            existingTracks.forEach(t => rStream!.removeTrack(t));
            rStream.addTrack(event.track);

            // State güncelle (React re-render için)
            updateRemoteStream(targetSocketId, rStream);

            // Ses track'i için Audio eleman oynat
            if (event.track.kind === 'audio') {
                const audioEl = document.createElement('audio');
                audioEl.id = `audio-${targetSocketId}`;
                // Eski audio elementini kaldır
                document.getElementById(`audio-${targetSocketId}`)?.remove();
                audioEl.srcObject = rStream;
                audioEl.autoplay = true;
                audioEl.setAttribute('playsinline', 'true');
                document.body.appendChild(audioEl);
                audioEl.play().catch(e => console.error('[Audio] Play failed:', e));
            }
        };

        // Local stream track'lerini ekle
        if (stream) {
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });
        }

        peers.current.set(targetSocketId, pc);
        return pc;
    }, [socket, updateRemoteStream]);

    // WebRTC sinyal işleyici
    const handleSignal = useCallback(async (data: any) => {
        const { from, signal, type } = data;

        try {
            if (type === 'offer') {
                // Teklifi al ve cevap oluştur
                const pc = createPeer(from, localStream.current || undefined);
                // Tüm sinyalleme durumlarını kontrol et
                if (pc.signalingState === 'have-local-offer') {
                    // Rollback yaparak stable durumuna dön
                    await pc.setLocalDescription({ type: 'rollback' }).catch(() => { });
                }
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                // Bekleyen ICE candidate'leri flush et
                await flushIceCandidates(pc, from);
                const answer = await pc.createAnswer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                await pc.setLocalDescription(answer);
                socket?.emit('webrtc_signal', { to: from, signal: answer, type: 'answer' });

            } else if (type === 'answer') {
                const pc = peers.current.get(from);
                if (pc && pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    // Bekleyen ICE candidate'leri flush et
                    await flushIceCandidates(pc, from);
                }

            } else if (type === 'ice') {
                const pc = peers.current.get(from);
                if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                    // Remote description var, direkt ekle
                    await pc.addIceCandidate(new RTCIceCandidate(signal)).catch(e =>
                        console.warn('[ICE] Candidate add failed:', e)
                    );
                } else {
                    // Remote description yok, kuyruğa al
                    const q = iceCandidateQueue.current.get(from) || [];
                    q.push(signal);
                    iceCandidateQueue.current.set(from, q);
                }
            }
        } catch (e) {
            console.error('[WebRTC] Signal error:', e);
        }
    }, [socket, createPeer, flushIceCandidates]);

    // Diğer kişiye offer gönder
    const sendOffer = useCallback(async (targetSocketId: string) => {
        if (!localStream.current) return;
        const pc = createPeer(targetSocketId, localStream.current);
        try {
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                iceRestart: false
            });
            await pc.setLocalDescription(offer);
            socket?.emit('webrtc_signal', { to: targetSocketId, signal: offer, type: 'offer' });
        } catch (e) {
            console.error('[WebRTC] Offer create failed:', e);
        }
    }, [socket, createPeer]);

    // VAD (Ses Algılama)
    const startVoiceDetection = useCallback((stream: MediaStream) => {
        try {
            if (!audioContext.current) {
                audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
            }
            if (audioContext.current.state === 'suspended') audioContext.current.resume();
            if (!analyzer.current) {
                analyzer.current = audioContext.current.createAnalyser();
                analyzer.current.fftSize = 512;
                analyzer.current.smoothingTimeConstant = 0.75;
            }

            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) return;

            if (micSource.current) micSource.current.disconnect();
            micSource.current = audioContext.current.createMediaStreamSource(stream);
            micSource.current.connect(analyzer.current);

            const bufferLength = analyzer.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            cancelAnimationFrame(vadFrameRef.current);

            const checkVolume = () => {
                if (!localStream.current || !analyzer.current || !micOnRef.current) {
                    socket?.emit('speaking_state', 0);
                    return;
                }
                analyzer.current.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                const average = sum / bufferLength;
                const volume = Math.min(100, Math.floor((average / 128) * 100));

                if (Math.abs(volume - lastVolumeRef.current) > 3) {
                    lastVolumeRef.current = volume;
                    socket?.emit('speaking_state', volume);
                }

                vadFrameRef.current = requestAnimationFrame(checkVolume);
            };

            checkVolume();
        } catch (e) {
            console.error('[VAD] Init failed:', e);
        }
    }, [socket]);

    // Socket event listener'ları
    useEffect(() => {
        if (socketConnected && authStatus === 'authenticated') {
            socket?.emit('join_room', roomId);
        }
    }, [socketConnected, authStatus, roomId, socket]);

    useEffect(() => {
        if (!socket) return;

        const onSnapshot = (raw: any) => {
            const data = {
                ...raw,
                seats: raw.seats || new Array(raw.maxSeatCount || 8).fill(null),
                lockedSeats: raw.lockedSeats || new Array(raw.maxSeatCount || 8).fill(false)
            };
            setRoomState(data);
            setChat((data.messages || []).slice(-50));
            setIsLoading(false);

            // Peer Temizliği: Koltukta olmayanların bağlantılarını kapat
            const currentSeatUids = new Set(data.seats.filter((s: any) => s && s.uid).map((s: any) => s.uid));
            peers.current.forEach((pc, socketId) => {
                // socketId (uid) artık koltukta değilse kapat
                if (!currentSeatUids.has(socketId)) {
                    console.log('[WebRTC] Cleaning up stale peer:', socketId);
                    pc.close();
                    peers.current.delete(socketId);
                    const stream = remoteStreamsRef.current.get(socketId);
                    if (stream) {
                        stream.getTracks().forEach(t => t.stop());
                        remoteStreamsRef.current.delete(socketId);
                        setRemoteStreamsState(new Map(remoteStreamsRef.current));
                    }
                    document.getElementById(`audio-${socketId}`)?.remove();
                }
            });

            // Odaya girince koltukta olan herkesten offer iste (henüz bağlı değilsek)
            if (data.seats) {
                data.seats.forEach((seat: any) => {
                    if (seat && (seat.uid || seat.socketId) && (seat.uid !== pb.authStore.model?.id)) {
                        const targetId = seat.uid || seat.id;
                        if (!peers.current.has(targetId)) {
                            socket?.emit('request_offer', { to: targetId });
                        }
                    }
                });
            }
        };

        const onMsg = (msg: any) => setChat(prev => [...prev, msg].slice(-50));
        const onClearChat = () => setChat([]);
        const onSeatsSync = (seats: any) => setRoomState((prev: any) => prev ? { ...prev, seats } : null);

        const onUserJoined = (data: any) => {
            // Yeni kişi odaya girdi → eğer micımız/kameramız açıksa ona teklif gönder
            if ((isMicOn || isCameraOn) && localStream.current) {
                sendOffer(data.socketId);
            }
        };

        const onPeerMicOn = (data: any) => {
            // Karşı taraf mic açtı → Teklif iste (Dinleyiciler de duyabilsin diye localStream kontrolü kaldırıldı)
            if (data.from || data.socketId) {
                socket.emit('request_offer', { to: data.from || data.socketId });
            }
        };

        const onRequestOffer = (data: any) => {
            // Benden offer istendi → sadece stream varsa gönder
            if (localStream.current) {
                sendOffer(data.from);
            }
        };

        const onRoomUpdated = (data: any) => {
            if (data.id === roomId) {
                setRoomState((prev: any) => ({ ...prev, ...data }));
            }
        };

        const onAnnouncementUpdated = (text: string) => {
            setRoomState((prev: any) => prev ? { ...prev, announcement: text } : null);
        };

        const onPeerDisconnected = (socketId: string) => {
            // Peer gittiğinde kaynakları temizle
            const pc = peers.current.get(socketId);
            if (pc) { pc.close(); peers.current.delete(socketId); }
            const stream = remoteStreamsRef.current.get(socketId);
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                remoteStreamsRef.current.delete(socketId);
                setRemoteStreamsState(new Map(remoteStreamsRef.current));
            }
            document.getElementById(`audio-${socketId}`)?.remove();
        };

        socket.on('room_snapshot', onSnapshot);
        socket.on('msg', onMsg);
        socket.on('clear_chat', onClearChat);
        socket.on('seats_sync', onSeatsSync);
        socket.on('webrtc_signal', handleSignal);
        socket.on('user_joined_room', onUserJoined);
        socket.on('peer_mic_on', onPeerMicOn);
        socket.on('request_offer', onRequestOffer);
        socket.on('room_updated', onRoomUpdated);
        socket.on('announcement_updated', onAnnouncementUpdated);
        socket.on('user_left_room', onPeerDisconnected);
        socket.on('err', (msg: string) => setError(msg));

        return () => {
            socket.off('room_snapshot', onSnapshot);
            socket.off('msg', onMsg);
            socket.off('clear_chat', onClearChat);
            socket.off('seats_sync', onSeatsSync);
            socket.off('webrtc_signal', handleSignal);
            socket.off('user_joined_room', onUserJoined);
            socket.off('peer_mic_on', onPeerMicOn);
            socket.off('request_offer', onRequestOffer);
            socket.off('room_updated', onRoomUpdated);
            socket.off('announcement_updated', onAnnouncementUpdated);
            socket.off('user_left_room', onPeerDisconnected);
        };
    }, [socket, handleSignal, isMicOn, isCameraOn, sendOffer]);

    // Mikrofon aç/kapat
    const toggleMic = useCallback(async () => {
        try {
            if (!isMicOn) {
                // Mikrofon aç
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: AUDIO_CONSTRAINTS,
                    video: false
                });

                // Eğer zaten video varsa onu da ekle
                if (isCameraOn && localStream.current) {
                    const videoTracks = localStream.current.getVideoTracks();
                    videoTracks.forEach(t => stream.addTrack(t));
                }

                localStream.current = stream;
                micOnRef.current = true;
                setIsMicOn(true);
                startVoiceDetection(stream);
                socket?.emit('speaking_state', 10);
                socket?.emit('peer_mic_on', { roomId });

                // Odadaki herkese teklif gönder
                if (roomState?.seats) {
                    roomState.seats.forEach((seat: any) => {
                        if (seat && seat.socketId && seat.socketId !== socket?.id) {
                            sendOffer(seat.socketId);
                        }
                    });
                }
            } else {
                // Mikrofon kapat
                localStream.current?.getAudioTracks().forEach(t => t.stop());
                micOnRef.current = false;
                setIsMicOn(false);
                cancelAnimationFrame(vadFrameRef.current);
                socket?.emit('speaking_state', 0);

                // Eğer kamera da kapalıysa tüm stream'i temizle
                if (!isCameraOn) {
                    localStream.current = null;
                    peers.current.forEach(pc => pc.close());
                    peers.current.clear();
                }
            }
        } catch (err: any) {
            console.error('[Mic] Toggle failed:', err);
            if (err.name === 'NotAllowedError') {
                setError('Mikrofon izni reddedildi. Lütfen tarayıcı/telefon ayarlarından izin verin.');
            }
        }
    }, [isMicOn, isCameraOn, socket, startVoiceDetection, roomState, sendOffer, roomId]);

    // Kamera aç/kapat
    const toggleCamera = useCallback(async () => {
        try {
            if (!isCameraOn) {
                // Kamera aç
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 24 }
                    }
                });

                const combinedStream = new MediaStream(videoStream.getVideoTracks());

                // Eğer ses de açıksa değiştirme
                if (localStream.current && isMicOn) {
                    localStream.current.getAudioTracks().forEach(t => combinedStream.addTrack(t));
                }

                localStream.current = combinedStream;
                setIsCameraOn(true);

                if (isMicOn) startVoiceDetection(combinedStream);

                // Odadaki herkese teklif gönder (renegotiation)
                if (roomState?.seats) {
                    roomState.seats.forEach((seat: any) => {
                        if (seat && seat.socketId && seat.socketId !== socket?.id) {
                            sendOffer(seat.socketId);
                        }
                    });
                }
            } else {
                // Kamera kapat
                localStream.current?.getVideoTracks().forEach(t => {
                    t.stop();
                    localStream.current?.removeTrack(t);
                });

                if (localStream.current && isMicOn) {
                    localStream.current = new MediaStream(localStream.current.getAudioTracks());
                } else if (!isMicOn) {
                    localStream.current = null;
                }

                setIsCameraOn(false);
            }
        } catch (err: any) {
            console.error('[Camera] Toggle failed:', err);
            if (err.name === 'NotAllowedError') {
                setError('Kamera izni reddedildi. Lütfen ayarlardan izin verin.');
            }
        }
    }, [isCameraOn, isMicOn, socket, startVoiceDetection, roomState, sendOffer]);

    // Koltuğa otururken otomatik mikrofon açma
    // Koltuktan kalkınca mikrofonu kapat
    const prevIsSeatedRef = useRef(false);
    useEffect(() => {
        if (!roomState?.seats) return;
        const myUid = pb.authStore.model?.id;
        if (!myUid) return;

        const isSeated = roomState.seats.some((s: any) => s && s.uid === myUid);
        const wasPreviouslySeated = prevIsSeatedRef.current;

        if (isSeated && !wasPreviouslySeated) {
            // Yeni koltuğa oturuldu: susturulmamışsa mikrofonu aç
            if (!isMicOn && !roomState?.mutedUsers?.includes(myUid)) {
                toggleMic();
            }
        } else if (!isSeated && wasPreviouslySeated) {
            // Koltuktan kalkıldı: mikrofonu kapat
            if (isMicOn) toggleMic();
        }

        prevIsSeatedRef.current = isSeated;
        // roomState.seats değişince kontrol et; toggle bağımlılığı döngü yaratmamasın diye seats string'e serialize ediyoruz
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(roomState?.seats)]);

    // Odadan ayrıl
    const leaveRoom = useCallback(() => {
        socket?.emit('leave_room');
        cancelAnimationFrame(vadFrameRef.current);
        peers.current.forEach(pc => pc.close());
        peers.current.clear();
        localStream.current?.getTracks().forEach(t => t.stop());
        localStream.current = null;
        // Oluşturulan audio elementlerini temizle
        document.querySelectorAll('[id^="audio-"]').forEach(el => el.remove());
    }, [socket]);

    useEffect(() => {
        return () => { leaveRoom(); };
    }, [leaveRoom]);

    return {
        roomState,
        chat,
        isMicOn,
        isCameraOn,
        isLoading,
        error,
        isConnected: socketConnected && !!roomState,
        localStream: localStream.current,
        remoteStreams: remoteStreamsState,   // React state → re-render tetikler
        actions: {
            toggleMic,
            toggleCamera,
            takeSeat: (index: number) => socket?.emit('take_seat', index),
            leaveSeat: () => socket?.emit('leave_seat'),
            toggleFollowRoom: async () => {
                if (!roomId || !pb.authStore.model?.id) return;
                const isFollowing = roomState?.followers?.includes(pb.authStore.model.id);
                try {
                    await updateDoc(doc(db, 'rooms', roomId), {
                        followers: isFollowing
                            ? arrayRemove(pb.authStore.model.id)
                            : arrayUnion(pb.authStore.model.id)
                    });
                } catch (e) { console.error('Follow error:', e); }
            },
            sendMessage: (text: string) => socket?.emit('send_msg', text),
            updateRoomName: async (name: string) => {
                await pb.collection('rooms').update(roomId, { name });
                socket?.emit('update_room_name', name);
            },
            updateRoomBackground: async (file: File) => {
                // Dosyayı base64'e çevir ve socket üzerinden gönder
                try {
                    // Boyut kontrolü: Max 5MB
                    if (file.size > 5 * 1024 * 1024) {
                        alert('Resim boyutu en fazla 5MB olabilir!');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64 = e.target?.result as string;
                        if (!base64) return;
                        // Socket üzerinden sunucuya gönder
                        socket?.emit('update_room_background', {
                            roomId,
                            base64,
                            filename: file.name,
                            mimeType: file.type
                        });
                    };
                    reader.onerror = () => alert('Resim okunamadı!');
                    reader.readAsDataURL(file);
                } catch (e) {
                    console.error('Background upload failed', e);
                    alert('Arka plan yüklenemedi!');
                }
            },
            adminAction: (action: string, targetUid?: string, targetSocketId?: string, seatIndex?: number, extra?: any) =>
                socket?.emit('admin_action', { action, targetUid, targetSocketId, seatIndex, ...extra }),
            updateAnnouncement: (text: string) => socket?.emit('update_announcement', text),
            updateSlowMode: (enabled: boolean) => socket?.emit('update_slow_mode', enabled),
            updateChatDisabled: (disabled: boolean) => socket?.emit('update_chat_disabled', disabled),
            leaveRoom
        }
    };
}
