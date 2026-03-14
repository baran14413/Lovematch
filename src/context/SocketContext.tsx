import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp,
    doc,
    updateDoc,
    getDoc,
    arrayUnion,
    arrayRemove,
    deleteDoc,
    increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { pb } from '../pb';

/**
 * =========================================================================
 *  LOVEMATCH - FIREBASE REALTIME SOCKET EMÜLATÖRÜ (v2.0 Advanced)
 *  VDS socket.io tamamen kaldırıldı!
 *  Artık tüm gerçek zamanlı iletişim Firebase Firestore üzerinden çalışıyor.
 *  WebRTC Sinyalleşme, Oda Durumları ve Mesajlar Firestore ile simüle ediliyor.
 * =========================================================================
 */

interface FirebaseEvent {
    type: string;
    data: any;
    fromUid?: string;
    toUid?: string;
    roomId?: string;
    timestamp?: any;
    read?: boolean;
}

interface SocketContextType {
    socket: FirebaseSocketEmulator | null;
    isConnected: boolean;
    authStatus: 'idle' | 'authenticating' | 'authenticated' | 'error';
    transport: string;
    connect: () => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    authStatus: 'idle',
    transport: 'firebase',
    connect: () => { },
});

export const useSocket = () => useContext(SocketContext);

class FirebaseSocketEmulator {
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    private unsubscribers: Map<string, () => void> = new Map();
    public id: string; // socket.id emülasyonu (uid kullanıyoruz)
    private currentRoomId: string | null = null;

    constructor(private uid: string) {
        this.id = uid; // uid'yi socket id olarak kullanıyoruz (stabilite için)
        this.listenForDMs();
        this.listenForSystemNotifications();
        this.listenForWebRTCSignals();
    }

    // ─── WebRTC Sinyallerini Dinle ───
    private listenForWebRTCSignals() {
        if (!this.uid) return;
        const q = query(
            collection(db, 'signaling'),
            where('toUid', '==', this.uid)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    // webrtc_signal event'ini tetikle
                    this.emit_local('webrtc_signal', {
                        from: data.fromUid,
                        signal: data.signal,
                        type: data.signalType
                    });
                    // Sinyali okunduktan sonra sil (Firestore'u temiz tut)
                    deleteDoc(change.doc.ref).catch(() => { });
                }
            });
        });
        this.unsubscribers.set('signaling', unsub);
    }

    // ─── DM Dinle ───
    private listenForDMs() {
        if (!this.uid) return;
        const q = query(
            collection(db, 'direct_messages'),
            where('toUid', '==', this.uid),
            where('read', '==', false),
            orderBy('timestamp', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    this.emit_local('receive_dm', {
                        senderId: data.fromUid,
                        text: data.data?.text || '',
                        username: data.data?.username || 'Kullanıcı',
                        avatar: data.data?.avatar || '',
                        timestamp: data.timestamp
                    });
                    setTimeout(() => {
                        updateDoc(change.doc.ref, { read: true }).catch(() => { });
                    }, 1000);
                }
            });
        }, (err) => console.warn('[FirebaseSocket] DM Error:', err.message));
        this.unsubscribers.set('dms', unsub);
    }

    // ─── Sistem Bildirimleri ───
    private listenForSystemNotifications() {
        if (!this.uid) return;
        const q = query(
            collection(db, 'notifications'),
            where('toUid', '==', this.uid),
            where('read', '==', false)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.type === 'system' || data.type === 'broadcast') {
                        this.emit_local('system_notification', { title: data.title, body: data.body });
                    }
                    updateDoc(change.doc.ref, { read: true }).catch(() => { });
                }
            });
        });
        this.unsubscribers.set('notifications', unsub);
    }

    on(event: string, callback: (data: any) => void) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(callback);
    }

    once(event: string, callback: (data: any) => void) {
        const wrapper = (data: any) => { this.off(event, wrapper); callback(data); };
        this.on(event, wrapper);
    }

    off(event: string, callback?: (data: any) => void) {
        if (!callback) { this.listeners.delete(event); return; }
        this.listeners.get(event)?.delete(callback);
    }

    emit(event: string, data?: any) {
        if (event === 'auth') { this.handleAuth(data); return; }

        if (event === 'create_room' && data?.name) {
            const roomData = {
                name: data.name,
                ownerUid: this.uid,
                ownerName: pb.authStore.model?.username || 'Kullanıcı',
                ownerAvatar: pb.authStore.model?.avatar || '',
                maxSeatCount: data.seatCount || 8,
                viewerCount: 0,
                seatedCount: 0,
                boostLevel: 1,
                followerCount: 0,
                isSleeping: false,
                seats: new Array(data.seatCount || 8).fill(null),
                messages: [],
                created: serverTimestamp(),
                updated: serverTimestamp()
            };
            addDoc(collection(db, 'rooms'), roomData).then(docRef => {
                this.emit_local('room_created', docRef.id);
            });
            return;
        }

        if (event === 'join_room') {
            const roomId = data;
            this.currentRoomId = roomId;
            // Oda bazlı listener başlat (Öncekini temizle)
            if (this.unsubscribers.has('room')) this.unsubscribers.get('room')!();

            const unsub = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
                if (docSnap.exists()) {
                    const roomData = { id: docSnap.id, ...docSnap.data() };
                    this.emit_local('room_snapshot', roomData);
                }
            });
            this.unsubscribers.set('room', unsub);

            // İzleyici sayısını artır
            updateDoc(doc(db, 'rooms', roomId), { viewerCount: increment(1) }).catch(() => { });
            return;
        }

        if (event === 'send_msg' && this.currentRoomId) {
            updateDoc(doc(db, 'rooms', this.currentRoomId), {
                messages: arrayUnion({
                    id: Math.random().toString(36).slice(2),
                    uid: this.uid,
                    username: pb.authStore.model?.username || 'Kullanıcı',
                    text: data,
                    timestamp: Date.now()
                })
            });
            return;
        }

        if (event === 'take_seat' && this.currentRoomId) {
            getDoc(doc(db, 'rooms', this.currentRoomId)).then(snap => {
                if (snap.exists()) {
                    const roomsData = snap.data();
                    const seats = [...roomsData.seats];
                    seats[data] = {
                        uid: this.uid,
                        socketId: this.id,
                        username: pb.authStore.model?.username || 'Kullanıcı',
                        avatar: pb.authStore.model?.avatar || ''
                    };
                    updateDoc(snap.ref, { seats, seatedCount: increment(1) });
                }
            });
            return;
        }

        if (event === 'leave_seat' && this.currentRoomId) {
            getDoc(doc(db, 'rooms', this.currentRoomId)).then(snap => {
                if (snap.exists()) {
                    const roomsData = snap.data();
                    const seats = roomsData.seats.map((s: any) => s?.uid === this.uid ? null : s);
                    updateDoc(snap.ref, { seats, seatedCount: increment(-1) });
                }
            });
            return;
        }

        if (event === 'webrtc_signal' && data.to) {
            addDoc(collection(db, 'signaling'), {
                fromUid: this.uid,
                toUid: data.to,
                signal: data.signal,
                signalType: data.type,
                timestamp: serverTimestamp()
            }).catch(() => { });
            return;
        }

        if (event === 'send_dm' && data?.toUid) {
            addDoc(collection(db, 'direct_messages'), {
                fromUid: this.uid,
                toUid: data.toUid,
                data: { text: data.text, username: data.username, avatar: data.avatar },
                type: 'dm',
                read: false,
                timestamp: serverTimestamp()
            });
            return;
        }

        this.emit_local(event, data);
    }

    private emit_local(event: string, data: any) {
        this.listeners.get(event)?.forEach(cb => { try { cb(data); } catch { } });
    }

    private async handleAuth(data: any) {
        if (!data?.uid) return;
        const userRef = doc(db, 'users', data.uid);
        updateDoc(userRef, { online: true, lastSeen: serverTimestamp(), color: data.color || '#8b5cf6' }).catch(() => { });
        setTimeout(() => this.emit_local('auth_ok', { username: data.username, uid: data.uid }), 100);
    }

    disconnect() {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers.clear();
        if (this.uid) updateDoc(doc(db, 'users', this.uid), { online: false, lastSeen: serverTimestamp() }).catch(() => { });
        if (this.currentRoomId) updateDoc(doc(db, 'rooms', this.currentRoomId), { viewerCount: increment(-1) }).catch(() => { });
    }
}

