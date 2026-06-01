// =============================================
//  FIREBASE CONFIG — Mundialistas SNSP 2026
//  ⚠️ Reemplaza este objeto con el de tu proyecto Firebase
//  console.firebase.google.com → Proyecto → Configuración → Agregar app web
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, setDoc, onSnapshot, getDoc, updateDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// 🔴 REEMPLAZA ESTE OBJETO CON EL TUYO (Firebase Console → Proyecto → Config)
const firebaseConfig = {
  apiKey:            "REEMPLAZA_CON_TU_API_KEY",
  authDomain:        "REEMPLAZA.firebaseapp.com",
  projectId:         "REEMPLAZA_CON_TU_PROJECT_ID",
  storageBucket:     "REEMPLAZA.appspot.com",
  messagingSenderId: "REEMPLAZA",
  appId:             "REEMPLAZA_CON_TU_APP_ID"
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
