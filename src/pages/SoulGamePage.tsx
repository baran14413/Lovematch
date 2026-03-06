import { useState } from 'react';

/**
 * =========================================================================
 *  LOVEMATCH V4 - PREMIUM SOUL GAME
 *  Design: Atmospheric / Magical / Deep Velvet
 * =========================================================================
 */

const QUESTIONS = [
    'En çok hangi müzik ruhuna dokunuyor? 🎵',
    'Günün en sevdiğin saati hangisi ve neden? 🌅',
    'Seni en çok ne güldürür? 😂',
    'Hiç bilmediğin bir yere gitseydin, ilk ne yapardın? ✈️',
    'Hayatındaki en büyük ilham kaynağın nedir? ✨',
];

type Phase = 'lobby' | 'matching' | 'game' | 'matched';

export default function SoulGamePage() {
    const [phase, setPhase] = useState<Phase>('lobby');
    const [qIdx, setQIdx] = useState(0);
    const [myAnswer, setMyAnswer] = useState('');
    const [matchProgress, setMatchProgress] = useState(0);

    const startMatching = () => {
        setPhase('matching');
        let p = 0;
        const iv = setInterval(() => {
            p += Math.random() * 8 + 5;
            if (p >= 100) {
                p = 100;
                clearInterval(iv);
                setTimeout(() => setPhase('game'), 600);
            }
            setMatchProgress(Math.floor(p));
        }, 150);
    };

    const submitAnswer = () => {
        if (!myAnswer.trim()) return;
        // setAnswers(prev => [...prev, myAnswer]); // V4 simplified flow
        setMyAnswer('');
        if (qIdx < QUESTIONS.length - 1) {
            setQIdx(q => q + 1);
        } else {
            setPhase('matched');
        }
    };

    return (
        <div style={{ minHeight: '100%', background: 'var(--bg-deep)', color: '#fff', paddingBottom: 100, position: 'relative', overflow: 'hidden' }}>
            {/* Background Atmosphere */}
            <div style={{ position: 'absolute', top: '10%', right: '-10%', width: 400, height: 400, background: 'rgba(124, 77, 255, 0.1)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '10%', left: '-10%', width: 350, height: 350, background: 'rgba(236, 72, 153, 0.1)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />

            {/* Header */}
            <header style={{
                padding: '60px 24px 20px',
                textAlign: 'center',
                animation: 'lm-slide-down 0.6s ease'
            }}>
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 950,
                    margin: 0,
                    background: 'var(--premium-gradient)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-1px'
                }}>Soul Game</h1>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, marginTop: 6 }}>Kelimelerle bağlan, ruhuyla tanış 🔮</p>
            </header>

            <main style={{ padding: '0 24px', position: 'relative', zIndex: 10 }}>
                {phase === 'lobby' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'lm-fade-in 0.6s ease' }}>
                        <div className="lm-premium-card" style={{ padding: 24, paddingBottom: 30 }}>
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                <div style={{ fontSize: 72, marginBottom: 12, animation: 'lm-bounce 3s infinite ease-in-out' }}>🔮</div>
                                <h2 style={{ fontSize: 20, fontWeight: 900 }}>Nasıl Oynanır?</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {[
                                    { icon: '🎭', title: 'Tamamen Anonim', desc: 'Kimliğin eşleşene kadar gizli kalacak.' },
                                    { icon: '❓', title: '5 Özel Soru', desc: 'Ruhuna dokunan soruları cevapla.' },
                                    { icon: '💖', title: 'Ruh Eşi Uyumu', desc: 'Ortak noktalarına göre eşleşmeyi tamamla.' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '1px solid var(--glass-border)' }}>{item.icon}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 14, fontWeight: 800 }}>{item.title}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontWeight: 600 }}>{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={startMatching} className="lm-primary-button" style={{
                            fontSize: 18, padding: '18px 0', width: '100%',
                            marginTop: 10, boxShadow: '0 10px 40px rgba(124, 77, 255, 0.5)'
                        }}>
                            BAŞLAMAK İÇİN TIKLA 🔥
                        </button>
                    </div>
                )}

                {phase === 'matching' && (
                    <div style={{ padding: '40px 0', animation: 'lm-scale-up 0.5s ease' }}>
                        <div className="lm-premium-card" style={{ padding: 40, textAlign: 'center' }}>
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 30 }}>
                                <div style={{ fontSize: 80, animation: 'lm-pulse-glow 1.5s infinite' }}>🪄</div>
                                <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 30, animation: 'lm-bounce 2s infinite' }}>✨</div>
                            </div>
                            <h2 style={{ fontSize: 22, fontWeight: 950, marginBottom: 12 }}>Evren Taranıyor...</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 40 }}>Sana en yakın ruh aranıyor, bu biraz zaman alabilir.</p>

                            <div style={{ position: 'relative', height: 10, background: 'var(--bg-dark)', borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, height: '100%',
                                    width: `${matchProgress}%`, background: 'var(--premium-gradient)',
                                    borderRadius: 10, transition: 'width 0.3s ease'
                                }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--purple-light)', marginTop: 12, fontWeight: 900 }}>%{matchProgress} HAZIR</div>
                        </div>
                    </div>
                )}

                {phase === 'game' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'lm-slide-up 0.5s ease' }}>
                        {/* Progress Bar */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, fontWeight: 800 }}>
                                <span style={{ color: 'var(--text-dim)' }}>SORU {qIdx + 1}/{QUESTIONS.length}</span>
                                <span style={{ color: 'var(--purple-light)' }}>%{(qIdx / QUESTIONS.length) * 100}</span>
                            </div>
                            <div style={{ height: 6, background: 'var(--glass-bg)', borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: `${(qIdx / QUESTIONS.length) * 100}%`,
                                    background: 'var(--premium-gradient)', borderRadius: 10, transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </div>
                        </div>

                        {/* Question Card */}
                        <div className="lm-premium-card" style={{ padding: 32, textAlign: 'center', background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.1), transparent)' }}>
                            <div style={{ fontSize: 44, marginBottom: 16 }}>💭</div>
                            <h2 style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.5 }}>{QUESTIONS[qIdx]}</h2>
                        </div>

                        {/* Partner Placeholder */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 10px' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 16, background: 'var(--premium-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 5px 15px rgba(124,77,255,0.3)' }}>👻</div>
                            <div className="lm-premium-card" style={{ flex: 1, padding: '12px 16px', borderRadius: 18, borderStyle: 'dashed' }}>
                                <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 700 }}>Eşin cevap yazıyor... <span className="animate-pulse">✍️</span></div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div style={{ marginTop: 10 }}>
                            <div className="lm-premium-card" style={{ padding: '4px 4px 4px 20px', display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--bg-dark)' }}>
                                <textarea
                                    autoFocus
                                    value={myAnswer}
                                    onChange={e => setMyAnswer(e.target.value)}
                                    placeholder="Ruhundan bir parça bırak..."
                                    style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 15, padding: '16px 0', outline: 'none', resize: 'none', minHeight: 80, fontFamily: 'inherit' }}
                                />
                                <button onClick={submitAnswer} style={{
                                    width: 50, height: 50, borderRadius: 16,
                                    background: myAnswer.trim() ? 'var(--premium-gradient)' : 'var(--glass-bg)',
                                    border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer',
                                    marginBottom: 4, marginRight: 4, transition: '0.3s'
                                }}>
                                    <i className="fa-solid fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'matched' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'lm-scale-up 0.6s ease' }}>
                        <div className="lm-premium-card" style={{ padding: 40, textAlign: 'center' }}>
                            <div style={{ fontSize: 80, marginBottom: 15, animation: 'lm-bounce 2s infinite' }}>💖</div>
                            <h2 style={{ fontSize: 26, fontWeight: 950, marginBottom: 8 }}>Mükemmel Uyum!</h2>
                            <p style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 32 }}>Spiritüel bağınız tamamlandı. Artık gizem perdesini aralayabilirsiniz.</p>

                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 40 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ width: 70, height: 70, borderRadius: 25, background: 'var(--premium-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 8px 20px rgba(124, 77, 255, 0.3)' }}>👤</div>
                                    <div style={{ fontSize: 12, fontWeight: 800, marginTop: 8 }}>Sen</div>
                                </div>
                                <div style={{ fontSize: 24, padding: '12px', background: 'rgba(236,72,153,0.1)', borderRadius: 15, color: '#ec4899', animation: 'lm-pulse-glow 1.5s infinite' }}>
                                    <i className="fa-solid fa-heart"></i>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ width: 70, height: 70, borderRadius: 25, background: 'var(--premium-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 8px 20px rgba(124, 77, 255, 0.3)' }}>🌸</div>
                                    <div style={{ fontSize: 12, fontWeight: 800, marginTop: 8 }}>Gizemli</div>
                                </div>
                            </div>

                            <button className="lm-primary-button" style={{ width: '100%', height: 60, fontSize: 18 }}>
                                💬 SOHBETE BAŞLA
                            </button>
                            <button
                                onClick={() => { setPhase('lobby'); setQIdx(0); }}
                                className="lm-glass-button"
                                style={{ width: '100%', marginTop: 15, height: 50 }}
                            >
                                Tekrar Dene
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
