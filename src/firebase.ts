import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

/**
 * =========================================================================
 *  LOVEMATCH - FIREBASE YAPILANDIRMASI
 *  UYARI: appId Firebase Console > Proje Ayarları > Genel > Uygulamalarınız
 *  bölümünden alınmalıdır. Şu an ortam değişkeninden okunuyor.
 *  Firebase Console: https://console.firebase.google.com/project/lovematch-67f1d
 * =========================================================================
 */
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBn7oZw5y-HtFdsJmD9Zju-1ClDcXu9l2c",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "lovematch-67f1d.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "lovematch-67f1d",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "lovematch-67f1d.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "555856494313",
    // ÖNEMLİ: Bu değeri Firebase Console'dan al!
    // Console > Proje Genel Bakış > Web uygulaması (</>) > appId
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:555856494313:web:dd4a7b3fb1a3b2c5lovematch",
};

// Zaten başlatılmışsa tekrar başlatma (HMR uyumluluğu)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firestore, Auth ve Storage başlat
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
