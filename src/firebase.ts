import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

/**
 * =========================================================================
 *  LOVEMATCH - FIREBASE YAPILANDIRMASI (v1.6 Premium)
 *  Proje: lovmatch-3a64b
 *  =========================================================================
 */
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCFK38JMSkacWY5PG4VqtJF9O2DoJEC35I",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "lovmatch-3a64b.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "lovmatch-3a64b",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "lovmatch-3a64b.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1048746473980",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1048746473980:web:c2827ef1aa29b6dc5fda79",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-47QR7639RK"
};

// Zaten başlatılmışsa tekrar başlatma (HMR uyumluluğu)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firestore, Auth ve Storage başlat
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
