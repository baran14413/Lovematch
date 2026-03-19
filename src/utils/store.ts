import { pb } from '../pb';

// Global types for cordova-plugin-purchase (Cordova/Capacitor)
declare const CdvPurchase: any;

/**
 * =========================================================================
 *  LOVEMATCH - HYBRID STORE SERVICE (V2)
 *  Supports: Google Play (Cordova) & Mock Mode (Web/Browser)
 * =========================================================================
 */
export const StoreService = {
    store: null as any,
    isInitialized: false,
    status: "Hazır Değil",
    lastLogs: [] as string[],
    mode: "mock" as "native" | "mock",

    log(msg: string) {
        console.log(`[StoreV2] ${msg}`);
        this.lastLogs.push(`${new Date().toLocaleTimeString()}: ${msg}`);
        if (this.lastLogs.length > 25) this.lastLogs.shift();
    },

    async init(force = false) {
        if (this.isInitialized && !force) return;

        // Native Check
        if (typeof CdvPurchase === 'undefined') {
            this.mode = "mock";
            this.status = "Web Test Modu (Mock)";
            this.log("CdvPurchase bulunamadı. Web Test Moduna geçildi.");
            this.isInitialized = true;
            return;
        }

        try {
            this.mode = "native";
            const { store, ProductType, Platform, LogLevel } = CdvPurchase;
            this.store = store;

            store.verbosity = LogLevel.DEBUG;
            this.log("Native Store Bağlanıyor...");

            // Ürün Tanımlama
            store.register([
                {
                    id: 'vip_01',
                    type: ProductType.PAID_SUBSCRIPTION,
                    platform: Platform.GOOGLE_PLAY,
                }
            ]);

            // İşlem Yönetimi
            store.when()
                .approved((transaction: any) => {
                    this.log(`Onay Geldi: ${transaction.productId}`);
                    this.verifyAndDeliver(transaction);
                })
                .finished((transaction: any) => {
                    this.log(`İşlem Kapandı: ${transaction.productId}`);
                })
                .owned((p: any) => {
                    this.log(`Sahiplik Algılandı: ${p.id}`);
                });

            store.error((error: any) => {
                this.log(`MAĞAZA HATASI: ${error.message} (${error.code})`);
                this.status = "Hata: " + error.code;
            });

            await store.initialize([Platform.GOOGLE_PLAY]);
            this.isInitialized = true;
            this.status = "Aktif (Google Play)";
            this.log("Store Hazır.");

            await store.update();

            // Mevcut satın alımları kontrol et (uygulama açılışında)
            await this.checkExistingPurchases();
        } catch (e: any) {
            this.status = "Başlatma Hatası";
            this.log(`Hata: ${e.message}`);
        }
    },

    // Mevcut satın alımları kontrol et (uygulama açılışında VIP durumunu doğrula)
    async checkExistingPurchases() {
        if (this.mode === 'mock') return;
        if (!this.store) return;

        try {
            const product = this.store.get('vip_01');
            if (product && product.owned) {
                this.log('✅ Mevcut VIP aboneliği tespit edildi!');
                const user = pb.authStore.model;
                if (user && !user.isVIP) {
                    // VIP değilse ama satın alma varsa, VIP yap
                    const until = new Date();
                    until.setDate(until.getDate() + 30);
                    await pb.collection('users').update(user.id, {
                        isVIP: true,
                        vipUntil: until.toISOString(),
                        premiumType: 'gold_vip'
                    });
                    this.log('VIP durumu Play Store\'dan senkronize edildi!');
                }
            } else {
                // Ürün sahiplenilmemiş — VIP süresi dolmuşsa kaldır
                const user = pb.authStore.model;
                if (user?.isVIP && user?.vipUntil) {
                    const vipEnd = new Date(user.vipUntil);
                    if (vipEnd < new Date()) {
                        this.log('⚠️ VIP süresi dolmuş, kaldırılıyor...');
                        await pb.collection('users').update(user.id, {
                            isVIP: false,
                            premiumType: ''
                        });
                    }
                }
            }
        } catch (e: any) {
            this.log(`Mevcut satın alma kontrol hatası: ${e.message}`);
        }
    },

    // Bekleyen satın almaları geri yükle
    async restorePurchases(): Promise<boolean> {
        if (this.mode === 'mock') {
            this.log('Mock modda restore işlemi simule edildi.');
            return true;
        }
        if (!this.store) {
            this.log('Store hazır değil, restore yapılamıyor.');
            return false;
        }
        try {
            this.log('Satın almalar geri yükleniyor...');
            await this.store.update();
            await this.checkExistingPurchases();
            this.log('Geri yükleme tamamlandı!');
            return true;
        } catch (e: any) {
            this.log(`Geri yükleme hatası: ${e.message}`);
            return false;
        }
    },

    async getProduct(productId: string) {
        if (!this.isInitialized) await this.init();
        if (this.mode === 'mock') {
            return { id: productId, price: '29,99 ₺', title: 'Aylık VIP (Test)', description: 'Web test amaçlı simülasyon ürünüdür.' };
        }
        return this.store?.get(productId);
    },

    async purchase(productId: string): Promise<boolean> {
        this.log(`Satın alım başlatıldı: ${productId}`);

        if (this.mode === 'mock') {
            this.log("MOCK PURCHASE: 2 saniye sonra başarılı sayılacak...");
            await new Promise(r => setTimeout(r, 2000));
            await this.deliverMockVIP();
            return true;
        }

        if (!this.store) return false;

        try {
            const product = this.store.get(productId);
            if (!product) {
                this.log(`Hata: Ürün (${productId}) markette bulunamadı.`);
                return false;
            }

            // Ödemeyi Başlat
            this.log(`Ödeme arayüzü açılıyor: ${productId}`);
            const offer = product.getOffer();
            if (offer) {
                await offer.order();
                return true;
            }

            await product.order();
            return true;
        } catch (e: any) {
            this.log(`Ödeme Hatası: ${e.message}`);
            return false;
        }
    },

    async verifyAndDeliver(transaction: any) {
        this.log(`Doğrulama Yapılıyor: ${transaction.productId}`);
        try {
            const user = pb.authStore.model;
            if (!user) return;

            // VIP Süresi: 30 gün
            const until = new Date();
            until.setDate(until.getDate() + 30);

            await pb.collection('users').update(user.id, {
                isVIP: true,
                vipUntil: until.toISOString(),
                premiumType: 'gold_vip'
            });

            transaction.finish();
            this.log("VIP Başarıyla Tanımlandı! ✨");
            window.location.reload(); // Değişikliklerin yansıması için
        } catch (e) {
            this.log("Kayıt Hatası: Veritabanına ulaşılamadı.");
        }
    },

    async deliverMockVIP() {
        const user = pb.authStore.model;
        if (!user) return;
        const until = new Date();
        until.setDate(until.getDate() + 30);

        try {
            await pb.collection('users').update(user.id, {
                isVIP: true,
                vipUntil: until.toISOString(),
                premiumType: 'test_vip'
            });
            this.log("MOCK VIP Tanımlandı! (30 Gün)");
            setTimeout(() => window.location.reload(), 500);
        } catch (e) {
            this.log("Mock Teslimat Hatası");
        }
    }
};
