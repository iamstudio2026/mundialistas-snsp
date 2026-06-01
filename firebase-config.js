// =============================================
//  FIREBASE CONFIG — Mundialistas SNSP 2026
//  Auth con Google (Gmail) + Firestore
// =============================================

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';

import { getFirestore, collection, doc, setDoc, onSnapshot, getDoc, updateDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ✅ Credenciales reales del proyecto mundialistas-snsp
const firebaseConfig = {
  apiKey:            "AIzaSyDK5505wgtE5qx4IhQZaXdAyPGrMYgWfeQ",
  authDomain:        "mundialistas-snsp.firebaseapp.com",
  projectId:         "mundialistas-snsp",
  storageBucket:     "mundialistas-snsp.firebasestorage.app",
  messagingSenderId: "548202037249",
  appId:             "1:548202037249:web:b2414c27a695c46d37c000"
};

// Inicializar Firebase
const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// Exportar para app.js
window.__FB_DB__    = db;
window.__FB_AUTH__  = auth;
window.__FB_FUNCS__ = {
  collection, doc, setDoc, onSnapshot, getDoc, updateDoc, serverTimestamp,
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
  provider
};
window.__FIREBASE_READY__ = true;

// Avisar a app.js que Firebase está listo
window.dispatchEvent(new Event('firebase-ready'));
