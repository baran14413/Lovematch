import { useMemo, useState } from 'react';

type Side = 'w' | 'b';

function pointLabel(i: number) {
    return i + 1;
}

function sideColor(side: Side) {
    return side === 'w' ? '#f8fafc' : '#0b1220';
}

function sideText(side: Side) {
    return side === 'w' ? 'Beyaz' : 'Siyah';
}

export function Tavla2D({
    socket,
    userId,
    gameState,
    onClose
}: {
    socket: any;
    userId: string;
    gameState: any;
    onClose: () => void;
}) {
    const points = gameState?.points || Array.from({ length: 24 }, () => ({ owner: null, count: 0 }));
    const turn: Side = gameState?.turn || 'w';
    const players = gameState?.players || { w: null, b: null };
    const dice: number[] = gameState?.dice || [];
    const used: boolean[] = gameState?.used || [];
    const bar = gameState?.bar || { w: 0, b: 0 };
    const off = gameState?.off || { w: 0, b: 0 };
    const mySide: Side | null = players?.w === userId ? 'w' : players?.b === userId ? 'b' : null;

    const [selectedFrom, setSelectedFrom] = useState<'bar' | number | null>(null);

    const rollDisabled = useMemo(() => {
        if (!mySide) return true;
        if (turn !== mySide) return true;
        return dice.length > 0;
    }, [mySide, turn, dice.length]);

    const canMove = Boolean(mySide) && turn === mySide && dice.length > 0;

    const claim = (side: Side) => {
        socket.emit('game_move', { action: 'claim', side });
    };

    const onRoll = () => {
        socket.emit('game_move', { action: 'roll' });
    };

    const move = (to: number | 'off') => {
        if (!canMove) return;
        if (!selectedFrom) return;
        socket.emit('game_move', {
            action: 'move',
            from: selectedFrom === 'bar' ? 'bar' : selectedFrom,
            to: to === 'off' ? 'off' : to
        });
        setSelectedFrom(null);
    };

    const topRow = Array.from({ length: 12 }, (_, k) => 23 - k);
    const bottomRow = Array.from({ length: 12 }, (_, k) => k);

    const dieView = dice.map((d, idx) => ({ d, used: used[idx] }));

    return (
        <div className="lm-game-modal">
            <div className="lm-game-card animate-scale-up">
                <div className="lm-game-top">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>Tavla</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{sideText(turn)} oynuyor</div>
                    </div>
                    <button className="lm-game-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
                </div>

                <div className="lm-game-claims">
                    <button
                        className={`lm-game-claim ${players.w ? 'taken' : ''} ${mySide === 'w' ? 'me' : ''}`}
                        onClick={() => !players.w && claim('w')}
                        disabled={Boolean(players.w) || Boolean(mySide)}
                    >
                        ⚪ Beyaz
                    </button>
                    <button
                        className={`lm-game-claim ${players.b ? 'taken' : ''} ${mySide === 'b' ? 'me' : ''}`}
                        onClick={() => !players.b && claim('b')}
                        disabled={Boolean(players.b) || Boolean(mySide)}
                    >
                        ⚫ Siyah
                    </button>
                </div>

                <div className="lm-tavla-hud">
                    <div className="lm-tavla-chip">
                        Bar: <span style={{ marginLeft: 6 }}>⚪ {bar.w}</span> <span style={{ marginLeft: 10 }}>⚫ {bar.b}</span>
                    </div>
                    <div className="lm-tavla-chip">
                        Off: <span style={{ marginLeft: 6 }}>⚪ {off.w}</span> <span style={{ marginLeft: 10 }}>⚫ {off.b}</span>
                    </div>
                </div>

                <div className="lm-tavla-board">
                    <div className="lm-tavla-row">
                        {topRow.map(i => (
                            <Point
                                key={i}
                                index={i}
                                data={points[i]}
                                selected={selectedFrom === i}
                                onSelect={() => canMove && setSelectedFrom(i)}
                                onMove={() => move(i)}
                                canMoveHere={Boolean(selectedFrom) && selectedFrom !== i}
                            />
                        ))}
                    </div>

                    <div className="lm-tavla-middle">
                        <button className={`lm-roll ${rollDisabled ? 'disabled' : ''}`} onClick={onRoll} disabled={rollDisabled}>
                            🎲 Zar
                        </button>
                        <div className="lm-dice">
                            {dieView.length ? dieView.map((x, i) => (
                                <div key={i} className={`lm-die ${x.used ? 'used' : ''}`}>{x.d}</div>
                            )) : (
                                <div style={{ fontSize: 11, opacity: 0.6 }}>Zar bekleniyor</div>
                            )}
                        </div>
                        <div className="lm-bar">
                            <button
                                className={`lm-bar-btn ${selectedFrom === 'bar' ? 'selected' : ''}`}
                                onClick={() => canMove && setSelectedFrom('bar')}
                                disabled={!canMove}
                            >
                                BAR
                            </button>
                            <button className="lm-off-btn" onClick={() => move('off')} disabled={!canMove || !selectedFrom}>
                                OFF
                            </button>
                        </div>
                    </div>

                    <div className="lm-tavla-row">
                        {bottomRow.map(i => (
                            <Point
                                key={i}
                                index={i}
                                data={points[i]}
                                selected={selectedFrom === i}
                                onSelect={() => canMove && setSelectedFrom(i)}
                                onMove={() => move(i)}
                                canMoveHere={Boolean(selectedFrom) && selectedFrom !== i}
                                inverted
                            />
                        ))}
                    </div>
                </div>

                <div className="lm-game-bottom">
                    <button className="lm-game-btn" onClick={() => socket.emit('game_start', { type: 'tavla' })}>Yeni Oyun</button>
                    <button className="lm-game-btn danger" onClick={() => socket.emit('game_reset')}>Kapat</button>
                </div>
            </div>

            <style>{`
                .lm-game-modal {
                    position: fixed; inset: 0; z-index: 200;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(6px);
                    display: flex; align-items: center; justify-content: center;
                    padding: 18px;
                }
                .lm-game-card {
                    width: min(520px, 100%);
                    background: rgba(12, 13, 33, 0.92);
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 24px;
                    box-shadow: 0 30px 90px rgba(0,0,0,0.7);
                    padding: 16px;
                    color: #fff;
                }
                .lm-game-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
                .lm-game-close { width: 36px; height: 36px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: #fff; }
                .lm-game-claims { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
                .lm-game-claim { padding: 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.06); color: #fff; font-weight: 800; }
                .lm-game-claim.taken { opacity: 0.5; }
                .lm-game-claim.me { border-color: rgba(34,197,94,0.6); box-shadow: 0 0 0 3px rgba(34,197,94,0.15) inset; }

                .lm-tavla-hud { display: flex; gap: 10px; margin-bottom: 10px; }
                .lm-tavla-chip { flex: 1; padding: 10px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.06); font-weight: 800; font-size: 12px; }

                .lm-tavla-board { border-radius: 18px; border: 1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.25); overflow: hidden; }
                .lm-tavla-row { display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; padding: 10px; }
                .lm-tavla-middle { padding: 10px; display: grid; grid-template-columns: 110px 1fr 110px; gap: 10px; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); }

                .lm-roll { padding: 10px 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.08); color: #fff; font-weight: 900; }
                .lm-roll.disabled { opacity: 0.4; }
                .lm-dice { display: flex; gap: 8px; justify-content: center; }
                .lm-die { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.12); }
                .lm-die.used { opacity: 0.3; transform: scale(0.95); }
                .lm-bar { display: flex; gap: 8px; justify-content: flex-end; }
                .lm-bar-btn, .lm-off-btn { width: 52px; height: 38px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.08); color: #fff; font-weight: 900; font-size: 11px; }
                .lm-bar-btn.selected { box-shadow: 0 0 0 3px rgba(124,77,255,0.2) inset; border-color: rgba(124,77,255,0.6); }

                .lm-game-bottom { display: flex; gap: 10px; margin-top: 12px; }
                .lm-game-btn { flex: 1; padding: 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #fff; font-weight: 900; }
                .lm-game-btn.danger { background: rgba(255,59,48,0.18); border-color: rgba(255,59,48,0.30); color: #ffb4aa; }
            `}</style>
        </div>
    );
}

