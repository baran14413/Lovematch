import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase configuration (lovematch-67f1d)
const firebaseConfig = {
    apiKey: "AIzaSyBn7oZw5y-HtFdsJmD9Zju-1ClDcXu9l2c",
    authDomain: "lovematch-67f1d.firebaseapp.com",
    projectId: "lovematch-67f1d",
    storageBucket: "lovematch-67f1d.firebasestorage.app",
    messagingSenderId: "555856494313",
    appId: "1:555856494313:web:7f6f5f4f3f2f1f0f" // Tahmini Web App ID, genelde google-services.json'dan farklıdır ama projeye göre değişir.
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
