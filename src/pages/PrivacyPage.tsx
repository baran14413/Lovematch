export default function PrivacyPolicy() {
    return (
        <div style={{
            padding: '80px 24px 100px',
            background: 'var(--bg-deep)',
            minHeight: '100%',
            color: '#fff',
            fontSize: '14px',
            lineHeight: '1.8',
            overflowY: 'auto'
        }}>
            <header style={{ textAlign: 'center', marginBottom: 50, animation: 'lm-slide-down 0.6s ease' }}>
                <div style={{ fontSize: 50, background: 'var(--premium-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 15 }}>
                    <i className="fa-solid fa-shield-halved"></i>
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 950, marginBottom: 10, background: 'var(--premium-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Güvenlik ve Gizlilik</h1>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>LoveMatch Topluluk Sözleşmesi ✨</p>
                <div style={{ height: 4, width: 40, background: 'var(--premium-gradient)', borderRadius: 10, margin: '15px auto' }}></div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                    {
                        id: '01',
                        title: 'Giriş',
                        body: 'LoveMatch uygulamasına hoş geldiniz. Bu uygulama, kullanıcıların yeni insanlarla güvenli ve eğlenceli bir ortamda tanışmasını sağlamak amacıyla tasarlanmıştır.',
                        icon: '👋'
                    },
                    {
                        id: '02',
                        title: 'Veri Güvenliği',
                        body: 'LoveMatch, kullanıcı deneyimini iyileştirmek için kullanıcı adı, yaş, cinsiyet ve uygulama içi etkileşimlerinizi PocketBase altyapısı kullanarak uçtan uca şifreli olarak saklar.',
                        icon: '🔒'
                    },
                    {
                        id: '03',
                        title: 'Topluluk Kuralları',
                        body: 'Taciz, hakaret, nefret söylemi ve yasa dışı içerik paylaşımı kesinlikle yasaktır. Bu tür davranışlarda bulunan hesaplar yapay zeka denetimi ile anında uzaklaştırılır.',
                        icon: '🛡️'
                    },
                    {
                        id: '04',
                        title: 'WebRTC Teknolojisi',
                        body: '1v1 ve Parti odalarında kullanılan sesli veri iletimi P2P (Peer-to-Peer) teknolojisi ile doğrudan kullanıcılar arasında aktarılır ve sunucularımızda asla kayıt edilmez.',
                        icon: '🎙️'
                    },
                    {
                        id: '05',
                        title: 'İletişim',
                        body: 'Gizlilik politikası veya teknik destek için uygulama içi raporlama sistemini kullanabilir veya doğrudan yönetim panelinden bize ulaşabilirsiniz.',
                        icon: '✉️'
                    }
                ].map((section, idx) => (
                    <section
                        key={section.id}
                        className="lm-premium-card"
                        style={{
                            padding: 24,
                            animation: `lm-slide-up 0.6s ease ${idx * 0.1}s backwards`,
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--premium-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: 'var(--shadow-premium)' }}>
                                {section.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 10, color: 'var(--purple-light)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5 }}>Madde {section.id}</div>
                                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{section.title}</h2>
                            </div>
                        </div>
                        <p style={{ color: 'var(--text-dim)', margin: 0, fontWeight: 600 }}>{section.body}</p>
                    </section>
                ))}
            </div>

            <button
                onClick={() => window.history.back()}
                className="lm-primary-button"
                style={{
                    width: '100%',
                    marginTop: 40,
                    height: 56,
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10
                }}
            >
                <i className="fa-solid fa-check-double"></i>
                Anladım, Devam Et
            </button>

            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 30, fontWeight: 700 }}>
                lovemtch.shop © 2026 - Tüm Hakları Saklıdır.
            </p>
        </div>
    );
}
