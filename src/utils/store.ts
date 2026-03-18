import { pb } from '../pb';
import { tGlobal } from './languages';

// Global types for cordova-plugin-purchase
declare const CdvPurchase: any;

export const StoreService = {
    store: null as any,
    isInitialized: false,
    status: "Hazır Değil",
    lastLogs: [] as string[],

    log(msg: string) {
        console.log(`[StoreService] ${msg}`);
        this.lastLogs.push(`${new Date().toLocaleTimeString()}: ${msg}`);
        if (this.lastLogs.length > 25) this.lastLogs.shift();
    },

    async init(force = false) {
        if (this.isInitialized && !force) return;

        if (typeof CdvPurchase === 'undefined') {
            this.status = tGlobal('store_web_mode');
            return;
        }

        const { store, ProductType, Platform, LogLevel } = CdvPurchase;
        this.store = store;

        // En detaylı log seviyesi
        store.verbosity = LogLevel.DEBUG;

        this.log("İlklendirme... Paket: com.lovmatch.app");
        this.status = "Bağlanıyor...";

        // Google Play'de 'vip_01' ID'si tek bir tip olabilir. 
        // Eğer her iki tipi de register edersek çakışma olabilir.
        // Bu yüzden ikisini de tanımlıyoruz ama Google hangisini dönerse onu kullanacağız.
        store.register([
            {
                id: 'vip_01',
                type: ProductType.PAID_SUBSCRIPTION,
                platform: Platform.GOOGLE_PLAY,
            }
        ]);

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
                this.verifyAndDeliver(p.transaction);
            })
            .updated((p: any) => {
                this.log(`Ürün Güncellendi: ${p.id} -> ${p.state}`);
            })
            .invalid((p: any) => {
                this.log(`GEÇERSİZ ÜRÜN: ${p.id}. Play Console ayarlarını kontrol edin.`);
            });

        store.error((error: any) => {
            this.log(`KRİTİK HATA: ${error.message} (${error.code})`);
            if (error.code === CdvPurchase.ErrorCode.SETUP) {
                this.status = "Google Play Bağlantı Hatası";
            }
        });

        try {
            await store.initialize([Platform.GOOGLE_PLAY]);
            this.isInitialized = true;
            this.status = "Bağlandı (Google Play)";
            this.log("Store Initialize edildi.");

            // Ürünleri Google'dan çekmek için zorla güncelle
            await store.update();
            this.log(`Marketten çekilen ürün sayısı: ${store.products.length}`);
        } catch (e: any) {
            this.status = "Başlatma Hatası";
            this.log(`Hata: ${e.message}`);
        }
    },

    async getProduct(productId: string) {
        if (!this.store) return null;
        return this.store.get(productId);
    },

    async verifyAndDeliver(transaction: any) {
        try {
            const userId = pb.authStore.model?.id;
            if (!userId) {
                this.log("Hata: Kullanıcı oturumu bulunamadı.");
                return;
            }

            const rawId = transaction?.productId || (transaction?.products && transaction.products[0]?.id) || 'vip_01';

            if (rawId.includes('vip_01')) {
                const user = await pb.collection('users').getOne(userId);

                await pb.collection('users').update(userId, {
                    'isVIP': true,
                    'vipUntil': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    'premiumBadge': true,
                    'bubbleStyle': user.bubbleStyle || 'gold'
                });

                this.log("VIP ve Rozet başarıyla tanımlandı!");
                if (transaction && transaction.finish) transaction.finish();
            }
        } catch (e: any) {
            this.log(`Teslimat Hatası: ${e.message}`);
        }
    },

    async purchase(productId: string) {
        if (!this.store) {
            if (confirm(`Web Test: Buy ${productId}?`)) {
                const userId = pb.authStore.model?.id;
                if (userId) {
                    await pb.collection('users').update(userId, {
                        'isVIP': true,
                        'vipUntil': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        'premiumBadge': true
                    });
                    return true;
                }
            }
            return false;
        }

        this.log(`Satın alma isteği: ${productId}`);

        // Satın almadan önce listeyi bir kez daha yenile
        await this.store.update();

        // State'i 'invalid' olmayan ürünü bul
        const product = this.store.products.find((p: any) => p.id === productId && p.state !== 'invalid');

        if (!product) {
            const allItems = this.store.products.map((p: any) => `${p.id}(${p.state})`).join(', ') || 'Mağaza Tamamen Boş';

            let advice = "Sorun Kaynağı Analizi:\n";
            if (allItems === 'Mağaza Tamamen Boş') {
                advice += "1- Bu APK Google Play tarafından tanınmıyor (İmza Hatası).\n2- Cihazda bir Google hesabı açık değil.\n3- Paket adı (com.lovmatch.app) Console ile uyuşmuyor.";
            } else {
                advice += `ID '${productId}' Play Console'da 'Etkin' değil veya 'Uygulama İçi Ürünler' kısmında tanımlanmamış.`;
            }

            alert(`${tGlobal('error')}: ${tGlobal('product_not_found')}!\n\n${advice}\n\n${tGlobal('system_logs')}:\n${this.lastLogs.join('\n')}`);
            return false;
        }

        if (product.canPurchase) {
            this.log(`Ödeme Başlatılıyor: ${product.id}`);
            product.getOffer().order();
            return true;
        } else if (product.owned) {
            alert(tGlobal('product_already_owned'));
            this.verifyAndDeliver(product.transaction);
            return true;
        } else {
            alert(`${tGlobal('cannot_purchase_status')} ${product.state}. ${tGlobal('check_logs')}`);
            return false;
        }
    }
};
