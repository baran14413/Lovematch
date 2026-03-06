import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../pb';

const HOBBIES_LIST = [
    { id: 'music', label: 'Müzik 🎵', color: '#8b5cf6' },
    { id: 'gaming', label: 'Oyun 🎮', color: '#ef4444' },
    { id: 'reading', label: 'Kitap 📚', color: '#10b981' },
    { id: 'sports', label: 'Spor ⚽', color: '#3b82f6' },
    { id: 'travel', label: 'Seyahat ✈️', color: '#f59e0b' },
    { id: 'movie', label: 'Film 🎬', color: '#ec4899' },
    { id: 'coding', label: 'Yazılım 💻', color: '#6366f1' },
    { id: 'art', label: 'Sanat 🎨', color: '#f43f5e' },
    { id: 'food', label: 'Yemek 🍕', color: '#f97316' },
    { id: 'photo', label: 'Fotoğraf 📸', color: '#06b6d4' },
];

export default function AuthPage({ onLogin }: { onLogin: () => void }) {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
    const selectedColor = '#8b5cf6';
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [suggestedPassword, setSuggestedPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [regPhotoPreview, setRegPhotoPreview] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [captchaChecked, setCaptchaChecked] = useState(false);
    const shakeRef = useRef<HTMLDivElement>(null);

    const shake = () => {
        shakeRef.current?.classList.remove('shake-anim');
        void shakeRef.current?.offsetWidth;
        shakeRef.current?.classList.add('shake-anim');
    };

    const generateSmartPassword = () => {
        const adjectives = ['Hızlı', 'Mutlu', 'Cesur', 'Zeki', 'Parlak', 'Güçlü', 'Süper', 'Kozmik'];
        const nouns = ['Kartal', 'Arslan', 'Bulut', 'Yıldız', 'Güneş', 'Anka', 'Uzay', 'Denizyıldızı'];
        const num = Math.floor(Math.random() * 900) + 100;
        const symbols = '!@#$%&';
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const pass = adjectives[Math.floor(Math.random() * adjectives.length)] +
            nouns[Math.floor(Math.random() * nouns.length)] +
            num + symbol;
        setSuggestedPassword(pass);
    };

    const useSuggestedPassword = () => {
        setPassword(suggestedPassword);
        setPasswordConfirm(suggestedPassword);
        setSuggestedPassword('');
    };

    // Validation helpers
    const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const validatePassword = (p: string) => p.length >= 8;
    const validateUsername = (u: string) => u.trim().length >= 2;

    const getPasswordStrength = (p: string): { level: number; text: string; color: string } => {
        if (p.length === 0) return { level: 0, text: '', color: '' };
        if (p.length < 6) return { level: 1, text: 'Çok Zayıf', color: '#ef4444' };
        if (p.length < 8) return { level: 2, text: 'Zayıf', color: '#f97316' };
        const hasUpper = /[A-ZÇĞİÖŞÜ]/.test(p);
        const hasNumber = /\d/.test(p);
        const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(p);
        const score = [hasUpper, hasNumber, hasSymbol, p.length >= 10].filter(Boolean).length;
        if (score <= 1) return { level: 2, text: 'Orta', color: '#f59e0b' };
        if (score <= 2) return { level: 3, text: 'Güçlü', color: '#10b981' };
        return { level: 4, text: 'Çok Güçlü 💪', color: '#22c55e' };
    };

    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSent, setForgotSent] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!email) errs.email = 'E-posta gerekli';
        else if (!validateEmail(email)) errs.email = 'Geçerli bir e-posta girin';
        if (!password) errs.password = 'Şifre gerekli';
        if (Object.keys(errs).length > 0) { setFieldErrors(errs); shake(); return; }
        setFieldErrors({});
        setLoading(true);
        setError('');
        try {
            await pb.collection('users').authWithPassword(email, password);
            onLogin();
        } catch (err: any) {
            setError('Giriş başarısız. E-posta veya şifre hatalı.');
            shake();
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateEmail(forgotEmail)) {
            setError('Geçerli bir e-posta adresi girin.');
            shake();
            return;
        }
        setLoading(true);
        setError('');
        try {
            await pb.collection('users').requestPasswordReset(forgotEmail);
            setForgotSent(true);
        } catch (err: any) {
            setError('İşlem başarısız. E-posta adresi sistemde kayıtlı olmayabilir.');
            shake();
        } finally {
            setLoading(false);
        }
    };

    const validateStep = (s: number): boolean => {
        const errs: Record<string, string> = {};
        if (s === 2 && !validateUsername(username)) { errs.username = 'En az 2 karakter olmalı'; }
        if (s === 4 && !validateEmail(email)) { errs.email = 'Geçerli bir e-posta girin'; }
        if (s === 6) {
            if (!validatePassword(password)) errs.password = 'En az 8 karakter olmalı';
            if (password !== passwordConfirm) errs.passwordConfirm = 'Şifreler eşleşmiyor';
        }
        if (s === 7) {
            if (selectedHobbies.length === 0) errs.hobbies = 'En az 1 hobi seç';
            if (!captchaChecked) errs.captcha = 'CAPTCHA doğrulaması gerekli';
        }
        if (s === 8 && !regPhotoPreview) { errs.photo = 'Profil fotoğrafı yüklemek zorunludur'; }
        if (Object.keys(errs).length > 0) { setFieldErrors(errs); shake(); return false; }
        setFieldErrors({});
        return true;
    };

    const goNext = (from: number, to: number) => {
        if (validateStep(from)) setStep(to);
    };

    const handleRegister = async () => {
        if (!validateStep(8)) return;
        setLoading(true);
        setError('');
        try {
            let safeUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
            if (safeUsername.length < 3) safeUsername = 'user_' + Math.floor(Math.random() * 100000);

            const formData = new FormData();
            formData.append('email', email);
            formData.append('password', password);
            formData.append('passwordConfirm', passwordConfirm);
            formData.append('username', safeUsername);
            formData.append('name', username.trim());
            formData.append('bio', bio);
            formData.append('hobbies', selectedHobbies.join(','));
            formData.append('coins', '1000');
            formData.append('level', '1');
            formData.append('color', selectedColor);

            const fileInput = document.getElementById('reg-avatar-file') as HTMLInputElement;
            if (fileInput?.files?.[0]) {
                formData.append('avatar', fileInput.files[0]);
            }

            await pb.collection('users').create(formData);
            await pb.collection('users').authWithPassword(email, password);
            onLogin();
        } catch (err: any) {
            const msg = err?.data?.data;
            if (msg?.email) setError('Bu e-posta zaten kayıtlı.');
            else if (msg?.username) setError('Bu kullanıcı adı alınmış, başka bir tane dene.');
            else setError(err.message || 'Kayıt sırasında bir hata oluştu.');
            shake();
        } finally {
            setLoading(false);
        }
    };


    const toggleHobby = (id: string) => {
        setSelectedHobbies(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]);
    };

    const pwStrength = getPasswordStrength(password);
    const totalSteps = 7;
    const hearts = Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 13) % 100}%`,
        size: 16 + (i % 4) * 6,
        delay: `${(i % 6) * 0.8}s`,
        duration: `${8 + (i % 5)}s`,
        opacity: 0.15 + (i % 4) * 0.1
    }));

    return (
        <div style={{
            minHeight: '100vh', width: '100%', position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05070a'
        }}>
            {/* Animated Background */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
                <div className="bg-orb orb-1" />
                <div className="bg-orb orb-2" />
                <div className="bg-orb orb-3" />
                <div className="hearts-layer">
                    {hearts.map(heart => (
                        <span
                            key={heart.id}
                            style={{
                                left: heart.left,
                                width: heart.size,
                                height: heart.size,
                                animationDelay: heart.delay,
                                animationDuration: heart.duration,
                                opacity: heart.opacity
                            }}
                        />
                    ))}
                </div>
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(40px)' }} />
            </div>

            <main className="auth-shell">
                <section className="auth-right" style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
                    {(step === 1 || isLogin) && (
                        <div style={{ textAlign: 'center', marginBottom: 36 }} className="animate-in-top">
                            <div style={{
                                fontSize: 70,
                                marginBottom: 12,
                                color: 'var(--lovematch-purple)',
                                filter: 'drop-shadow(0 0 20px rgba(124, 77, 255, 0.3))'
                            }}>
                                <i className="fa-solid fa-face-smile-wink"></i>
                            </div>
                            <h1 style={{
                                fontSize: 38, fontWeight: 950, letterSpacing: '-1.5px',
                                color: '#fff', margin: 0
                            }}>LoveMatch</h1>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, fontWeight: 700, letterSpacing: 1 }}>YENİ NESİL SOSYAL PLATFORM</p>
                        </div>
                    )}

                    <div ref={shakeRef} style={{
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 32, padding: 32, backdropFilter: 'blur(20px)',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                        overflow: 'hidden'
                    }} className="animate-in-bottom">

                        {error && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '12px 16px', borderRadius: 16, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span>⚠️</span> {error}
                            </div>
                        )}
                        {isLogin ? (
                            showForgot ? (
                                /* FORGOT PASSWORD VIEW */
                                <div style={{ animation: 'fadeIn 0.4s ease' }}>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Şifre Sıfırlama</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>Sana bir sıfırlama bağlantısı gönderelim.</p>

                                    {forgotSent ? (
                                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                                            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>Bağlantı Gönderildi!</div>
                                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Spam klasörünü kontrol etmeyi unutma.</p>
                                            <button className="lm-primary-button" onClick={() => { setShowForgot(false); setForgotSent(false); }} style={{ width: '100%', marginTop: 24 }}>Girişe Dön</button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div className="p-input-container">
                                                <input className="p-input" type="email" placeholder="E-posta Adresin" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                                            </div>
                                            <button className="lm-primary-button" type="submit" disabled={loading} style={{ width: '100%', height: 60, fontSize: 18 }}>
                                                {loading ? <div className="love-loader"><div></div><div></div><div></div><div></div></div> : 'Bağlantı Gönder ✉️'}
                                            </button>
                                            <button className="p-btn-text" type="button" onClick={() => setShowForgot(false)}>Geri Dön</button>
                                        </form>
                                    )}
                                </div>
                            ) : (
                                /* LOGIN VIEW */
                                <div style={{ animation: 'fadeIn 0.4s ease' }}>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Giriş Yap</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>Tekrar hoş geldin, seni özledik!</p>

                                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div>
                                            <div className="p-input-container" style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}>
                                                <input className="p-input" type="email" placeholder="E-posta" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }} autoComplete="email" />
                                            </div>
                                            {fieldErrors.email && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 600, paddingLeft: 4 }}>{fieldErrors.email}</div>}
                                        </div>
                                        <div>
                                            <div className="p-input-container" style={{ display: 'flex', alignItems: 'center', ...(fieldErrors.password ? { borderColor: '#ef4444' } : {}) }}>
                                                <input className="p-input" type={showPassword ? 'text' : 'password'} placeholder="Şifre" value={password} onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }} autoComplete="current-password" />
                                                <span onClick={() => setShowPassword(!showPassword)} style={{ padding: '0 16px', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>{showPassword ? '🙈' : '👁️'}</span>
                                            </div>
                                            {fieldErrors.password && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 600, paddingLeft: 4 }}>{fieldErrors.password}</div>}
                                        </div>
                                        <button className="lm-primary-button" type="submit" disabled={loading} style={{ width: '100%', height: 60, fontSize: 18 }}>
                                            {loading ? <div className="love-loader"><div></div><div></div><div></div><div></div></div> : 'Giriş Yap 🚀'}
                                        </button>
                                    </form>
                                    <div className="login-meta" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                                        <button className="link-btn" type="button" onClick={() => setShowForgot(true)}>Şifremi Unuttum</button>
                                    </div>

                                    <div style={{ textAlign: 'center', marginTop: 32, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                                        Hesabın yok mu? <span style={{ color: '#a78bfa', fontWeight: 700, cursor: 'pointer' }} onClick={() => { setIsLogin(false); setError(''); setFieldErrors({}); }}>Hemen Kayıt Ol</span>
                                    </div>
                                </div>
                            )
                        ) : (
                            /* REGISTER */
                            <div style={{ transition: 'all 0.3s ease' }}>
                                {step > 1 && (
                                    <div className="reg-progress">
                                        <div className="reg-progress-track">
                                            <div className="reg-progress-fill" style={{ width: `${((step - 1) / totalSteps) * 100}%` }} />
                                        </div>
                                        <div className="reg-progress-label">{step - 1}/{totalSteps}</div>
                                    </div>
                                )}

                                {step === 1 && (
                                    <div className="reg-step">
                                        <div className="reg-hero">
                                            <div className="reg-hero-icon">✨</div>
                                            <h2 className="reg-title">Aramıza Katıl</h2>
                                            <p className="reg-sub">Kendi topluluğuna katıl ve gerçek insanlarla tanışmaya başla.</p>
                                        </div>
                                        <div className="reg-action">
                                            <button onClick={() => setStep(2)} className="reg-primary-btn">Yeni Hesap Oluştur</button>
                                            <div className="reg-link">Zaten üye misin? <span onClick={() => { setIsLogin(true); setError(''); setFieldErrors({}); }}>Giriş Yap</span></div>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="reg-step">
                                        <div className="reg-hero">
                                            <div className="reg-hero-icon">😎</div>
                                            <h2 className="reg-title">Adın Ne?</h2>
                                            <p className="reg-sub">Diğer kullanıcılar seni bu isimle görecek.</p>
                                        </div>
                                        <div className="reg-form">
                                            <div className="p-input-container" style={fieldErrors.username ? { borderColor: '#ef4444' } : {}}>
                                                <input className="p-input" autoFocus placeholder="Havalı bir kullanıcı adı..." value={username} onChange={e => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: '' })); }} maxLength={20} />
                                            </div>
                                            {fieldErrors.username && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 600 }}>{fieldErrors.username}</div>}
                                            <div className="reg-hint">@{(username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'kullanici')}</div>
                                        </div>
                                        <div className="reg-action">
                                            <button onClick={() => goNext(2, 3)} className="reg-primary-btn">Devam Et</button>
                                            <button onClick={() => setStep(1)} className="reg-secondary-btn">Geri</button>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="reg-step">
                                        <div className="reg-hero">
                                            <div className="reg-hero-icon">📝</div>
                                            <h2 className="reg-title">Kendinden Bahset</h2>
                                            <p className="reg-sub">Kısa bir biyografi yaz (isteğe bağlı)</p>
                                        </div>
                                        <div className="reg-form">
                                            <div className="p-input-container">
                                                <textarea className="p-input" autoFocus placeholder="Selam! Ben..." style={{ height: 100, paddingTop: 16, resize: 'none' }} value={bio} onChange={e => setBio(e.target.value)} maxLength={200} />
                                            </div>
                                            <div className="reg-counter">{bio.length}/200</div>
                                        </div>
                                        <div className="reg-action">
                                            <button onClick={() => setStep(4)} className="reg-primary-btn">Harika, Devam!</button>
                                            <button onClick={() => setStep(2)} className="reg-secondary-btn">Geri</button>
                                        </div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="reg-step">
                                        <div className="reg-hero">
                                            <div className="reg-hero-icon">📧</div>
                                            <h2 className="reg-title">E‑posta</h2>
                                            <p className="reg-sub">Hesabını kurtarmak için kullanılacak.</p>
                                        </div>
                                        <div className="reg-form">
                                            <div className="p-input-container" style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}>
                                                <input className="p-input" autoFocus type="email" placeholder="ornek@mail.com" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }} autoComplete="email" />
                                            </div>
                                            {fieldErrors.email && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 600 }}>{fieldErrors.email}</div>}
                                        </div>
                                        <div className="reg-action">
                                            {/* E-posta doğrulama adımını atla (Step 5 -> 6) */}
                                            <button onClick={() => goNext(4, 6)} className="reg-primary-btn">Son Adımlara Geldik</button>
                                            <button onClick={() => setStep(3)} className="reg-secondary-btn">Geri</button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 5 (Doğrulama) Kaldırıldı */}

                                {step === 6 && (
                                    <div className="reg-step">
                                        <div className="reg-hero">
                                            <div className="reg-hero-icon">🔒</div>
                                            <h2 className="reg-title">Güçlü Bir Şifre</h2>
                                            <p className="reg-sub">En az 8 karakter, büyük harf ve rakam önerilir.</p>
                                        </div>
                                        <div className="reg-form">
                                            <div>
                                                <div className="p-input-container" style={{ display: 'flex', alignItems: 'center', ...(fieldErrors.password ? { borderColor: '#ef4444' } : {}) }}>
                                                    <input className="p-input" type={showPassword ? 'text' : 'password'} placeholder="Şifre" value={password} onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }} />
                                                    <span onClick={() => setShowPassword(!showPassword)} style={{ padding: '0 16px', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>{showPassword ? '🙈' : '👁️'}</span>
                                                </div>
                                                {fieldErrors.password && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 600 }}>{fieldErrors.password}</div>}
                                            </div>
                                            <div>
                                                <div className="p-input-container" style={fieldErrors.passwordConfirm ? { borderColor: '#ef4444' } : {}}>
                                                    <input className="p-input" type={showPassword ? 'text' : 'password'} placeholder="Şifre Tekrar" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setFieldErrors(p => ({ ...p, passwordConfirm: '' })); }} />
                                                </div>
                                                {fieldErrors.passwordConfirm && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 600 }}>{fieldErrors.passwordConfirm}</div>}
                                            </div>

                                            {password.length > 0 && (
                                                <div className="reg-strength">
                                                    <div className="reg-strength-bars">
                                                        {[1, 2, 3, 4].map(i => (
                                                            <div key={i} className="reg-strength-bar" style={{ background: i <= pwStrength.level ? pwStrength.color : 'rgba(255,255,255,0.1)' }} />
                                                        ))}
                                                    </div>
                                                    <div className="reg-strength-text" style={{ color: pwStrength.color }}>{pwStrength.text}</div>
                                                </div>
                                            )}

                                            <div className="reg-suggest">
                                                {!suggestedPassword ? (
                                                    <button onClick={generateSmartPassword} className="reg-suggest-btn">✨ Akıllı Şifre Önerisi Al</button>
                                                ) : (
                                                    <div className="reg-suggest-row">
                                                        <span>{suggestedPassword}</span>
                                                        <button onClick={useSuggestedPassword}>Kullan</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="reg-action">
                                            <button onClick={() => goNext(6, 7)} className="reg-primary-btn">Devam Et</button>
                                            {/* Step 5 atlandığı için geri butonu Step 4'e gitmeli */}
                                            <button onClick={() => setStep(4)} className="reg-secondary-btn">Geri</button>
                                        </div>
                                    </div>
                                )}

                                {step === 7 && (
                                    <div className="reg-step">
                                        <div className="reg-hero">
                                            <div className="reg-hero-icon">🎮</div>
                                            <h2 className="reg-title">Hobilerin</h2>
                                            <p className="reg-sub">Seni yansıtan şeyleri seç (en az 1)</p>
                                        </div>
                                        <div className="reg-form">
                                            <div className="reg-hobbies">
                                                {HOBBIES_LIST.map(hobby => (
                                                    <div key={hobby.id} onClick={() => toggleHobby(hobby.id)} className={`reg-hobby ${selectedHobbies.includes(hobby.id) ? 'active' : ''}`} style={{
                                                        border: `1px solid ${selectedHobbies.includes(hobby.id) ? hobby.color : 'rgba(255,255,255,0.08)'}`,
                                                        background: selectedHobbies.includes(hobby.id) ? `${hobby.color}20` : 'rgba(255,255,255,0.03)',
                                                        color: selectedHobbies.includes(hobby.id) ? hobby.color : 'rgba(255,255,255,0.4)'
                                                    }}>{hobby.label}</div>
                                                ))}
                                            </div>
                                            {fieldErrors.hobbies && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 12, fontWeight: 600 }}>{fieldErrors.hobbies}</div>}
                                            <label className={`reg-captcha ${captchaChecked ? 'active' : ''}`}>
                                                <input type="checkbox" checked={captchaChecked} onChange={() => { setCaptchaChecked(v => !v); setFieldErrors(p => ({ ...p, captcha: '' })); }} />
                                                <span>Ben robot değilim</span>
                                                <em>CAPTCHA</em>
                                            </label>
                                            {fieldErrors.captcha && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 12, fontWeight: 600 }}>{fieldErrors.captcha}</div>}
                                        </div>
                                        <div className="reg-action">
                                            <button onClick={() => goNext(7, 8)} className="reg-primary-btn">Son Adım: Fotoğraf Ekle</button>
                                            <button onClick={() => setStep(6)} className="reg-secondary-btn">Geri</button>
                                        </div>
                                    </div>
                                )}

                                {step === 8 && (
                                    <div className="reg-step">
                                        <div className="reg-hero">
                                            <div className="reg-hero-icon">📸</div>
                                            <h2 className="reg-title">Profil Fotoğrafın</h2>
                                            <p className="reg-sub">Seni en iyi yansıtan kareyi seç. Fotoğraf yüklemek zorunludur.</p>
                                        </div>
                                        <div className="reg-form">
                                            <div className="reg-photo">
                                                <label htmlFor="reg-avatar-file" className={`reg-photo-box ${fieldErrors.photo ? 'error' : ''}`}>
                                                    {regPhotoPreview ? (
                                                        <img src={regPhotoPreview} alt="preview" />
                                                    ) : (
                                                        <>
                                                            <span>🖼️</span>
                                                            <em>FOTOĞRAF SEÇ</em>
                                                        </>
                                                    )}
                                                    <input type="file" id="reg-avatar-file" accept="image/*" style={{ display: 'none' }}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (re) => {
                                                                    setRegPhotoPreview(re.target?.result as string);
                                                                    setFieldErrors(p => ({ ...p, photo: '' }));
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }} />
                                                </label>
                                                {fieldErrors.photo && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 12, fontWeight: 700 }}>{fieldErrors.photo}</div>}
                                            </div>
                                        </div>
                                        <div className="reg-action">
                                            <button onClick={handleRegister} disabled={loading} className="reg-primary-btn">
                                                {loading ? <div className="love-loader"><div></div><div></div><div></div><div></div></div> : 'Macerayı Başlat!'}
                                            </button>
                                            <button onClick={() => setStep(7)} className="reg-secondary-btn">Geri</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'center', gap: 20 }}>
                        <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/privacy')}>Gizlilik</span>
                        <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/privacy')}>Şartlar</span>
                    </div>
                </section>
            </main>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-in-top { animation: fadeIn 0.6s ease-out backwards; }
                .animate-in-bottom { animation: fadeIn 0.8s ease-out 0.2s backwards; }
                
                .bg-orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.5; animation: float 10s infinite alternate; }
                .orb-1 { width: 500px; height: 500px; background: #8b5cf6; top: -100px; left: -100px; }
                .orb-2 { width: 400px; height: 400px; background: #ec4899; bottom: -100px; right: -100px; animation-delay: -5s; }
                .orb-3 { width: 300px; height: 300px; background: #3b82f6; top: 40%; left: 60%; animation-delay: -3s; }
                @keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 40px) scale(1.1); } }

                .hearts-layer { position: absolute; inset: 0; overflow: hidden; }
                .hearts-layer span {
                    position: absolute;
                    bottom: -10%;
                    background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(255, 64, 129, 0.6));
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    animation: heartFloat linear infinite;
                }
                @keyframes heartFloat {
                    0% { transform: translateY(0) rotate(-45deg) scale(0.9); opacity: 0; }
                    10% { opacity: 0.8; }
                    100% { transform: translateY(-140vh) rotate(-45deg) scale(1.1); opacity: 0; }
                }

                .auth-shell {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    padding: 32px 20px;
                    display: flex;
                    justify-content: center;
                }

                .auth-left {
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                    padding: 20px 16px;
                    color: #fff;
                }

                .auth-brand h1 { margin: 0 0 6px; font-size: 34px; font-weight: 950; }
                .auth-brand p { margin: 0; color: rgba(255,255,255,0.6); font-size: 14px; }
                .auth-brand-icon { font-size: 44px; margin-bottom: 12px; animation: regFloat 3s ease-in-out infinite; }

                .auth-feature-grid { display: grid; gap: 14px; }
                .auth-feature-card {
                    display: flex;
                    gap: 14px;
                    padding: 16px;
                    border-radius: 20px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.06);
                    backdrop-filter: blur(16px);
                }
                .auth-feature-card span { font-size: 24px; }
                .auth-feature-card strong { display: block; font-size: 14px; }
                .auth-feature-card p { margin: 2px 0 0; font-size: 12px; color: rgba(255,255,255,0.5); }

                .auth-right { display: flex; flex-direction: column; align-items: center; }

                .login-meta { display: flex; justify-content: flex-end; margin-top: 12px; }
                .link-btn { background: none; border: none; color: rgba(255,255,255,0.6); font-weight: 700; font-size: 12px; cursor: pointer; }
                .social-block { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
                .social-title { text-align: center; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.4); }
                .social-row { display: flex; gap: 10px; justify-content: center; }
                .social-btn {
                    width: 44px;
                    height: 44px;
                    border-radius: 14px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.06);
                    color: #fff;
                    font-size: 18px;
                    cursor: pointer;
                }

                .reg-code-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 11px; color: rgba(255,255,255,0.5); }
                .reg-code-btn { background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #c4b5fd; font-weight: 700; font-size: 11px; padding: 6px 12px; border-radius: 999px; cursor: pointer; }
                .reg-captcha { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); }
                .reg-captcha input { accent-color: #8b5cf6; width: 16px; height: 16px; }
                .reg-captcha em { margin-left: auto; font-style: normal; color: rgba(255,255,255,0.35); font-weight: 800; font-size: 10px; }
                .reg-captcha.active { border-color: rgba(139,92,246,0.5); color: #c4b5fd; }

                @media (max-width: 900px) {
                    .auth-shell { grid-template-columns: 1fr; }
                    .auth-left { order: 2; text-align: center; }
                }

                .p-input-container { background: rgba(0,0,0,0.2); border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; transition: border-color 0.3s; }
                .p-input-container:focus-within { border-color: rgba(139,92,246,0.5); }
                .p-input { width: 100%; background: none; border: none; padding: 16px 20px; color: #fff; outline: none; font-size: 15px; font-weight: 500; font-family: inherit; }
                .p-input::placeholder { color: rgba(255,255,255,0.2); }
                
                .p-btn-glow {
                    width: 100%; height: 56px; border-radius: 18px; border: none; background: linear-gradient(135deg, #8b5cf6, #ec4899);
                    color: #fff; font-weight: 800; font-size: 16px; cursor: pointer; transition: 0.3s;
                    box-shadow: 0 8px 16px rgba(139, 92, 246, 0.3); font-family: inherit;
                }
                .p-btn-glow:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(139, 92, 246, 0.4); }
                .p-btn-glow:active { transform: scale(0.98); }
                .p-btn-glow:disabled { opacity: 0.5; transform: none; filter: grayscale(1); cursor: not-allowed; }

                .p-btn-text { width: 100%; background: none; border: none; color: rgba(255,255,255,0.3); margin-top: 12px; font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; }

                .p-loader { width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: auto; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); } 20%, 40%, 60%, 80% { transform: translateX(4px); } }
                .shake-anim { animation: shake 0.5s ease; }

                .reg-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
                .reg-progress-track { flex: 1; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
                .reg-progress-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6, #ec4899); border-radius: 999px; box-shadow: 0 0 12px rgba(139,92,246,0.6); animation: regShimmer 2s linear infinite; background-size: 200% 100%; }
                .reg-progress-label { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.5); }

                .reg-step { display: flex; flex-direction: column; gap: 22px; animation: regStepIn 0.5s ease; }
                .reg-hero { text-align: center; }
                .reg-hero-icon { font-size: 42px; margin-bottom: 6px; animation: regFloat 3s ease-in-out infinite; }
                .reg-title { font-size: 24px; font-weight: 900; color: #fff; margin: 0 0 6px; }
                .reg-sub { color: rgba(255,255,255,0.45); font-size: 13px; margin: 0; }
                .reg-form { display: flex; flex-direction: column; gap: 12px; }
                .reg-action { display: flex; flex-direction: column; gap: 10px; }
                .reg-primary-btn { height: 56px; border-radius: 18px; border: none; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; font-weight: 800; font-size: 16px; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 20px rgba(139, 92, 246, 0.35); }
                .reg-primary-btn:active { transform: scale(0.98); }
                .reg-secondary-btn { height: 48px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.5); font-weight: 700; font-size: 13px; cursor: pointer; }
                .reg-link { font-size: 13px; color: rgba(255,255,255,0.5); text-align: center; }
                .reg-link span { color: #a78bfa; font-weight: 700; cursor: pointer; }
                .reg-hint { font-size: 11px; color: rgba(255,255,255,0.25); }
                .reg-counter { text-align: right; font-size: 10px; color: rgba(255,255,255,0.2); }
                .reg-strength { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
                .reg-strength-bars { display: flex; gap: 4px; }
                .reg-strength-bar { flex: 1; height: 4px; border-radius: 999px; transition: 0.3s; }
                .reg-strength-text { font-size: 11px; font-weight: 700; }
                .reg-suggest { padding: 12px; border-radius: 16px; background: rgba(139, 92, 246, 0.12); border: 1px dashed rgba(139, 92, 246, 0.3); text-align: center; }
                .reg-suggest-btn { background: none; color: #a78bfa; border: none; font-weight: 700; font-size: 13px; cursor: pointer; }
                .reg-suggest-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: #fff; }
                .reg-suggest-row button { background: #8b5cf6; color: #fff; border: none; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
                .reg-hobbies { display: flex; flex-wrap: wrap; gap: 10px; }
                .reg-hobby { padding: 10px 18px; border-radius: 100px; font-size: 13px; cursor: pointer; transition: 0.2s; font-weight: 600; }
                .reg-hobby.active { transform: scale(1.05); }
                .reg-photo { text-align: center; }
                .reg-photo-box { width: 160px; height: 160px; border-radius: 40px; margin: 0 auto; border: 2px dashed rgba(139, 92, 246, 0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; position: relative; overflow: hidden; color: #8b5cf6; font-weight: 900; font-size: 12px; gap: 6px; }
                .reg-photo-box img { width: 100%; height: 100%; object-fit: cover; }
                .reg-photo-box.error { border-color: #ef4444; color: #ef4444; }
                .reg-photo-box span { font-size: 48px; }
                .reg-photo-box em { font-style: normal; }

                @keyframes regFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes regStepIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes regShimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }

                @media (prefers-reduced-motion: reduce) {
                    .reg-hero-icon,
                    .reg-step,
                    .reg-progress-fill {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
