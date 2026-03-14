import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    addDoc,
    onSnapshot
} from "firebase/firestore";
import { auth, db, storage } from "./firebase";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    User
} from "firebase/auth";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "firebase/storage";

/**
 * =========================================================================
 *  LOVEMATCH CLONE - FIREBASE ADAPTER (MOCKING POCKETBASE)
 *  Bu dosya, PocketBase kodlarını değiştirmeden Firebase kullanmamızı sağlar.
 *  
 *  DÜZELTİLMİŞ:
 *  1. Avatar dosyaları artık Firebase Storage'a yükleniyor
 *  2. getUrl() artık gerçek Firebase Storage URL döndürüyor
 *  3. FormData içindeki File nesneleri Firestore'a yazılmıyor
 *  4. "authentication invalid" hatası giderildi
 * =========================================================================
 */

// -------------------------------------------------------------------
// Yardımcı: Dosyayı Firebase Storage'a yükle, download URL döndür
// -------------------------------------------------------------------
async function uploadFileToStorage(
    path: string,
    file: File
): Promise<string> {
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return url;
}

// -------------------------------------------------------------------
// Yardımcı: FormData'yı düz objeye çevir, dosyaları Storage'a yükle
// -------------------------------------------------------------------
async function formDataToPayload(
    formData: FormData,
    storageFolderPath: string
): Promise<{ payload: Record<string, any>; fileFields: Record<string, string> }> {
    const payload: Record<string, any> = {};
    const fileFields: Record<string, string> = {};

    const uploadPromises: Promise<void>[] = [];

    formData.forEach((value, key) => {
        if (value instanceof File) {
            // Dosya ise Storage'a yükle
            if (value.size > 0) {
                const ext = value.name.split('.').pop() || 'jpg';
                const storageKey = `${storageFolderPath}/${key}_${Date.now()}.${ext}`;
                uploadPromises.push(
                    uploadFileToStorage(storageKey, value).then(url => {
                        fileFields[key] = url;
                        payload[key] = url; // URL olarak Firestore'a yaz
                    })
                );
            }
            // Boş File nesnelerini yoksay (Firestore hata verir)
        } else {
            payload[key] = value;
        }
    });

    await Promise.all(uploadPromises);
    return { payload, fileFields };
}

// -------------------------------------------------------------------
// Koleksiyon adaptörü (PocketBase API'sini taklit eder)
// -------------------------------------------------------------------
class CollectionAdapter {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    // Şifre ile giriş
    async authWithPassword(email: string, pass: string) {
        if (this.name !== 'users') throw new Error("Only users collection supports auth");
        const res = await signInWithEmailAndPassword(auth, email, pass);
        return res;
    }

