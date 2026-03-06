import { useMemo, useState } from 'react';

type Side = 'w' | 'b';
type Square = { r: number; c: number };

function pieceToGlyph(p: string | null) {
    if (!p) return '';
    const map: Record<string, string> = {
        K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
        k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
    };
    return map[p] || '';
}

function inBounds(r: number, c: number) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function sideOfPiece(p: string | null): Side | null {
    if (!p) return null;
    return p === p.toUpperCase() ? 'w' : 'b';
}

function getLegalMoves(board: (string | null)[][], from: Square, side: Side) {
    const piece = board[from.r]?.[from.c] || null;
    if (!piece) return [] as Square[];
    if (sideOfPiece(piece) !== side) return [] as Square[];
    const targetSide = (p: string | null) => (p ? sideOfPiece(p) : null);

    const moves: Square[] = [];
    const p = piece.toLowerCase();

    const push = (r: number, c: number) => {
        if (!inBounds(r, c)) return;
        if (targetSide(board[r][c]) === side) return;
        moves.push({ r, c });
    };

    const ray = (dr: number, dc: number) => {
        let r = from.r + dr;
        let c = from.c + dc;
        while (inBounds(r, c)) {
            const t = board[r][c];
            if (!t) {
                moves.push({ r, c });
            } else {
                if (targetSide(t) !== side) moves.push({ r, c });
                break;
            }
            r += dr;
            c += dc;
        }
    };

    if (p === 'p') {
        const dir = side === 'w' ? -1 : 1;
        const start = side === 'w' ? 6 : 1;
        const oneR = from.r + dir;
        if (inBounds(oneR, from.c) && !board[oneR][from.c]) moves.push({ r: oneR, c: from.c });
        const twoR = from.r + dir * 2;
        if (from.r === start && inBounds(twoR, from.c) && !board[oneR][from.c] && !board[twoR][from.c]) moves.push({ r: twoR, c: from.c });
        const capL = { r: from.r + dir, c: from.c - 1 };
        const capR = { r: from.r + dir, c: from.c + 1 };
        [capL, capR].forEach(sq => {
            if (!inBounds(sq.r, sq.c)) return;
            const t = board[sq.r][sq.c];
            if (t && targetSide(t) !== side) moves.push(sq);
        });
    } else if (p === 'n') {
        const deltas = [
            [2, 1], [2, -1], [-2, 1], [-2, -1],
            [1, 2], [1, -2], [-1, 2], [-1, -2]
        ];
        deltas.forEach(([dr, dc]) => push(from.r + dr, from.c + dc));
    } else if (p === 'b') {
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => ray(dr, dc));
    } else if (p === 'r') {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => ray(dr, dc));
    } else if (p === 'q') {
        [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => ray(dr, dc));
    } else if (p === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                push(from.r + dr, from.c + dc);
            }
        }
    }

    return moves;
}

