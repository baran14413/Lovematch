import { useState } from 'react';

/**
 * =====================================================================
 *  LOVEMATCH REBORN - PREMİUM YARDIM & DESTEK MERKEZİ
 * =====================================================================
 */

const FAQ_DATA = [
    {
        category: '🎉 Parti Odaları',
        icon: 'fa-solid fa-cake-candles',
        color: '#8b5cf6',
        questions: [
            {
                q: 'Parti Odası nedir?',
                a: 'Parti Odası, diğer kullanıcılarla sesli ve görüntülü olarak canlı sohbet edebildiğiniz özel bir alan. Oda kurabilir, başkalarının odasına katılabilir, sohbet edip eğlenebilirsiniz.'
            },
            {
                q: 'Nasıl oda kurulur?',
                a: 'Lobi ekranındaki "Oda Kur" butonuna tıklayın. Oda adı girin ve 8 koltuklu odanızı oluşturun. Yeni kurulan her oda otomatik olarak ⚡ LV1 (Standart) seviyesinde başlar.'
            },
            {
                q: 'Oda kapasitesi nedir?',
                a: 'Her odanın iki tür kapasitesi vardır:\n\n• Katılımcı Kapasitesi: Odaya girip izleyebilecek toplam kişi sayısı (boost seviyesine göre değişir)\n• Ses Koltuğu: Sese bağlanarak konuşabilecek kişi sayısı (LV1: 8, LV2: 12, LV3: 16)'
            },
        ]
    },
    {
        category: '⚡ Oda Boost & Seviye',
        icon: 'fa-solid fa-bolt-lightning',
        color: '#3b82f6',
        questions: [
            {
                q: 'Boost Sistemi nedir?',
                a: 'Boost, odanızın seviyesini belirleyen otomatik bir sistemdir. Odanızı kaç kişi takip ettiğine göre 3 farklı seviyede ilerlenir. Seviye yükseldikçe daha fazla katılımcı kabul edebilir ve daha fazla koltuk açabilirsiniz.'
            },
            {
                q: 'Boost seviyeleri ve limitleri nelerdir?',
                a: `Oda seviyeleri takipçi sayısına göre otomatik güncellenir:\n\n⚡ LV1 - Standart (0-19 takipçi)\n• Maks 25 katılımcı\n• Maks 8 ses koltuğu\n\n🔥 LV2 - Gelişmiş (20-99 takipçi)\n• Maks 55 katılımcı\n• Maks 12 ses koltuğu\n\n💥 LV3 - Premium (100+ takipçi)\n• Sınırsız katılımcı\n• Maks 16 ses koltuğu`
            },
            {
                q: 'Boost nasıl yükseltilir?',
                a: 'Boost sadece takipçi kazanarak yükselir. Odanızı takip eden kişi sayısı eşiği geçtiğinde seviyeniz otomatik artar:\n• 20 takipçi → LV2\n• 100 takipçi → LV3'
            },
        ]
    },
    {
        category: '🔔 Takip & Sosyal',
        icon: 'fa-solid fa-heart',
        color: '#ec4899',
        questions: [
            {
                q: 'Oda takip etmek ne işe yarar?',
                a: 'Bir odayı takip etmeniz o odanın boost seviyesine katkıda bulunur. Takipçisi çok olan odalar daha üst seviyelere çıkar ve lobi listesinde daha üst sıralarda görünür.'
            },
            {
                q: 'Odamı kimler takip ediyor?',
                a: 'Oda içindeyken sağ üstteki menüden (⋮) "Takipçiler" seçeneğine tıklayarak tüm takipçi listenizi isim ve tarih bazlı görebilirsiniz.'
            },
        ]
    },
    {
        category: '⚙️ Yönetim & Moderasyon',
        icon: 'fa-solid fa-shield-halved',
        color: '#10b981',
        questions: [
            {
                q: 'Koltuklar kilitlenebilir mi?',
                a: 'Evet, oda sahibi veya adminler boş koltuklara tıklayarak "Koltuk Kilitle" diyebilir. Kilitli koltuklara kimse oturamaz.'
            },
            {
                q: 'Birini odadan nasıl atarım?',
                a: 'Kullanıcının profiline tıklayın. Açılan panelde "Odadan At" veya "Engelle" seçeneklerini göreceksiniz. Engellenen kullanıcı o odaya bir daha giremez.'
            },
        ]
    },
    {
        category: '⌨️ Komut Sistemi v1',
        icon: 'fa-solid fa-terminal',
        color: '#f43f5e',
        questions: [
            {
                q: '/clear komutu ne işe yarar?',
                a: 'Oda sahibi ve moderatörler tarafından sohbet ekranına "/clear" yazılarak kullanılır. Odadaki tüm geçmiş mesajları anında temizler ve sistemi rahatlatır. Sadece yetkililer tarafından kullanılabilir.'
            }
        ]
    }
];

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={`faq-v9-item ${open ? 'active' : ''}`} onClick={() => setOpen(!open)}>
            <div className="faq-v9-q">
                <span>{q}</span>
                <div className="faq-v9-icon">
                    <i className={`fa-solid fa-chevron-down`}></i>
                </div>
            </div>
            <div className="faq-v9-a">
                <div className="faq-v9-a-inner">
                    {a.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function HelpPage() {
    const [activeTab, setActiveTab] = useState(0);
    const [search, setSearch] = useState('');

    const filteredData = FAQ_DATA.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
            q.q.toLowerCase().includes(search.toLowerCase()) ||
            q.a.toLowerCase().includes(search.toLowerCase())
        )
    })).filter(cat => cat.questions.length > 0);

    return (
        <div className="help-v9-container">
            <div className="help-v9-header">
                <div className="help-v9-glow" />
                <h1 className="help-v9-title">Yardım Merkezi</h1>
                <p className="help-v9-subtitle">Size nasıl yardımcı olabiliriz?</p>

                <div className="help-v9-search">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input
                        type="text"
                        placeholder="Sorun, özelliğini ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="help-v9-content">
                {!search && (
                    <div className="help-v9-tabs">
                        {FAQ_DATA.map((cat, i) => (
                            <button
                                key={i}
                                className={`help-v9-tab ${activeTab === i ? 'active' : ''}`}
                                onClick={() => setActiveTab(i)}
                                style={{ '--tab-color': cat.color } as any}
                            >
                                <i className={cat.icon}></i>
                                <span>{cat.category.split(' ')[1]}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="help-v9-list">
                    {search ? (
                        filteredData.map((cat, ci) => (
                            <div key={ci} className="help-v9-cat-section">
                                <div className="help-v9-cat-title" style={{ color: cat.color }}>
                                    <i className={cat.icon}></i> {cat.category}
                                </div>
                                {cat.questions.map((q, qi) => (
                                    <FaqItem key={`${ci}-${qi}`} q={q.q} a={q.a} />
                                ))}
                            </div>
                        ))
                    ) : (
                        <div className="help-v9-cat-section">
                            <div className="help-v9-cat-title" style={{ color: FAQ_DATA[activeTab].color }}>
                                <i className={FAQ_DATA[activeTab].icon}></i> {FAQ_DATA[activeTab].category}
                            </div>
                            {FAQ_DATA[activeTab].questions.map((q, i) => (
                                <FaqItem key={i} q={q.q} a={q.a} />
                            ))}
                        </div>
                    )}

                    {(search && filteredData.length === 0) && (
                        <div className="help-v9-empty">
                            <i className="fa-solid fa-face-frown"></i>
                            <p>Sonuç bulunamadı...</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="help-v9-footer">
                <div className="help-v9-support-card">
                    <div className="hsc-icon"><i className="fa-solid fa-headset"></i></div>
                    <div className="hsc-info">
                        <h3>Daha fazla yardıma mı ihtiyacınız var?</h3>
                        <p>Destek ekibimiz 7/24 yanınızda.</p>
                    </div>
                    <a href="mailto:destek@lovematch.app" className="hsc-btn">Destekle İletişime Geç</a>
                </div>
            </div>

            <style>{`
                .help-v9-container {
                    height: 100vh;
                    overflow-y: auto;
                    background: #000;
                    color: #fff;
                    font-family: 'Inter', sans-serif;
                    padding-bottom: 100px;
                }
                .help-v9-container::-webkit-scrollbar { display: none; }
                .help-v9-container { -ms-overflow-style: none; scrollbar-width: none; }
                .help-v9-header {
                    padding: 80px 24px 40px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    background: linear-gradient(to bottom, #0f0c29, #000);
                }
                .help-v9-glow {
                    position: absolute;
                    top: -50px; left: 50%;
                    transform: translateX(-50%);
                    width: 300px; height: 300px;
                    background: rgba(139, 92, 246, 0.2);
                    filter: blur(80px);
                    border-radius: 50%;
                    z-index: 0;
                }
                .help-v9-title {
                    font-size: 32px; font-weight: 950; margin-bottom: 8px;
                    position: relative; z-index: 1;
                    background: linear-gradient(to right, #fff, #a78bfa);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .help-v9-subtitle {
                    color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 600;
                    margin-bottom: 30px; position: relative; z-index: 1;
                }
                .help-v9-search {
                    max-width: 400px; margin: 0 auto;
                    position: relative; z-index: 1;
                }
                .help-v9-search i {
                    position: absolute; left: 16px; top: 50%;
                    transform: translateY(-50%); color: #666;
                }
                .help-v9-search input {
                    width: 100%; background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 14px 14px 14px 44px; border-radius: 18px;
                    color: #fff; outline: none; transition: 0.3s;
                    font-weight: 600;
                }
                .help-v9-search input:focus {
                    background: rgba(255,255,255,0.1);
                    border-color: #8b5cf6;
                    box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
                }

                .help-v9-content { padding: 0 16px; max-width: 600px; margin: 0 auto; }
                
                .help-v9-tabs {
                    display: grid; grid-template-columns: repeat(4, 1fr);
                    gap: 10px; margin-bottom: 30px;
                }
                .help-v9-tab {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 15px 5px; border-radius: 20px;
                    color: rgba(255,255,255,0.5); cursor: pointer;
                    display: flex; flex-direction: column; align-items: center; gap: 8px;
                    transition: 0.3s;
                }
                .help-v9-tab i { font-size: 20px; }
                .help-v9-tab span { font-size: 10px; font-weight: 800; text-transform: uppercase; }
                .help-v9-tab.active {
                    background: rgba(255,255,255,0.08);
                    border-color: var(--tab-color);
                    color: #fff;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
                }

                .help-v9-cat-title {
                    font-size: 16px; font-weight: 900; margin-bottom: 15px;
                    display: flex; align-items: center; gap: 10px;
                }

                .faq-v9-item {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 18px; margin-bottom: 12px;
                    overflow: hidden; cursor: pointer; transition: 0.3s;
                }
                .faq-v9-item:hover { background: rgba(255,255,255,0.04); }
                .faq-v9-item.active { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
                
                .faq-v9-q {
                    padding: 18px 20px; display: flex; align-items: center; justify-content: space-between;
                }
                .faq-v9-q span { font-size: 14px; font-weight: 700; color: #ddd; }
                .faq-v9-icon {
                    width: 24px; height: 24px; border-radius: 50%;
                    background: rgba(255,255,255,0.05);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 10px; color: #666; transition: 0.3s;
                }
                .faq-v9-item.active .faq-v9-icon { transform: rotate(180deg); background: #8b5cf6; color: #fff; }
                
                .faq-v9-a {
                    max-height: 0; overflow: hidden; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .faq-v9-item.active .faq-v9-a { max-height: 500px; }
                .faq-v9-a-inner {
                    padding: 0 20px 20px; color: rgba(255,255,255,0.5);
                    font-size: 13px; line-height: 1.6; font-weight: 500;
                }

                .help-v9-empty { text-align: center; padding: 40px 0; color: #444; }
                .help-v9-empty i { font-size: 40px; margin-bottom: 10px; }

                .help-v9-footer { padding: 40px 16px; max-width: 600px; margin: 0 auto; }
                .help-v9-support-card {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1));
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 24px; padding: 24px;
                    display: flex; flex-direction: column; align-items: center; text-align: center;
                }
                .hsc-icon {
                    width: 50px; height: 50px; background: #8b5cf6;
                    border-radius: 15px; display: flex; align-items: center;
                    justify-content: center; font-size: 20px; margin-bottom: 16px;
                    box-shadow: 0 10px 20px rgba(139, 92, 246, 0.3);
                }
                .hsc-info h3 { font-size: 16px; font-weight: 900; margin-bottom: 6px; }
                .hsc-info p { font-size: 13px; color: rgba(255,255,255,0.5); font-weight: 600; margin-bottom: 20px; }
                .hsc-btn {
                    background: #fff; color: #000; padding: 12px 24px;
                    border-radius: 12px; font-size: 13px; font-weight: 900;
                    text-decoration: none; transition: 0.3s;
                }
                .hsc-btn:hover { background: #a78bfa; color: #fff; transform: translateY(-2px); }
            `}</style>
        </div>
    );
}
