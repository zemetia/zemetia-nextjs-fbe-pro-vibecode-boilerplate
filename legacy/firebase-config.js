// ==========================================
// Firebase Configuration
// ==========================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase configuration object
// ✅ PT TAN Project Configuration (erp-tan, from Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyDvlMKcrMwRH_pYgpm_kwDD3qWqIw1LV2o",
    authDomain: "erp-tan.firebaseapp.com",
    projectId: "erp-tan",
    storageBucket: "erp-tan.firebasestorage.app",
    messagingSenderId: "2472784120",
    appId: "1:2472784120:web:32a3bde51c0fd5c6b8cb0d",
    measurementId: "G-QJNT5J07YW"
};

// Initialize Firebase (robust against duplicate initialization)
const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApp();

// ☁️ Initialize Firestore with Modern Persistence API
// Uses initializeFirestore (not getFirestore) with persistentLocalCache
// This replaces the deprecated enableIndexedDbPersistence() call and:
// - Supports multiple tabs simultaneously
// - Works correctly in private/incognito mode (graceful fallback)
// - No more deprecation warnings
let db;
if (isNewApp) {
    try {
        db = initializeFirestore(app, {
            cache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
        console.log('✅ Firestore persistence enabled (multi-tab IndexedDB)');
    } catch (err) {
        // Fallback: if persistentLocalCache fails (e.g. incognito), use in-memory only
        console.warn('⚠️ Persistent cache unavailable, using in-memory Firestore:', err.message);
        db = getFirestore(app);
    }
} else {
    db = window.db || getFirestore(app);
}

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Firebase Functions
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
const functions = getFunctions(app);

// Export for use in other modules
export { app, db, auth, functions, httpsCallable, firebaseConfig };

// **ALSO export to window for file:// URL compatibility**
window.db = db;
window.auth = auth;
window.firebaseApp = app;
window.firebaseFunctions = { getFunctions, httpsCallable, functions };

// Export firestore functions to window
import * as firestoreModule from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
window.firestore = firestoreModule;

console.log('✅ Firebase initialized successfully');
console.log('📊 Project ID:', firebaseConfig.projectId);
console.log('🌐 Global exports available: window.db, window.auth, window.firestore, window.firebaseFunctions');
window.dispatchEvent(new CustomEvent('firebase-initialized'));
