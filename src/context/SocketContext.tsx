import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { pb } from '../pb';

/**
 * =========================================================================
 *  LOVEMATCH CLONE - V7 SINGLETON SOCKET ENGINE
 *  Problem: Çift bağlantı ve senkronizasyon hataları.
 *  Çözüm: Global singleton instance ve otomatik kurtarma.
 * =========================================================================
 */

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    authStatus: 'idle' | 'authenticating' | 'authenticated' | 'error';
    transport: string;
    connect: () => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    authStatus: 'idle',
    transport: 'none',
    connect: () => { },
});

export const useSocket = () => useContext(SocketContext);

// Global Singleton (React lifecycle'dan bağımsız)
let globalSocket: Socket | null = null;

const MEMOJIS = ['jack.png', 'leo.png', 'lily.png', 'max.png', 'mia.png', 'sam.png', 'zoe.png'];
const getRandomMemoji = () => `/assets/${MEMOJIS[Math.floor(Math.random() * MEMOJIS.length)]}`;

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [authStatus, setAuthStatus] = useState<'idle' | 'authenticating' | 'authenticated' | 'error'>('idle');
    const [transport, setTransport] = useState('none');
    const [, setTick] = useState(0);

    const authenticate = useCallback((socket: Socket) => {
        if (!pb.authStore.model) return;

        console.log('[SOCKET] Authenticating UID:', pb.authStore.model.id);
        setAuthStatus('authenticating');

        const profile = pb.authStore.model;
        const avatarUrl = profile.avatar ? pb.files.getUrl(profile, profile.avatar) : getRandomMemoji();

        socket.emit('auth', {
            uid: profile.id,
            username: profile.username || profile.name || 'Kullanıcı',
            avatar: avatarUrl,
            color: profile.color || '#8b5cf6',
            bubbleStyle: profile.bubble_style || 'classic'
        });
    }, []);

    const initSocket = useCallback(() => {
        if (globalSocket) return globalSocket;

        console.log('[SOCKET] Connecting to Production Backend...');

        // Firebase Cloud Function URL or Custom Domain
        // Updated to use the correct production URL
        const socket = io('/', {
            path: '/socket.io',
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 20000,
            autoConnect: true
        });

        socket.on('connect', () => {
            console.log('[SOCKET] Connected! ID:', socket.id);
            setIsConnected(true);
            setTransport(socket.io.engine.transport.name);
            authenticate(socket);

            socket.io.engine.on('upgrade', (rawTransport) => {
                console.log('[SOCKET] Transport Upgraded:', rawTransport.name);
                setTransport(rawTransport.name);
            });
        });

        socket.on('disconnect', (reason) => {
            console.log('[SOCKET] Disconnected:', reason);
            setIsConnected(false);
            setAuthStatus('idle');
            setTransport('none');
        });

        socket.on('auth_ok', (data) => {
            console.log('[SOCKET] Auth Success:', data.username);
            setAuthStatus('authenticated');
        });

        socket.on('err', (msg) => {
            console.error('[SOCKET] Server Error:', msg);
            if (msg.includes('kimlik')) setAuthStatus('error');
        });

        socket.on('connect_error', (err) => {
            console.error('[SOCKET] Connection Error:', err.message);
            setIsConnected(false);
        });

        globalSocket = socket;
        setTick(t => t + 1);
        return socket;
    }, [authenticate]);

    const connect = useCallback(() => {
        if (globalSocket?.connected) {
            authenticate(globalSocket);
            return;
        }
        if (globalSocket) {
            globalSocket.connect();
        } else {
            initSocket();
        }
    }, [initSocket, authenticate]);

    useEffect(() => {
        initSocket();
    }, [initSocket]);

    // Handle User Login/Logout
    useEffect(() => {
        if (globalSocket?.connected && pb.authStore.model && authStatus === 'idle') {
            authenticate(globalSocket);
        }
    }, [authStatus, authenticate]);

    return (
        <SocketContext.Provider value={{
            socket: globalSocket,
            isConnected,
            authStatus,
            transport,
            connect
        }}>
            {children}
        </SocketContext.Provider>
    );
};