let globalFirebaseSocket: FirebaseSocketEmulator | null = null;
const MEMOJIS = ['jack.png', 'leo.png', 'lily.png', 'max.png', 'mia.png', 'sam.png', 'zoe.png'];
const getRandomMemoji = () => `/assets/${MEMOJIS[Math.floor(Math.random() * MEMOJIS.length)]}`;

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [authStatus, setAuthStatus] = useState<'idle' | 'authenticating' | 'authenticated' | 'error'>('idle');

    const initSocket = useCallback(() => {
        const user = pb.authStore.model;
        if (!user?.id || globalFirebaseSocket) return globalFirebaseSocket;
        const socket = new FirebaseSocketEmulator(user.id);
        globalFirebaseSocket = socket;
        setAuthStatus('authenticating');
        socket.emit('auth', {
            uid: user.id,
            username: user.username || 'Kullanıcı',
            avatar: user.avatar ? pb.files.getUrl(user, user.avatar) : getRandomMemoji()
        });
        socket.on('auth_ok', () => { setIsConnected(true); setAuthStatus('authenticated'); });
        return socket;
    }, []);

    useEffect(() => {
        pb.authReadyPromise?.then(() => { if (pb.authStore.model?.id) initSocket(); });
        const unbind = pb.authStore.onChange((_: string, model: any) => {
            if (model?.id && !globalFirebaseSocket) initSocket();
            else if (!model && globalFirebaseSocket) {
                globalFirebaseSocket.disconnect();
                globalFirebaseSocket = null;
                setIsConnected(false);
                setAuthStatus('idle');
            }
        });
        return () => unbind();
    }, [initSocket]);

    return (
        <SocketContext.Provider value={{
            socket: globalFirebaseSocket as any,
            isConnected,
            authStatus,
            transport: 'firebase-firestore',
            connect: initSocket
        }}>
            {children}
        </SocketContext.Provider>
    );
};
