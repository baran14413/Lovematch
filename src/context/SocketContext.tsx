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
    getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { pb } from '../pb';

/**
 * =========================================================================
 *  LOVEMATCH - FIREBASE REALTIME SOCKET EMÜLATÖRÜ
 *  VDS socket.io tamamen kaldırıldı!
 *  Artık tüm gerçek zamanlı iletişim Firebase Firestore üzerinden çalışıyor.
 *  socket.emit() → Firestore'a yazma
 *  socket.on()   → Firestore onSnapshot dinleyici
 * =========================================================================
 */

// Firebase'de mesaj/event gönderme tipi
interface FirebaseEvent {
    type: string;
    data: any;
    fromUid?: string;
    toUid?: string;
    roomId?: string;
    timestamp?: any;
    read?: boolean;
}

// Socket context interface - eski socket.io API'sine uyumlu
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

// ─── Firebase Socket Emülatörü ────────────────────────────────
// socket.io API'sine benzer bir arayüz sağlar ama Firestore kullanır
class FirebaseSocketEmulator {
    // Event dinleyicileri
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    // Aktif Firestore abonelikleri
    private unsubscribers: (() => void)[] = [];
    public id: string = 'firebase-' + Math.random().toString(36).slice(2);

    constructor(private uid: string) {
        // Gelen DM mesajlarını dinle
        this.listenForDMs();
        // Sistem bildirimlerini dinle
        this.listenForSystemNotifications();
    }

    // ─── Firestore'dan DM dinle ───
    private listenForDMs() {
        if (!this.uid) return;

        // Bu kullanıcıya gelen mesajları dinle
        const q = query(
            collection(db, 'direct_messages'),
            where('toUid', '==', this.uid),
            where('read', '==', false),
            orderBy('timestamp', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data() as FirebaseEvent;

                    // DM bildirimini tetikle
                    this.emit_local('receive_dm', {
                        senderId: data.fromUid,
                        text: data.data?.text || '',
                        username: data.data?.username || 'Kullanıcı',
                        avatar: data.data?.avatar || '',
                        timestamp: data.timestamp
                    });

                    // Firestore'da okundu olarak işaretle (kısa gecikme ile)
                    setTimeout(async () => {
                        try {
                            await updateDoc(doc(db, 'direct_messages', change.doc.id), {
                                read: true
                            });
                        } catch { }
                    }, 1000);
                }
            });
        }, (error) => {
            // İndeks yoksa sessizce devam et - uygulama çalışmaya devam eder
            console.warn('[FirebaseSocket] DM listener hatası:', error.message);
        });

        this.unsubscribers.push(unsub);
    }

    // ─── Sistem bildirimlerini dinle ───
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

                    // Bildirim tipine göre event gönder
                    if (data.type === 'system' || data.type === 'broadcast') {
                        this.emit_local('system_notification', {
                            title: data.title || 'Bildirim',
                            body: data.body || '',
                            data: data
                        });
                    } else if (data.type === 'friend_request') {
                        this.emit_local('friend_request_received', {
                            fromUid: data.fromUid,
                            fromName: data.fromName || 'Birisi'
                        });
                    }

                    // Okundu işaretle
                    setTimeout(async () => {
                        try {
                            await updateDoc(doc(db, 'notifications', change.doc.id), {
                                read: true
                            });
                        } catch { }
                    }, 1000);
                }
            });
        }, (error) => {
            console.warn('[FirebaseSocket] Notification listener hatası:', error.message);
        });

        this.unsubscribers.push(unsub);
    }

    // ─── socket.on() emülatörü - event dinleme ───
    on(event: string, callback: (data: any) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    // ─── socket.once() emülatörü - tek seferlik dinleme ───
    once(event: string, callback: (data: any) => void) {
        const onceWrapper = (data: any) => {
            this.off(event, onceWrapper);
            callback(data);
        };
        this.on(event, onceWrapper);
    }

    // ─── socket.off() emülatörü - event dinlemeyi bırak ───
    off(event: string, callback?: (data: any) => void) {
        if (!callback) {
            this.listeners.delete(event);
            return;
        }
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(callback);
        }
    }

    // ─── socket.emit() emülatörü - Firestore'a yaz ───
    emit(event: string, data?: any) {
        // Auth event'i - Firestore'da kullanıcı online durumunu güncelle
        if (event === 'auth') {
            this.handleAuth(data);
            return;
        }

        // Oda Oluşturma - Firestore'da oda belgesi oluştur
        if (event === 'create_room' && data?.name) {
            console.log('[FirebaseSocket] Oda oluşturuluyor:', data.name);
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
                created: serverTimestamp(),
                updated: serverTimestamp()
            };

            addDoc(collection(db, 'rooms'), roomData)
                .then(docRef => {
                    console.log('[FirebaseSocket] Oda başarıyla oluşturuldu:', docRef.id);
                    // room_created event'ini tetikle
                    this.emit_local('room_created', docRef.id);
                })
                .catch(e => {
                    console.error('[FirebaseSocket] Oda oluşturma hatası:', e);
                });
            return;
        }

        // DM göndermek için Firestore'a yaz
        if (event === 'send_dm' && data?.toUid) {
            addDoc(collection(db, 'direct_messages'), {
                fromUid: this.uid,
                toUid: data.toUid,
                data: { text: data.text, username: data.username, avatar: data.avatar },
                type: 'dm',
                read: false,
                timestamp: serverTimestamp()
            }).catch(e => console.warn('[FirebaseSocket] DM gönderme hatası:', e));
            return;
        }

        // Diğer event'ler için local emit
        this.emit_local(event, data);
    }

    // ─── Local event tetikleme (Firestore listener'lardan gelen) ───
    private emit_local(event: string, data: any) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try { callback(data); } catch (e) { console.warn('[FirebaseSocket] Callback hatası:', e); }
            });
        }
    }

    // ─── Auth handler - kullanıcı online durumunu güncelle ───
    private async handleAuth(data: any) {
        if (!data?.uid) return;
        try {
            const userRef = doc(db, 'users', data.uid);
            await updateDoc(userRef, {
                online: true,
                lastSeen: serverTimestamp(),
                color: data.color || '#8b5cf6'
            }).catch(() => { }); // Belge yoksa hata vermez

            // auth_ok event'ini simüle et
            setTimeout(() => {
                this.emit_local('auth_ok', { username: data.username, uid: data.uid });
            }, 100);
        } catch { }
    }

    // ─── Bağlantıyı temizle ───
    disconnect() {
        this.unsubscribers.forEach(unsub => {
            try { unsub(); } catch { }
        });
        this.unsubscribers = [];
        this.listeners.clear();

        // Çevrimdışı yap
        if (this.uid) {
            updateDoc(doc(db, 'users', this.uid), {
                online: false,
                lastSeen: serverTimestamp()
            }).catch(() => { });
        }
    }
}

