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
import { auth, db } from "./firebase";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    User
} from "firebase/auth";

/**
 * =========================================================================
 *  LOVEMATCH CLONE - FIREBASE ADAPTER (MOCKING POCKETBASE)
 *  Bu dosya, PocketBase kodlarını değiştirmeden Firestore'u kullanmamızı sağlar.
 * =========================================================================
 */

class CollectionAdapter {
    name: string;
    constructor(name: string) {
        this.name = name;
    }

    async authWithPassword(email: string, pass: string) {
        if (this.name !== 'users') throw new Error("Only users collection supports auth");
        const res = await signInWithEmailAndPassword(auth, email, pass);
        return res;
    }

    async getOne(id: string) {
        if (!id) throw new Error("ID required");
        const docRef = doc(db, this.name, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw { status: 404, message: "Not found" };
        return { id: docSnap.id, ...docSnap.data() };
    }

    async getList(page = 1, perPage = 50, options: any = {}) {
        let q = query(collection(db, this.name));

        if (options.filter) {
            const match = options.filter.match(/(\w+)\s*=\s*"(.*)"/);
            if (match) {
                q = query(q, where(match[1], "==", match[2]));
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

    async create(data: any) {
        let payload = data;

        // Handle FormData (common in PocketBase usage)
        if (data instanceof FormData) {
            payload = {};
            data.forEach((value: any, key: string) => {
                payload[key] = value;
            });
        }

        if (this.name === 'users' && payload.email && payload.password) {
            const { email, password, username, ...rest } = payload;
            const res = await createUserWithEmailAndPassword(auth, email, password);
            if (username) await updateProfile(res.user, { displayName: username });

            await setDoc(doc(db, "users", res.user.uid), {
                uid: res.user.uid,
                email,
                username,
                ...rest,
                created: serverTimestamp()
            });
            return { id: res.user.uid, ...payload };
        }

        const docRef = await addDoc(collection(db, this.name), {
            ...payload,
            created: serverTimestamp(),
            updated: serverTimestamp()
        });
        return { id: docRef.id, ...payload };
    }

    async update(id: string, data: any) {
        const docRef = doc(db, this.name, id);
        await updateDoc(docRef, {
            ...data,
            updated: serverTimestamp()
        });
        return { id, ...data };
    }

    private unsubscribers: Map<string, () => void> = new Map();

    async subscribe(topic: string, callback: (e: any) => void) {
        // Topic '*' is used in PocketBase for all changes in collection
        if (topic !== '*' && topic !== '') {
            // Handle specific ID subscription if needed, but pro plan usually uses '*'
        }

        const unsub = onSnapshot(collection(db, this.name), (snapshot: any) => {
            snapshot.docChanges().forEach((change: any) => {
                const data = { id: change.doc.id, ...change.doc.data() };
                callback({
                    action: change.type === 'added' ? 'create' : (change.type === 'modified' ? 'update' : 'delete'),
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

class PBAdapter {
    authStore: any;
    // Firebase auth durumunun hazır olup olmadığını takip eder
    isAuthReady: boolean = false;
    // Auth hazır olunca resolve olan promise (siyah ekranı önler)
    authReadyPromise: Promise<void>;
    private resolveAuthReady!: () => void;
    private callbacks: Array<(token: string, model: any) => void> = [];

    constructor() {
        // Auth ready promise'i başlat
        this.authReadyPromise = new Promise(resolve => {
            this.resolveAuthReady = resolve;
        });

        this.authStore = {
            model: null,
            clear: () => {
                // Firebase'den çıkış yap
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
                // fireImmediately ile hemen tetikle
                if (fireImmediately) callback("firebase-token", this.authStore.model);
                return () => {
                    this.callbacks = this.callbacks.filter(c => c !== callback);
                };
            }
        };

        // Firebase auth state değişikliklerini dinle
        onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                try {
                    // Kullanıcı Firestore'dan yükle
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
                        ...userData
                    };
                } catch (e) {
                    // Firestore erişim hatası olsa bile auth modelini kur
                    console.warn('[Firebase] Kullanıcı dokümanı yüklenemedi:', e);
                    this.authStore.model = {
                        id: user.uid,
                        email: user.email,
                        username: user.displayName || user.email?.split('@')[0] || 'Kullanıcı',
                    };
                }
            } else {
                // Oturum açık değil
                this.authStore.model = null;
            }

            // Auth artık hazır - siyah ekran biter!
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

    files = {
        getUrl: (record: any, filename: string) => {
            if (!filename) return '';
            if (filename.startsWith('http')) return filename;
            // Map legacy PB file paths to absolute URLs (vds logic as backup)
            const coll = record.collectionId || record.collectionName || 'users';
            return `https://lovemtch.shop/api/files/${coll}/${record.id}/${filename}`;
        }
    }
}

export const pb = new PBAdapter() as any;
