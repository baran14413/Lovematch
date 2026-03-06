import { useState, useEffect } from 'react';
import { Chess2D } from './games/Chess2D';
import { Tavla2D } from './games/Tavla2D';

/**
 * =========================================================================
 *  LOVEMATCH CLONE - PARTİ OYUNLARI
 *  Basit, senkronize 2D oyunlar.
 * =========================================================================
 */

export function PartyGames({
    socket,
    roomState,
    userId
}: {
    socket: any;
    roomState: any;
    userId: string;
}) {
    const [activeGame, setActiveGame] = useState<'dice' | 'rps' | null>(null);
    const [gameResult, setGameResult] = useState<any>(null);
    const [animating, setAnimating] = useState(false);
    const [openFullGame, setOpenFullGame] = useState<'chess' | 'tavla' | null>(null);

    useEffect(() => {
        if (!socket) return;

        const handleGameEvent = (data: any) => {
            setActiveGame(data.type);
            setAnimating(true);
            
            // Animasyon süresi
            setTimeout(() => {
                setAnimating(false);
                setGameResult(data);
                
                // Sonucu temizle
                setTimeout(() => {
                    setActiveGame(null);
                    setGameResult(null);
                }, 3000);
            }, 2000);
        };

        socket.on('game_event', handleGameEvent);
        return () => {
            socket.off('game_event', handleGameEvent);
        };
    }, [socket]);

    const launchQuick = (type: 'dice' | 'rps') => {
        socket.emit('game_action', { type });
    };

    if (!activeGame && !animating) {
        return (
            <>
                <div style={{ display: 'flex', gap: 10, padding: 10, overflowX: 'auto' }} className="no-scrollbar">
                    <button onClick={() => launchQuick('dice')} className="game-btn">
                        <span style={{ fontSize: 22 }}>🎲</span>
                        <span style={{ fontSize: 10, fontWeight: 800 }}>Zar</span>
                    </button>
                    <button onClick={() => launchQuick('rps')} className="game-btn">
                        <span style={{ fontSize: 22 }}>✌️</span>
                        <span style={{ fontSize: 10, fontWeight: 800 }}>TKM</span>
                    </button>
                    <button onClick={() => {
                        if (!roomState?.gameState || roomState.gameState.type !== 'tavla') {
                            socket.emit('game_start', { type: 'tavla' });
                        }
                        setOpenFullGame('tavla');
                    }} className="game-btn">
                        <span style={{ fontSize: 22 }}>🟤</span>
                        <span style={{ fontSize: 10, fontWeight: 800 }}>Tavla</span>
                    </button>
                    <button onClick={() => {
                        if (!roomState?.gameState || roomState.gameState.type !== 'chess') {
                            socket.emit('game_start', { type: 'chess' });
                        }
                        setOpenFullGame('chess');
                    }} className="game-btn">
                        <span style={{ fontSize: 22 }}>♟️</span>
                        <span style={{ fontSize: 10, fontWeight: 800 }}>Satranç</span>
                    </button>
                </div>

                {openFullGame === 'chess' && (
                    <Chess2D
                        socket={socket}
                        userId={userId}
                        gameState={roomState?.gameState?.type === 'chess' ? roomState.gameState : null}
                        onClose={() => setOpenFullGame(null)}
                    />
                )}

                {openFullGame === 'tavla' && (
                    <Tavla2D
                        socket={socket}
                        userId={userId}
                        gameState={roomState?.gameState?.type === 'tavla' ? roomState.gameState : null}
                        onClose={() => setOpenFullGame(null)}
                    />
                )}

                <style>{`
                    .game-btn {
                        background: rgba(255,255,255,0.08);
                        border: 1px solid rgba(255,255,255,0.12);
                        border-radius: 16px;
                        padding: 10px 14px;
                        color: #fff;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        cursor: pointer;
                        min-width: 78px;
                        transition: 0.2s;
                        backdrop-filter: blur(10px);
                    }
                    .game-btn:active { transform: scale(0.97); background: rgba(255,255,255,0.16); }
                `}</style>
            </>
        );
    }

    return (
        <div className="game-overlay animate-scale-up">
            {activeGame === 'dice' && (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 60, animation: animating ? 'spin 0.5s infinite' : 'bounce 1s' }}>
                        {animating ? '🎲' : `🎲 ${gameResult?.result}`}
                    </div>
                    {!animating && (
                        <div style={{ marginTop: 10, fontWeight: 800, color: '#fff' }}>
                            {gameResult?.username} attı!
                        </div>
                    )}
                </div>
            )}

            {activeGame === 'rps' && (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 60, animation: animating ? 'shake 0.5s infinite' : 'bounce 1s' }}>
                        {animating ? '✊' : gameResult?.result}
                    </div>
                    {!animating && (
                        <div style={{ marginTop: 10, fontWeight: 800, color: '#fff' }}>
                            {gameResult?.username} seçti!
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .game-overlay {
                    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
                    padding: 30px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.2);
                    z-index: 100; min-width: 200px;
                }

                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes shake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-20deg); } 75% { transform: rotate(20deg); } }
            `}</style>
        </div>
    );
}