export function Chess2D({
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
    const board: (string | null)[][] = gameState?.board || Array.from({ length: 8 }, () => Array(8).fill(null));
    const turn: Side = gameState?.turn || 'w';
    const players = gameState?.players || { w: null, b: null };
    const mySide: Side | null = players?.w === userId ? 'w' : players?.b === userId ? 'b' : null;

    const [selected, setSelected] = useState<Square | null>(null);

    const legalMoves = useMemo(() => {
        if (!selected || !mySide) return [] as Square[];
        return getLegalMoves(board, selected, mySide);
    }, [board, selected, mySide]);

    const isLegalDest = (r: number, c: number) => legalMoves.some(m => m.r === r && m.c === c);

    const claim = (side: Side) => {
        socket.emit('game_move', { action: 'claim', side });
    };

    const clickSquare = (r: number, c: number) => {
        if (!mySide) return;
        if (turn !== mySide) return;

        if (!selected) {
            const p = board[r][c];
            if (p && sideOfPiece(p) === mySide) setSelected({ r, c });
            return;
        }

        if (selected.r === r && selected.c === c) {
            setSelected(null);
            return;
        }

        if (isLegalDest(r, c)) {
            socket.emit('game_move', {
                action: 'move',
                from: selected,
                to: { r, c }
            });
            setSelected(null);
            return;
        }

        const p = board[r][c];
        if (p && sideOfPiece(p) === mySide) {
            setSelected({ r, c });
            return;
        }

        setSelected(null);
    };

    const last = gameState?.lastMove;
    const lastFromKey = last?.from ? `${last.from.r}_${last.from.c}` : null;
    const lastToKey = last?.to ? `${last.to.r}_${last.to.c}` : null;

    return (
        <div className="lm-game-modal">
            <div className="lm-game-card animate-scale-up">
                <div className="lm-game-top">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>Satranç</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{turn === 'w' ? 'Beyaz' : 'Siyah'} oynuyor</div>
                    </div>
                    <button className="lm-game-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
                </div>

                <div className="lm-game-claims">
                    <button
                        className={`lm-game-claim ${players.w ? 'taken' : ''} ${mySide === 'w' ? 'me' : ''}`}
                        onClick={() => !players.w && claim('w')}
                        disabled={Boolean(players.w) || Boolean(mySide)}
                    >
                        ♔ Beyaz
                    </button>
                    <button
                        className={`lm-game-claim ${players.b ? 'taken' : ''} ${mySide === 'b' ? 'me' : ''}`}
                        onClick={() => !players.b && claim('b')}
                        disabled={Boolean(players.b) || Boolean(mySide)}
                    >
                        ♚ Siyah
                    </button>
                </div>

                <div className="lm-chess-board" style={{ pointerEvents: mySide ? 'auto' : 'none' }}>
                    {board.map((row, r) => (
                        row.map((p, c) => {
                            const dark = (r + c) % 2 === 1;
                            const key = `${r}_${c}`;
                            const isSel = selected?.r === r && selected?.c === c;
                            const isLast = key === lastFromKey || key === lastToKey;
                            const canMove = selected && isLegalDest(r, c);
                            return (
                                <div
                                    key={key}
                                    className={`lm-chess-square ${dark ? 'dark' : 'light'} ${isSel ? 'selected' : ''} ${isLast ? 'last' : ''} ${canMove ? 'hint' : ''}`}
                                    onClick={() => clickSquare(r, c)}
                                >
                                    <div className="lm-chess-piece">{pieceToGlyph(p)}</div>
                                </div>
                            );
                        })
                    ))}
                </div>

                <div className="lm-game-bottom">
                    <button className="lm-game-btn" onClick={() => socket.emit('game_start', { type: 'chess' })}>Yeni Oyun</button>
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
                    width: min(420px, 100%);
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

                .lm-chess-board {
                    width: 100%;
                    aspect-ratio: 1 / 1;
                    display: grid;
                    grid-template-columns: repeat(8, 1fr);
                    border-radius: 18px;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(0,0,0,0.3);
                }
                .lm-chess-square { display: flex; align-items: center; justify-content: center; position: relative; transition: transform 0.15s ease; }
                .lm-chess-square:active { transform: scale(0.98); }
                .lm-chess-square.light { background: rgba(255,255,255,0.10); }
                .lm-chess-square.dark { background: rgba(255,255,255,0.04); }
                .lm-chess-square.selected { outline: 2px solid rgba(124,77,255,0.9); z-index: 2; }
                .lm-chess-square.last { box-shadow: 0 0 0 2px rgba(236,72,153,0.5) inset; }
                .lm-chess-square.hint::after {
                    content: '';
                    width: 10px; height: 10px;
                    border-radius: 50%;
                    background: rgba(34,197,94,0.8);
                    position: absolute;
                    box-shadow: 0 0 20px rgba(34,197,94,0.5);
                }
                .lm-chess-piece { font-size: 28px; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.6)); user-select: none; }

                .lm-game-bottom { display: flex; gap: 10px; margin-top: 12px; }
                .lm-game-btn { flex: 1; padding: 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #fff; font-weight: 900; }
                .lm-game-btn.danger { background: rgba(255,59,48,0.18); border-color: rgba(255,59,48,0.30); color: #ffb4aa; }
            `}</style>
        </div>
    );
}

