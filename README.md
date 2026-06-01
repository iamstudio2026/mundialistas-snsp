# 🏆 Mundialistas SNSP 2026

La quiniela oficial del Mundial 2026 para el equipo del SNSP.  
**Live:** https://iamstudio2026.github.io/mundialistas-snsp/

## ⚡ Features

- 📋 Pronósticos para los 72 partidos de fase de grupos (12 grupos × 6 partidos)
- 🥇 Ranking en tiempo real compartido entre todos (Firebase)
- 🎰 Ruleta de equipos (los 48 del Mundial)
- 🎲 Sorteo automático de equipos entre compas
- 🧠 Trivia mundialista con 15 preguntas
- 🎊 Confetti, countdown, y más...

## 🔥 Stack

- HTML + CSS + Vanilla JS (sin frameworks)
- Firebase Firestore (base de datos en tiempo real)
- GitHub Pages (hosting)
- GitHub Actions (CI/CD)

## ⚙️ Setup Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea proyecto → `mundialistas-snsp`
3. Firestore Database → Crear → Modo de prueba
4. Configuración → Agregar app Web
5. Pega el `firebaseConfig` en `firebase-config.js`

## 📦 Deploy

Cada `git push` a `main` dispara el deploy automático via GitHub Actions.

---
Hecho con ❤️ para los compas del SNSP 🇲🇽