    // Tek kayıt getir
    async getOne(id: string) {
        if (!id) throw new Error("ID required");
        const docRef = doc(db, this.name, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw { status: 404, message: "Not found" };
        return { id: docSnap.id, ...docSnap.data() };
    }

    // Sayfalı liste
    async getList(page = 1, perPage = 50, options: any = {}) {
        let q = query(collection(db, this.name));

        if (options.filter) {
            // Basit filtre ayrıştırma: field = "value"
            const matchStr = options.filter.match(/(\w+)\s*=\s*"(.*)"/);
            const matchNum = options.filter.match(/(\w+)\s*=\s*(\d+)/);
            if (matchStr) {
                q = query(q, where(matchStr[1], "==", matchStr[2]));
            } else if (matchNum) {
                q = query(q, where(matchNum[1], "==", Number(matchNum[2])));
            }
        }

        if (options.sort) {
            const isDesc = options.sort.startsWith("-");
            const field = isDesc ? options.sort.substring(1) : options.sort;
            q = query(q, orderBy(field, isDesc ? "desc" : "asc"));
        }

        q = query(q, limit(perPage));

        const snap = await getDocs(q);
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

        return {
            items,
            page,
            perPage,
            totalItems: snap.size,
            totalPages: Math.ceil(snap.size / perPage)
        };
    }

    async getFullList(options: any = {}) {
        const res = await this.getList(1, 200, options);
        return res.items;
    }

    async getFirstListItem(filter: string) {
        const res = await this.getList(1, 1, { filter });
        if (res.items.length === 0) throw { status: 404, message: "Not found" };
        return res.items[0];
    }

    // Kayıt oluştur (FormData veya düz obje kabul eder)
    async create(data: any) {
        let payload: Record<string, any> = {};

        if (data instanceof FormData) {
            // FormData → Storage yükle → Firestore'a yaz
            const result = await formDataToPayload(
                data,
                `${this.name}` // örn: "users"
            );
            payload = result.payload;
        } else {
            // Düz obje ama yine de File nesnelerini temizle
            for (const [key, val] of Object.entries(data)) {
                if (val instanceof File) {
                    if (val.size > 0) {
                        const ext = val.name.split('.').pop() || 'bin';
                        const path = `${this.name}/${key}_${Date.now()}.${ext}`;
                        payload[key] = await uploadFileToStorage(path, val);
                    }
                    // Boyutu 0 olan File nesnelerini atla
                } else {
                    payload[key] = val;
                }
            }
        }

        // Kullanıcı kaydı - Firebase Auth + Firestore
        if (this.name === 'users' && payload.email && payload.password) {
            const { email, password, passwordConfirm, ...rest } = payload;
            // passwordConfirm Firestore'a yazılmıyor (sadece doğrulama için)

            const res = await createUserWithEmailAndPassword(auth, email, password);

            // Profil güncelle (displayName)
            if (rest.username) {
                await updateProfile(res.user, { displayName: rest.username });
            }

            // avatar URL varsa photoURL olarak da kaydet
            if (rest.avatar && typeof rest.avatar === 'string') {
                await updateProfile(res.user, { photoURL: rest.avatar });
            }

            // Firestore'a kullanıcı belgesi oluştur
            await setDoc(doc(db, "users", res.user.uid), {
                uid: res.user.uid,
                email,
                username: rest.username || email.split('@')[0],
                ...rest,
                created: serverTimestamp(),
                updated: serverTimestamp()
            });

            return { id: res.user.uid, email, ...rest };
        }

        // Diğer koleksiyonlar
        const docRef = await addDoc(collection(db, this.name), {
            ...payload,
            created: serverTimestamp(),
            updated: serverTimestamp()
        });
        return { id: docRef.id, ...payload };
    }

    // Kayıt güncelle
    async update(id: string, data: any) {
        let payload: Record<string, any> = {};

        if (data instanceof FormData) {
            const result = await formDataToPayload(data, `${this.name}/${id}`);
            payload = result.payload;
        } else {
            for (const [key, val] of Object.entries(data)) {
                if (val instanceof File) {
                    if (val.size > 0) {
                        const ext = val.name.split('.').pop() || 'bin';
                        const path = `${this.name}/${id}/${key}_${Date.now()}.${ext}`;
                        payload[key] = await uploadFileToStorage(path, val);
                    }
                } else {
                    payload[key] = val;
                }
            }
        }

        const docRef = doc(db, this.name, id);
        await updateDoc(docRef, {
            ...payload,
            updated: serverTimestamp()
        });

        // Kullanıcı profili güncelleniyorsa Firebase Auth profilini de güncelle
        if (this.name === 'users' && auth.currentUser?.uid === id) {
            if (payload.username) {
                await updateProfile(auth.currentUser, { displayName: payload.username });
            }
            if (payload.avatar && typeof payload.avatar === 'string') {
                await updateProfile(auth.currentUser, { photoURL: payload.avatar });
            }
        }

        return { id, ...payload };
    }

    // Gerçek zamanlı dinleme
    private unsubscribers: Map<string, () => void> = new Map();

    async subscribe(topic: string, callback: (e: any) => void) {
        const unsub = onSnapshot(collection(db, this.name), (snapshot: any) => {
            snapshot.docChanges().forEach((change: any) => {
                const data = { id: change.doc.id, ...change.doc.data() };
                callback({
                    action: change.type === 'added' ? 'create'
                        : (change.type === 'modified' ? 'update' : 'delete'),
                    record: data
                });
            });
        });

        this.unsubscribers.set(topic, unsub);
        return async () => unsub();
    }

    async unsubscribe(topic: string) {
        const unsub = this.unsubscribers.get(topic);
        if (unsub) {
            unsub();
            this.unsubscribers.delete(topic);
        }
    }

    async delete(id: string) {
        await deleteDoc(doc(db, this.name, id));
    }

    async requestPasswordReset(email: string) {
        await sendPasswordResetEmail(auth, email);
    }
}

// -------------------------------------------------------------------
// PBAdapter - PocketBase istemcisini taklit eden wrapper
// -------------------------------------------------------------------
class PBAdapter {
    authStore: any;
    isAuthReady: boolean = false;
    authReadyPromise: Promise<void>;
    private resolveAuthReady!: () => void;
    private callbacks: Array<(token: string, model: any) => void> = [];

    constructor() {
        // Auth hazır olunca siyah ekranı önle
        this.authReadyPromise = new Promise(resolve => {
            this.resolveAuthReady = resolve;
        });

        this.authStore = {
            model: null,
            clear: () => {
                signOut(auth);
                this.authStore.model = null;
                this.triggerChange();
            },
            save: (_: string, model: any) => {
                this.authStore.model = model;
                this.triggerChange();
            },
            onChange: (callback: (token: string, model: any) => void, fireImmediately = false) => {
                this.callbacks.push(callback);
                if (fireImmediately) callback("firebase-token", this.authStore.model);
                return () => {
                    this.callbacks = this.callbacks.filter(c => c !== callback);
                };
            }
        };

        // Firebase Auth durum değişikliklerini dinle
        onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    const userData = userDoc.exists() ? userDoc.data() : {
                        username: user.displayName || user.email?.split('@')[0] || 'Kullanıcı',
                        coins: 0,
                        level: 1,
                        isVIP: false
                    };
                    this.authStore.model = {
                        id: user.uid,
                        email: user.email,
                        username: user.displayName || userData.username,
                        avatar: user.photoURL || userData.avatar || '',
                        ...userData
                    };
                } catch (e) {
                    console.warn('[Firebase] Kullanıcı dokümanı yüklenemedi:', e);
                    this.authStore.model = {
                        id: user.uid,
                        email: user.email,
                        username: user.displayName || user.email?.split('@')[0] || 'Kullanıcı',
                        avatar: user.photoURL || '',
                    };
                }
            } else {
                this.authStore.model = null;
            }

            // Auth hazır - siyah ekran biter
            if (!this.isAuthReady) {
                this.isAuthReady = true;
                this.resolveAuthReady();
            }

            this.triggerChange();
        });
    }

    private triggerChange() {
        this.callbacks.forEach(cb => cb("firebase-token", this.authStore.model));
    }

    collection(name: string) {
        return new CollectionAdapter(name);
    }

    // Dosya URL'i dön - artık doğrudan Firebase Storage URL
    files = {
        getUrl: (record: any, filename: string): string => {
            if (!filename) return '';
            // Zaten tam URL ise doğrudan döndür
            if (filename.startsWith('http')) return filename;
            // Yoksa placeholder döndür
            return '';
        }
    };
}

export const pb = new PBAdapter() as any;
