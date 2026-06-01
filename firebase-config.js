// =============================================
//  FIREBASE CONFIG — Mundialistas SNSP 2026
//  ⚠️ Reemplaza este objeto con el de tu proyecto Firebase
//  console.firebase.google.com → Proyecto → Configuración → Agregar app web
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, setDoc, onSnapshot, getDoc, updateDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ✅ Credenciales reales del proyecto mundialistas-snsp
const firebaseConfig = {
  apiKey:            "AIzaSyDK5505wgtE5qx4IhQZaXdAyPGrMYgWfeQ",
  authDomain:        "mundialistas-snsp.firebaseapp.com",
  projectId:         "mundialistas-snsp",
  storageBucket:     "mundialistas-snsp.firebasestorage.app",
  messagingSenderId: "548202037249",
  appId:             "1:548202037249:web:b2414c27a695c46d37c000"
};

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Exportar para que app.js los use
window.__FB_DB__ = db;
window.__FB_FUNCS__ = {
  collection, doc, setDoc, onSnapshot, getDoc, updateDoc, serverTimestamp
};
window.__FIREBASE_READY__ = true;

// Disparar evento para que app.js sepa que Firebase está listo
window.dispatchEvent(new Event('firebase-ready'));