// Global singleton - bir kez oluştur
let globalFirebaseSocket: FirebaseSocketEmulator | null = null;

const MEMOJIS = ['jack.png', 'leo.png', 'lily.png', 'max.png', 'mia.png', 'sam.png', 'zoe.png'];
const getRandomMemoji = () => `/assets/${MEMOJIS[Math.floor(Math.random() * MEMOJIS.length)]}`;

// ─── SocketProvider - artık Firebase kullanıyor ───────────────
export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [authStatus, setAuthStatus] = useState<'idle' | 'authenticating' | 'authenticated' | 'error'>('idle');
    const [, setTick] = useState(0);

    // Firebase socket başlat
    const initSocket = useCallback(() => {
        const user = pb.authStore.model;
        if (!user?.id) return null;

        // Aynı kullanıcı için tekrar oluşturma
        if (globalFirebaseSocket) return globalFirebaseSocket;

        console.log('[FirebaseSocket] Başlatılıyor - UID:', user.id);

        const socket = new FirebaseSocketEmulator(user.id);
        globalFirebaseSocket = socket;

        // Auth gönder
        const avatarUrl = user.avatar
            ? pb.files.getUrl(user, user.avatar)
            : getRandomMemoji();

        setAuthStatus('authenticating');
        socket.emit('auth', {
            uid: user.id,
            username: user.username || user.name || 'Kullanıcı',
            avatar: avatarUrl,
            color: user.color || '#8b5cf6',
            bubbleStyle: user.bubble_style || 'classic'
        });

        // auth_ok dinle
        socket.on('auth_ok', () => {
            console.log('[FirebaseSocket] Bağlandı ve auth başarılı');
            setIsConnected(true);
            setAuthStatus('authenticated');
            setTick(t => t + 1);
        });

        return socket;
    }, []);

    const connect = useCallback(() => {
        if (!globalFirebaseSocket) {
            initSocket();
        }
    }, [initSocket]);

    // Auth state değişince socket'i yeniden init et
    useEffect(() => {
        // Firebase auth hazır olunca socket'i başlat
        pb.authReadyPromise?.then(() => {
            if (pb.authStore.model?.id) {
                initSocket();
            }
        }).catch(() => { });

        // Auth değişikliklerini dinle
        const unbind = pb.authStore.onChange((_: string, model: any) => {
            if (model?.id && !globalFirebaseSocket) {
                initSocket();
            } else if (!model && globalFirebaseSocket) {
                // Logout olunca socket'i temizle
                globalFirebaseSocket.disconnect();
                globalFirebaseSocket = null;
                setIsConnected(false);
                setAuthStatus('idle');
                setTick(t => t + 1);
            }
        });

        return () => {
            unbind();
        };
    }, [initSocket]);

    return (
        <SocketContext.Provider value={{
            socket: globalFirebaseSocket as any,
            isConnected,
            authStatus,
            transport: 'firebase-firestore',
            connect
        }}>
            {children}
        </SocketContext.Provider>
    );
};