function Point({
    index,
    data,
    selected,
    onSelect,
    onMove,
    canMoveHere,
    inverted
}: {
    index: number;
    data: { owner: Side | null; count: number };
    selected: boolean;
    onSelect: () => void;
    onMove: () => void;
    canMoveHere: boolean;
    inverted?: boolean;
}) {
    const owner = data?.owner as Side | null;
    const count = data?.count || 0;
    const has = Boolean(owner) && count > 0;
    const bg = (index % 2 === 0) ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)';
    const chip = owner ? sideColor(owner) : '#0000';
    const textColor = owner === 'w' ? '#0b1220' : '#f8fafc';

    return (
        <div
            className={`lm-point ${selected ? 'selected' : ''} ${canMoveHere ? 'canMove' : ''}`}
            onClick={canMoveHere ? onMove : onSelect}
            style={{ background: bg, borderRadius: 12, padding: 6, minHeight: 56, display: 'flex', flexDirection: inverted ? 'column-reverse' : 'column', gap: 4, alignItems: 'center', justifyContent: 'space-between' }}
        >
            <div style={{ fontSize: 9, opacity: 0.5, fontWeight: 900 }}>{pointLabel(index)}</div>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: has ? chip : 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                {has ? (
                    <div style={{ fontWeight: 900, fontSize: 11, color: textColor }}>{count !== 1 ? count : ''}</div>
                ) : (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                )}
            </div>

            <style>{`
                .lm-point { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; border: 1px solid rgba(255,255,255,0.06); }
                .lm-point:active { transform: scale(0.98); }
                .lm-point.selected { border-color: rgba(124,77,255,0.7); box-shadow: 0 0 0 3px rgba(124,77,255,0.2) inset; }
                .lm-point.canMove { border-color: rgba(34,197,94,0.5); }
            `}</style>
        </div>
    );
}
