/* ==============================================
   MUNDIALISTAS SNSP 2026 — app.js
   v2.2 — Firebase Auth (Gmail) + Admin Panel
   ============================================== */

// 🔑 EMAIL DEL ADMINISTRADOR — solo este usuario ve el panel admin
const ADMIN_EMAIL = 'phd.vicenternesto@gmail.com';

// =============================================
//  ESTADO DE LA APP
// =============================================
let state = {
  currentPlayer: null,
  players: [],          // [{ name, color, predictions: {matchId: {home, away}}, points, exactos, ganadores, racha }]
  realResults: {},      // { matchId: {home, away} }
  wheelTeams: [],
  wheelSpinning: false,
  currentAngle: 0,
  currentTriviaQ: 0,
  triviaScore: 0,
  triviaAnswered: false,
  currentRuletaTab: 'equipo',
  currentWheelGroup: 'all',
};

// Detección de Firebase
let db = null;
let FB = null;
let auth = null;
let USE_FIREBASE = false;

// Helper: saber si el usuario actual es admin
function isAdmin() {
  return state.currentPlayer?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function initFirebase() {
  if (window.__FIREBASE_READY__ && window.__FB_DB__) {
    db   = window.__FB_DB__;
    FB   = window.__FB_FUNCS__;
    auth = window.__FB_AUTH__;
    USE_FIREBASE = true;
    console.log('✅ Firebase + Auth conectados');
    setupAuthListener();
    startFirestoreListeners();
  } else {
    console.log('⚠️ Firebase no configurado — modo local');
    loadStateLocal();
  }
}

window.addEventListener('firebase-ready', initFirebase);
if (window.__FIREBASE_READY__) initFirebase();

// =============================================
//  GOOGLE SIGN-IN
// =============================================
async function signInWithGoogle() {
  if (!USE_FIREBASE) { showToast('⚠️ Firebase no disponible', 'error'); return; }
  const btn = document.getElementById('btn-google-signin');
  btn.disabled = true;
  btn.innerHTML = '⏳ Conectando...';
  try {
    const { signInWithPopup, provider } = FB;
    const result = await signInWithPopup(auth, provider);
    // onAuthStateChanged se encarga del resto
  } catch (err) {
    console.error(err);
    showToast(`❌ Error: ${err.code || err.message || 'Error al iniciar sesión'}`, 'error');
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Entrar con Google`;
  }
}

function setupAuthListener() {
  const { onAuthStateChanged } = FB;
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Usuario autenticado con Google— entrar directo
      await loginWithGoogleUser(user);
    }
  });
}

async function loginWithGoogleUser(user) {
  const { doc, setDoc } = FB;
  const colors = ['#ffd700','#ff6b35','#00c853','#2979ff','#e91e63','#00bcd4','#ff5722','#9c27b0'];

  // Buscar o crear jugador en Firestore por UID
  let player = state.players.find(p => p.uid === user.uid);
  if (!player) {
    player = {
      uid:       user.uid,
      name:      user.displayName || user.email.split('@')[0],
      email:     user.email,
      photo:     user.photoURL || null,
      color:     colors[state.players.length % colors.length],
      predictions: {},
      points:    0,
      exactos:   0,
      ganadores: 0,
      racha:     0,
    };
  }

  state.currentPlayer = player;

  // Guardar/actualizar en Firestore
  await setDoc(doc(db, 'players', user.uid), {
    ...player,
    lastLogin: new Date().toISOString()
  }, { merge: true });

  // Actualizar header con foto de Google
  const avatarEl = document.getElementById('user-avatar');
  if (player.photo) {
    avatarEl.innerHTML = `<img src="${player.photo}" alt="${player.name}" />`;
    avatarEl.style.background = 'transparent';
    avatarEl.style.padding = '0';
  } else {
    avatarEl.textContent = player.name[0].toUpperCase();
    avatarEl.style.background = player.color;
  }
  document.getElementById('header-user-name').textContent = player.name;
  document.getElementById('header-user-pts').textContent = `${player.points} pts`;

  // Agregar botón de cerrar sesión
  addSignOutButton();

  // Transición al app
  const splash = document.getElementById('splash-screen');
  if (!splash.classList.contains('hidden')) {
    splash.style.opacity = '0';
    splash.style.transition = 'opacity 0.6s ease';
    setTimeout(() => {
      splash.classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      refreshHomeStats();
      renderQuinielaSection();
      renderRankingTable();
      showSection('home');
    }, 600);
  }
}

function addSignOutButton() {
  if (document.getElementById('btn-signout')) return;
  const userDiv = document.querySelector('.header-user');
  if (!userDiv) return;

  // Badge ADMIN si corresponde
  if (isAdmin()) {
    const badge = document.createElement('span');
    badge.style.cssText = 'background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:10px;font-weight:900;padding:3px 8px;border-radius:50px;letter-spacing:1px;';
    badge.textContent = '🔑 ADMIN';
    userDiv.appendChild(badge);
  }

  const btn = document.createElement('button');
  btn.id = 'btn-signout';
  btn.title = 'Cerrar sesión';
  btn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;color:var(--text-muted);cursor:pointer;font-size:16px;transition:all 0.2s;';
  btn.textContent = '🚪';
  btn.onmouseenter = () => { btn.style.borderColor = 'var(--red)'; btn.style.color = 'var(--red)'; };
  btn.onmouseleave = () => { btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.color = 'var(--text-muted)'; };
  btn.onclick = async () => {
    const { signOut } = FB;
    await signOut(auth);
    location.reload();
  };
  userDiv.appendChild(btn);
}

// =============================================
//  DATOS: GRUPOS Y EQUIPOS DEL MUNDIAL 2026
// =============================================
const WORLD_CUP_GROUPS = {
  A: {
    name: 'Grupo A', teams: [
      { name: 'México',        flag: '🇲🇽', rank: 16,  fifa_rank: 16  },
      { name: 'Sudáfrica',     flag: '🇿🇦', rank: 60,  fifa_rank: 60  },
      { name: 'Corea del Sur', flag: '🇰🇷', rank: 22,  fifa_rank: 22  },
      { name: 'República Checa',flag: '🇨🇿', rank: 36,  fifa_rank: 36  }
    ]
  },
  B: {
    name: 'Grupo B', teams: [
      { name: 'Canadá',          flag: '🇨🇦', rank: 40,  fifa_rank: 40  },
      { name: 'Suiza',           flag: '🇨🇭', rank: 18,  fifa_rank: 18  },
      { name: 'Catar',           flag: '🇶🇦', rank: 58,  fifa_rank: 58  },
      { name: 'Bosnia-Herz.',    flag: '🇧🇦', rank: 61,  fifa_rank: 61  }
    ]
  },
  C: {
    name: 'Grupo C', teams: [
      { name: 'Brasil',    flag: '🇧🇷', rank: 4,  fifa_rank: 4   },
      { name: 'Marruecos', flag: '🇲🇦', rank: 14, fifa_rank: 14  },
      { name: 'Escocia',   flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', rank: 39, fifa_rank: 39  },
      { name: 'Haití',     flag: '🇭🇹', rank: 75, fifa_rank: 75  }
    ]
  },
  D: {
    name: 'Grupo D', teams: [
      { name: 'Estados Unidos', flag: '🇺🇸', rank: 13, fifa_rank: 13 },
      { name: 'Paraguay',       flag: '🇵🇾', rank: 54, fifa_rank: 54 },
      { name: 'Australia',      flag: '🇦🇺', rank: 23, fifa_rank: 23 },
      { name: 'Turquía',        flag: '🇹🇷', rank: 31, fifa_rank: 31 }
    ]
  },
  E: {
    name: 'Grupo E', teams: [
      { name: 'Alemania',       flag: '🇩🇪', rank: 14, fifa_rank: 14 },
      { name: 'Ecuador',        flag: '🇪🇨', rank: 44, fifa_rank: 44 },
      { name: 'Costa de Marfil',flag: '🇨🇮', rank: 49, fifa_rank: 49 },
      { name: 'Curazao',        flag: '🇨🇼', rank: 86, fifa_rank: 86 }
    ]
  },
  F: {
    name: 'Grupo F', teams: [
      { name: 'Países Bajos', flag: '🇳🇱', rank: 7,  fifa_rank: 7  },
      { name: 'Japón',        flag: '🇯🇵', rank: 20, fifa_rank: 20 },
      { name: 'Túnez',        flag: '🇹🇳', rank: 30, fifa_rank: 30 },
      { name: 'Suecia',       flag: '🇸🇪', rank: 24, fifa_rank: 24 }
    ]
  },
  G: {
    name: 'Grupo G', teams: [
      { name: 'Bélgica',     flag: '🇧🇪', rank: 5,  fifa_rank: 5  },
      { name: 'Irán',        flag: '🇮🇷', rank: 21, fifa_rank: 21 },
      { name: 'Egipto',      flag: '🇪🇬', rank: 35, fifa_rank: 35 },
      { name: 'Nueva Zelanda',flag: '🇳🇿', rank: 95, fifa_rank: 95 }
    ]
  },
  H: {
    name: 'Grupo H', teams: [
      { name: 'España',       flag: '🇪🇸', rank: 6,  fifa_rank: 6  },
      { name: 'Uruguay',      flag: '🇺🇾', rank: 17, fifa_rank: 17 },
      { name: 'Arabia Saudita',flag:'🇸🇦', rank: 56, fifa_rank: 56 },
      { name: 'Cabo Verde',   flag: '🇨🇻', rank: 73, fifa_rank: 73 }
    ]
  },
  I: {
    name: 'Grupo I', teams: [
      { name: 'Francia',  flag: '🇫🇷', rank: 2,  fifa_rank: 2  },
      { name: 'Senegal',  flag: '🇸🇳', rank: 19, fifa_rank: 19 },
      { name: 'Noruega',  flag: '🇳🇴', rank: 34, fifa_rank: 34 },
      { name: 'Irak',     flag: '🇮🇶', rank: 63, fifa_rank: 63 }
    ]
  },
  J: {
    name: 'Grupo J', teams: [
      { name: 'Argentina', flag: '🇦🇷', rank: 1,  fifa_rank: 1  },
      { name: 'Argelia',   flag: '🇩🇿', rank: 41, fifa_rank: 41 },
      { name: 'Austria',   flag: '🇦🇹', rank: 26, fifa_rank: 26 },
      { name: 'Jordania',  flag: '🇯🇴', rank: 65, fifa_rank: 65 }
    ]
  },
  K: {
    name: 'Grupo K', teams: [
      { name: 'Portugal',  flag: '🇵🇹', rank: 8,  fifa_rank: 8  },
      { name: 'Colombia',  flag: '🇨🇴', rank: 12, fifa_rank: 12 },
      { name: 'RD Congo',  flag: '🇨🇩', rank: 50, fifa_rank: 50 },
      { name: 'Uzbekistán',flag: '🇺🇿', rank: 68, fifa_rank: 68 }
    ]
  },
  L: {
    name: 'Grupo L', teams: [
      { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rank: 5,  fifa_rank: 5  },
      { name: 'Croacia',    flag: '🇭🇷', rank: 10, fifa_rank: 10 },
      { name: 'Ghana',      flag: '🇬🇭', rank: 55, fifa_rank: 55 },
      { name: 'Panamá',     flag: '🇵🇦', rank: 72, fifa_rank: 72 }
    ]
  }
};

// Partidos de la fase de grupos (selección representativa)
const GROUP_MATCHES = generateGroupMatches();

function generateGroupMatches() {
  const matches = [];
  let id = 1;

  const venues = {
    A: ['Estadio Azteca, CDMX', 'SoFi Stadium, LA', 'AT&T Stadium, Dallas'],
    B: ['BC Place, Vancouver', 'BMO Field, Toronto', 'Estadio Akron, GDL'],
    C: ['MetLife Stadium, NY', 'Hard Rock Stadium, Miami', 'Gillette Stadium, Boston'],
    D: ['AT&T Stadium, Dallas', 'NRG Stadium, Houston', 'Arrowhead, Kansas City'],
    E: ['Levi\'s Stadium, San Jose', 'Mercedes-Benz, Atlanta', 'Estadio Azteca, CDMX'],
    F: ['Rose Bowl, Pasadena', 'Lincoln Financial, Philly', 'BC Place, Vancouver'],
    G: ['Empower, Denver', 'Camping World, Orlando', 'BMO Field, Toronto'],
    H: ['Raymond James, Tampa', 'Geodis Park, Nashville', 'Estadio BBVA, MTY'],
    I: ['MetLife Stadium, NY', 'SoFi Stadium, LA', 'Hard Rock Stadium, Miami'],
    J: ['Estadio Azteca, CDMX', 'AT&T Stadium, Dallas', 'NRG Stadium, Houston'],
    K: ['Mercedes-Benz, Atlanta', 'Levi\'s Stadium, San Jose', 'Estadio Akron, GDL'],
    L: ['BC Place, Vancouver', 'BMO Field, Toronto', 'Camping World, Orlando']
  };

  // Dates (approximate group stage dates)
  const baseDates = {
    A: ['11 Jun', '15 Jun', '19 Jun'],
    B: ['12 Jun', '16 Jun', '20 Jun'],
    C: ['12 Jun', '16 Jun', '20 Jun'],
    D: ['13 Jun', '17 Jun', '21 Jun'],
    E: ['13 Jun', '17 Jun', '21 Jun'],
    F: ['14 Jun', '18 Jun', '22 Jun'],
    G: ['14 Jun', '18 Jun', '22 Jun'],
    H: ['15 Jun', '19 Jun', '23 Jun'],
    I: ['15 Jun', '19 Jun', '23 Jun'],
    J: ['16 Jun', '20 Jun', '24 Jun'],
    K: ['16 Jun', '20 Jun', '24 Jun'],
    L: ['17 Jun', '21 Jun', '25 Jun']
  };

  Object.keys(WORLD_CUP_GROUPS).forEach(groupKey => {
    const group = WORLD_CUP_GROUPS[groupKey];
    const teams = group.teams;
    const groupVenues = venues[groupKey];
    const groupDates = baseDates[groupKey];

    // Round robin: 3 matchdays, 6 matches per group
    const matchups = [
      [0, 1], // Jornada 1
      [2, 3],
      [0, 2], // Jornada 2
      [1, 3],
      [0, 3], // Jornada 3
      [1, 2]
    ];

    matchups.forEach(([h, a], idx) => {
      const jornada = idx < 2 ? 1 : idx < 4 ? 2 : 3;
      matches.push({
        id: id++,
        group: groupKey,
        jornada,
        home: teams[h],
        away: teams[a],
        date: groupDates[jornada - 1] + ' 2026',
        venue: groupVenues[jornada - 1],
        realScore: null, // {home: N, away: N}
      });
    });
  });

  return matches;
}

// =============================================
//  TRIVIA MUNDIALISTA
// =============================================
const TRIVIA_QUESTIONS = [
  {
    q: '¿Cuántos equipos participan en el Mundial 2026?',
    opts: ['32', '36', '48', '64'],
    ans: 2,
    exp: '¡Por primera vez son 48 equipos en 12 grupos!'
  },
  {
    q: '¿Qué país ganó el último Mundial (2022)?',
    opts: ['Francia', 'Brasil', 'Argentina', 'Marruecos'],
    ans: 2,
    exp: 'Argentina venció a Francia en la final de Qatar con Messi.'
  },
  {
    q: '¿En qué estadio es el partido inaugural México vs Sudáfrica?',
    opts: ['SoFi Stadium LA', 'MetLife Stadium NY', 'Estadio Azteca CDMX', 'AT&T Stadium Dallas'],
    ans: 2,
    exp: 'El Azteca recibe el partido inaugural el 11 de junio.'
  },
  {
    q: '¿Qué selección ha ganado más Mundiales en la historia?',
    opts: ['Alemania', 'Brasil', 'Italia', 'Argentina'],
    ans: 1,
    exp: 'Brasil tiene 5 títulos mundiales: 1958, 1962, 1970, 1994 y 2002.'
  },
  {
    q: '¿Cuál es el goleador histórico de los Mundiales?',
    opts: ['Pelé', 'Ronaldo (Brasil)', 'Miroslav Klose', 'Messi'],
    ans: 2,
    exp: 'Miroslav Klose (Alemania) marcó 16 goles en Mundiales.'
  },
  {
    q: '¿Dónde se juega la Final del Mundial 2026?',
    opts: ['Estadio Azteca, CDMX', 'Rose Bowl, Los Angeles', 'MetLife Stadium, NY', 'AT&T Stadium, Dallas'],
    ans: 2,
    exp: 'La gran Final es el 19 de julio en el MetLife Stadium, Nueva York/NJ.'
  },
  {
    q: '¿En qué grupo está México en el Mundial 2026?',
    opts: ['Grupo C', 'Grupo A', 'Grupo D', 'Grupo J'],
    ans: 1,
    exp: 'México está en el Grupo A junto a Sudáfrica, Corea del Sur y R. Checa.'
  },
  {
    q: '¿Cuántos partidos se juegan en total en el Mundial 2026?',
    opts: ['64', '80', '96', '104'],
    ans: 3,
    exp: 'Con 48 equipos el torneo tiene 104 partidos en total.'
  },
  {
    q: '¿Qué 3 países son sede del Mundial 2026?',
    opts: ['México, USA, Brasil', 'Canadá, México, USA', 'USA, Canadá, Colombia', 'México, USA, Argentina'],
    ans: 1,
    exp: 'Es la primera sede trinacional: Canadá, México y Estados Unidos.'
  },
  {
    q: '¿Cuántos equipos avanzan de la fase de grupos al Round of 32?',
    opts: ['24', '28', '32', '48'],
    ans: 2,
    exp: 'Top 2 de cada grupo (24) + los 8 mejores terceros = 32 equipos.'
  },
  {
    q: '¿Cuál equipo es el actual campeón de CONCACAF (Copa Oro)?',
    opts: ['México', 'Costa Rica', 'Estados Unidos', 'Panamá'],
    ans: 2,
    exp: 'Estados Unidos ganó la Copa Oro 2023 y clasificó como anfitrión.'
  },
  {
    q: '¿En cuántos grupos está dividido el Mundial 2026?',
    opts: ['8', '10', '12', '16'],
    ans: 2,
    exp: 'El nuevo formato tiene 12 grupos de 4 equipos cada uno.'
  },
  {
    q: '¿Qué selección sudamericana NO clasificó al Mundial 2026?',
    opts: ['Venezuela', 'Bolivia', 'Perú', 'Ecuador'],
    ans: 2,
    exp: 'Perú quedó fuera de la clasificación sudamericana.'
  },
  {
    q: '¿Quién es el máximo goleador histórico de la selección de México?',
    opts: ['Javier Hernández', 'Carlos Hermosillo', 'Luis Hernández', 'Cuauhtémoc Blanco'],
    ans: 0,
    exp: '"Chicharito" Javier Hernández es el máximo goleador con 52 goles.'
  },
  {
    q: '¿Cuál es el apodo del equipo de Argentina?',
    opts: ['La Roja', 'La Albiceleste', 'La Canarinha', 'La Tricolor'],
    ans: 1,
    exp: 'Argentina es conocida como "La Albiceleste" por sus colores blanco y celeste.'
  }
];

// (El estado de la app se ha movido al inicio del archivo)

// =============================================
//  INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  // Firebase se inicializa vía evento 'firebase-ready'
  // Aquí solo arrancamos las partes que no dependen de Firebase
  startCountdown();
  updateWheelGroups();
  renderGroupsSection();
  populateAdminMatchSelect();

  // Si firebase no llegó en 2s, usamos localStorage
  setTimeout(() => {
    if (!USE_FIREBASE) initFirebase();
  }, 2000);
});

// =============================================
//  FIREBASE FIRESTORE — TIEMPO REAL
// =============================================
function startFirestoreListeners() {
  const { collection, onSnapshot } = FB;

  // Escuchar jugadores en tiempo real
  onSnapshot(collection(db, 'players'), (snapshot) => {
    state.players = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    updateSplashPlayers();
    refreshHomeStats();
    renderRankingTable();
    // Refrescar pronósticos del jugador actual
    if (state.currentPlayer) {
      const updated = state.players.find(p => p.name === state.currentPlayer.name);
      if (updated) {
        state.currentPlayer = updated;
        document.getElementById('header-user-pts').textContent = `${updated.points} pts`;
        renderQuinielaSection();
      }
    }
  });

  // Escuchar resultados reales en tiempo real
  onSnapshot(collection(db, 'results'), (snapshot) => {
    snapshot.docs.forEach(d => {
      const data = d.data();
      state.realResults[data.matchId] = { home: data.home, away: data.away };
      const match = GROUP_MATCHES.find(m => m.id === data.matchId);
      if (match) match.realScore = { home: data.home, away: data.away };
    });
    if (state.currentPlayer) renderQuinielaSection();
  });

  // Cargar estado inicial desde localStorage como caché
  loadStateLocal();
  updateSplashPlayers();
}

// =============================================
//  LOCAL STORAGE (fallback y caché)
// =============================================
function loadStateLocal() {
  const saved = localStorage.getItem('mundialistas_snsp_2026');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (!USE_FIREBASE) {
      state.players = parsed.players || [];
      state.realResults = parsed.realResults || {};
    }
    // Siempre restaurar resultados reales a los matches
    GROUP_MATCHES.forEach(m => {
      if (state.realResults[m.id]) m.realScore = state.realResults[m.id];
    });
  }
  updateSplashPlayers();
  renderRankingTable();
}

async function saveState() {
  if (USE_FIREBASE) {
    await saveToFirestore();
  } else {
    localStorage.setItem('mundialistas_snsp_2026', JSON.stringify({
      players: state.players,
      realResults: state.realResults
    }));
  }
  // Guardar siempre en localStorage como caché offline
  localStorage.setItem('mundialistas_snsp_2026', JSON.stringify({
    players: state.players,
    realResults: state.realResults
  }));
}

async function saveToFirestore() {
  if (!USE_FIREBASE || !state.currentPlayer) return;
  const { doc, setDoc } = FB;
  // Usar UID si hay auth de Google, o nombre como key si no
  const playerKey = state.currentPlayer.uid || state.currentPlayer.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  await setDoc(doc(db, 'players', playerKey), {
    ...state.currentPlayer,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

async function recalculateAllPointsFirestore() {
  if (!USE_FIREBASE) return;
  const { doc, setDoc } = FB;
  
  for (const player of state.players) {
    let points = 0;
    let exactos = 0;
    let ganadores = 0;
    let racha = 0;

    // Ordenar partidos para calcular la racha cronológicamente
    const sortedMatches = [...GROUP_MATCHES].sort((a, b) => a.id - b.id);
    sortedMatches.forEach(m => {
      const real = state.realResults[m.id];
      if (real && real.home !== undefined && real.home !== null && real.away !== undefined && real.away !== null) {
        const pred = player.predictions?.[m.id];
        if (pred && pred.home !== undefined && pred.home !== null && pred.home !== '' && pred.away !== undefined && pred.away !== null && pred.away !== '') {
          const pts = calcPoints(pred, real);
          points += pts;
          if (pts === 3) {
            exactos++;
            racha++;
          } else if (pts === 1) {
            ganadores++;
            racha++;
          } else {
            racha = 0;
          }
        }
      }
    });

    const playerKey = player.uid || player.id || player.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await setDoc(doc(db, 'players', playerKey), {
      points,
      exactos,
      ganadores,
      racha
    }, { merge: true });
  }
}

async function saveRealResultFirestore(matchId, home, away) {
  if (!USE_FIREBASE) return;
  const { doc, setDoc } = FB;
  
  // 1. Guardar resultado en Firestore
  await setDoc(doc(db, 'results', String(matchId)), {
    matchId, home, away,
    updatedAt: new Date().toISOString()
  });

  // 2. Actualizar estado local para cálculo inmediato
  state.realResults[matchId] = { home, away };
  const match = GROUP_MATCHES.find(m => m.id === matchId);
  if (match) match.realScore = { home, away };

  // 3. Recalcular puntos de todos los jugadores en la nube
  await recalculateAllPointsFirestore();
}

// =============================================
//  SPLASH SCREEN
// =============================================
function updateSplashPlayers() {
  const container = document.getElementById('players-list-preview');
  if (!container) return;
  if (state.players.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Sé el primero en unirte 👆</p>';
    return;
  }
  container.innerHTML = state.players.map(p =>
    `<div class="player-chip">
      <div class="player-chip-avatar">${p.name[0].toUpperCase()}</div>
      ${p.name}
    </div>`
  ).join('');
}

async function enterApp() {
  const input = document.getElementById('player-name-input');
  const name = input.value.trim();
  if (!name) {
    input.style.borderColor = 'var(--red)';
    input.placeholder = '¡Escribe tu nombre!';
    setTimeout(() => { input.style.borderColor = ''; }, 2000);
    return;
  }

  // Buscar jugador existente o crear nuevo
  let player = state.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!player) {
    const colors = ['#ffd700','#ff6b35','#00c853','#2979ff','#e91e63','#00bcd4','#ff5722','#9c27b0'];
    player = {
      name,
      color: colors[state.players.length % colors.length],
      predictions: {},
      points: 0,
      exactos: 0,
      ganadores: 0,
      racha: 0,
    };
    state.players.push(player);
  }

  state.currentPlayer = player;

  // Guardar en Firebase (o localStorage)
  if (USE_FIREBASE) {
    await saveToFirestore();
  } else {
    saveState();
  }

  // Guardar nombre en localStorage para auto-login
  localStorage.setItem('mundialistas_last_player', name);

  // Actualizar UI
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  document.getElementById('user-avatar').style.background = player.color;
  document.getElementById('header-user-name').textContent = name;
  document.getElementById('header-user-pts').textContent = `${player.points} pts`;

  // Transición
  const splash = document.getElementById('splash-screen');
  splash.style.opacity = '0';
  splash.style.transition = 'opacity 0.6s ease';
  setTimeout(() => {
    splash.classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    refreshHomeStats();
    renderQuinielaSection();
    renderRankingTable();
    showSection('home');
  }, 600);
}

// Auto-login si ya visitó antes
window.addEventListener('firebase-ready', () => {
  const lastName = localStorage.getItem('mundialistas_last_player');
  if (lastName) {
    document.getElementById('player-name-input').value = lastName;
    document.getElementById('player-name-input').style.borderColor = 'var(--green)';
  }
});

// Presionar Enter en el input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('player-name-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') enterApp(); });
});

// =============================================
//  NAVEGACIÓN
// =============================================
function showSection(name) {
  const sections = ['home', 'quiniela', 'grupos', 'ranking', 'ruleta'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    const btn = document.getElementById(`nav-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
    if (btn) btn.classList.toggle('active', s === name);
  });

  if (name === 'home') refreshHomeStats();
  if (name === 'ranking') renderRankingTable();
}

// =============================================
//  HOME
// =============================================
function refreshHomeStats() {
  document.getElementById('stat-players').textContent = state.players.length;

  let totalPreds = 0;
  state.players.forEach(p => {
    totalPreds += Object.keys(p.predictions || {}).length;
  });
  document.getElementById('stat-predictions').textContent = totalPreds;

  // Días restantes
  const start = new Date('2026-06-11T20:00:00-06:00');
  const now = new Date();
  const diff = Math.max(0, Math.ceil((start - now) / (1000 * 60 * 60 * 24)));
  document.getElementById('stat-days').textContent = diff;

  // Líder
  renderLeaderCard();
}

function renderLeaderCard() {
  const container = document.getElementById('leader-content');
  const sorted = [...state.players].sort((a, b) => b.points - a.points);
  if (sorted.length === 0 || sorted[0].points === 0) {
    container.innerHTML = '<p class="no-data">Nadie ha registrado puntos aún. ¡Sé el primero!</p>';
    return;
  }
  const leader = sorted[0];
  container.innerHTML = `
    <div class="leader-info">
      <span class="leader-crown">👑</span>
      <div>
        <div class="leader-name">${leader.name}</div>
        <div class="leader-pts">${leader.points} puntos · ${leader.exactos} exactos · ${leader.ganadores} ganadores</div>
      </div>
    </div>`;
}

// =============================================
//  COUNTDOWN
// =============================================
function startCountdown() {
  const target = new Date('2026-06-11T20:00:00-06:00');
  function tick() {
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) {
      ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(id => {
        document.getElementById(id).textContent = '00';
      });
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('cd-days').textContent  = String(d).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
    document.getElementById('cd-mins').textContent  = String(m).padStart(2, '0');
    document.getElementById('cd-secs').textContent  = String(s).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
}

// =============================================
//  QUINIELA — FASE DE GRUPOS
// =============================================
function renderQuinielaSection() {
  const container = document.getElementById('quiniela-grupos');
  if (!container || !state.currentPlayer) return;

  const groups = Object.keys(WORLD_CUP_GROUPS);
  let html = '';

  groups.forEach(gKey => {
    const group = WORLD_CUP_GROUPS[gKey];
    const matches = GROUP_MATCHES.filter(m => m.group === gKey);
    const teams = group.teams.map(t => `${t.flag} ${t.name}`).join(' · ');

    html += `
      <div class="group-section">
        <div class="group-title-bar">
          <span class="group-badge">GRUPO ${gKey}</span>
          <span class="group-section-title">${group.name}</span>
          <span class="group-teams-mini">${teams}</span>
        </div>
        ${matches.map(m => renderMatchCard(m)).join('')}
      </div>`;
  });

  container.innerHTML = html;

  // Re-attach input events
  attachScoreInputEvents();
}

function renderMatchCard(match) {
  const pred = state.currentPlayer?.predictions?.[match.id];
  const homeVal = pred ? pred.home : '';
  const awayVal = pred ? pred.away : '';
  const hasPred = pred !== undefined && pred !== null;
  const hasReal = match.realScore !== null;

  let ptsIndicator = '';
  if (hasReal && hasPred) {
    const pts = calcPoints(pred, match.realScore);
    if (pts === 3) ptsIndicator = '<span class="match-pts">🏆 +3 pts (Exacto!)</span>';
    else if (pts === 1) ptsIndicator = '<span class="match-pts">✅ +1 pt (Ganador)</span>';
    else ptsIndicator = '<span style="color:var(--red);font-size:12px">❌ Sin puntos</span>';
  } else if (hasPred) {
    ptsIndicator = '<span class="match-pts">💾 Guardado</span>';
  }

  return `
    <div class="match-card ${hasPred ? 'has-prediction' : ''}" id="match-${match.id}">
      <div class="team-block home">
        <span class="team-flag">${match.home.flag}</span>
        <span class="team-name">${match.home.name}</span>
      </div>
      <div class="score-inputs-match">
        <input type="number" class="score-input ${homeVal !== '' ? 'filled' : ''}"
               id="score-h-${match.id}" min="0" max="20"
               value="${homeVal}" placeholder="?"
               data-match="${match.id}" data-side="home"
               ${hasReal ? 'disabled title="Ya hay resultado oficial"' : ''} />
        <span class="vs-badge">vs</span>
        <input type="number" class="score-input ${awayVal !== '' ? 'filled' : ''}"
               id="score-a-${match.id}" min="0" max="20"
               value="${awayVal}" placeholder="?"
               data-match="${match.id}" data-side="away"
               ${hasReal ? 'disabled title="Ya hay resultado oficial"' : ''} />
      </div>
      <div class="team-block away">
        <span class="team-flag">${match.away.flag}</span>
        <span class="team-name">${match.away.name}</span>
      </div>
      <div class="match-meta">
        <span class="match-date">📅 ${match.date}</span>
        <span class="match-venue">🏟️ ${match.venue}</span>
        ${hasReal
          ? `<span class="match-pts" style="color:var(--gold)">
              Resultado: ${match.realScore.home}–${match.realScore.away}
             </span>`
          : ptsIndicator
        }
      </div>
    </div>`;
}

function attachScoreInputEvents() {
  document.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('change', () => {
      input.classList.toggle('filled', input.value !== '');
      autoSavePrediction(input);
    });
  });
}

function autoSavePrediction(input) {
  const matchId = parseInt(input.dataset.match);
  const side = input.dataset.side;
  const val = parseInt(input.value);
  if (isNaN(val) || val < 0) return;

  if (!state.currentPlayer.predictions[matchId]) {
    state.currentPlayer.predictions[matchId] = { home: '', away: '' };
  }
  state.currentPlayer.predictions[matchId][side] = val;

  // Mark card
  const card = document.getElementById(`match-${matchId}`);
  const pred = state.currentPlayer.predictions[matchId];
  if (pred.home !== '' && pred.away !== '') {
    card?.classList.add('has-prediction');
  }
}

async function savePredictions() {
  if (!state.currentPlayer) return;
  // Read all inputs
  document.querySelectorAll('.score-input').forEach(input => {
    const matchId = parseInt(input.dataset.match);
    const side = input.dataset.side;
    const val = input.value;
    if (val === '') return;
    if (!state.currentPlayer.predictions[matchId]) {
      state.currentPlayer.predictions[matchId] = { home: '', away: '' };
    }
    state.currentPlayer.predictions[matchId][side] = parseInt(val);
  });

  // Sincronizar jugador actual en Firebase o localStorage
  if (USE_FIREBASE) {
    await saveToFirestore();
    showToast('☁️ ¡Pronósticos guardados en la nube!');
  } else {
    await saveState();
    showToast('💾 ¡Pronósticos guardados!');
  }
  refreshHomeStats();
  setTimeout(() => launchConfetti(3000), 100);
}

function switchPhase(phase, btn) {
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('quiniela-grupos').classList.toggle('hidden', phase !== 'grupos');
  document.getElementById('quiniela-eliminacion').classList.toggle('hidden', phase !== 'eliminacion');
}

// =============================================
//  GROUPS SECTION
// =============================================
function renderGroupsSection() {
  const container = document.getElementById('groups-grid');
  if (!container) return;

  let html = '';
  Object.keys(WORLD_CUP_GROUPS).forEach(gKey => {
    const group = WORLD_CUP_GROUPS[gKey];
    html += `
      <div class="group-card">
        <div class="group-card-header">
          <div class="group-letter">${gKey}</div>
          <div>
            <div class="group-card-title">${group.name}</div>
            <div class="group-card-subtitle">4 equipos · 6 partidos</div>
          </div>
        </div>
        ${group.teams.map((t, i) => `
          <div class="group-team-row">
            <span class="group-team-flag">${t.flag}</span>
            <span class="group-team-name">${t.name}</span>
            <span class="group-team-rank">FIFA #${t.rank}</span>
          </div>`).join('')}
      </div>`;
  });
  container.innerHTML = html;
}

// =============================================
//  RANKING
// =============================================
function renderRankingTable() {
  const tbody = document.getElementById('ranking-body');
  if (!tbody) return;

  // Mostrar panel de administración si es admin
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    if (isAdmin()) {
      adminPanel.classList.remove('hidden');
    } else {
      adminPanel.classList.add('hidden');
    }
  }

  const sorted = [...state.players].sort((a, b) => b.points - a.points || b.exactos - a.exactos);

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Nadie registrado aún. ¡Invita a tus compas!</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map((p, i) => {
    const medals = ['🥇', '🥈', '🥉'];
    const pos = i < 3 ? medals[i] : `${i + 1}`;
    const racha = getStreakEmoji(p.racha);
    return `
      <tr class="rank-${i + 1}">
        <td class="rank-pos">${pos}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="user-avatar" style="width:34px;height:34px;background:${p.color};font-size:14px;padding:0;overflow:hidden">
              ${p.photo
                ? `<img src="${p.photo}" alt="${p.name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`
                : p.name[0].toUpperCase()
              }
            </div>
            <strong>${p.name}</strong>
            ${p.name === state.currentPlayer?.name ? '<span style="font-size:11px;color:var(--gold);margin-left:4px">← Tú</span>' : ''}
          </div>
        </td>
        <td style="color:var(--gold)">${p.exactos}</td>
        <td style="color:#90b8ff">${p.ganadores}</td>
        <td class="rank-pts">${p.points}</td>
        <td class="rank-streak">${racha}</td>
      </tr>`;
  }).join('');
}

function getStreakEmoji(racha) {
  if (racha >= 5) return '🔥🔥🔥';
  if (racha >= 3) return '🔥🔥';
  if (racha >= 1) return '🔥';
  return '—';
}

function toggleAdminPanel() {
  const form = document.getElementById('admin-form');
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) {
    populateAdminPlayerSelect();
  }
}

function populateAdminMatchSelect() {
  const sel = document.getElementById('admin-match-select');
  if (!sel) return;
  GROUP_MATCHES.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `[Grp ${m.group}] ${m.home.flag} ${m.home.name} vs ${m.away.flag} ${m.away.name} (${m.date})`;
    sel.appendChild(opt);
  });
}

async function saveRealResult() {
  const matchId = parseInt(document.getElementById('admin-match-select').value);
  const home = parseInt(document.getElementById('admin-score-home').value);
  const away = parseInt(document.getElementById('admin-score-away').value);

  if (!matchId || isNaN(home) || isNaN(away)) {
    showToast('⚠️ Completa todos los campos', 'error');
    return;
  }

  showToast('⏳ Guardando resultado...');

  const realScore = { home, away };
  state.realResults[matchId] = realScore;

  // Apply to match locally
  const match = GROUP_MATCHES.find(m => m.id === matchId);
  if (match) match.realScore = realScore;

  if (USE_FIREBASE) {
    // Firebase: saveRealResultFirestore calcula y guarda puntos en la nube
    await saveRealResultFirestore(matchId, home, away);
    // El listener de onSnapshot actualizará el ranking automáticamente
  } else {
    // Fallback localStorage
    state.players.forEach(p => {
      const pred = p.predictions[matchId];
      if (pred && pred.home !== '' && pred.away !== '') {
        const pts = calcPoints(pred, realScore);
        p.points += pts;
        if (pts === 3) { p.exactos++; p.racha++; }
        else if (pts === 1) { p.ganadores++; p.racha++; }
        else { p.racha = 0; }
      }
    });
    saveState();
    renderRankingTable();
  }

  renderQuinielaSection();
  showToast(`✅ Resultado registrado: ${home}–${away}`);
  launchConfetti(2000);

  // Update current player header
  if (state.currentPlayer) {
    const cp = state.players.find(p => p.name === state.currentPlayer.name);
    document.getElementById('header-user-pts').textContent = `${cp?.points || 0} pts`;
  }
}

function calcPoints(pred, real) {
  if (pred.home === real.home && pred.away === real.away) return 3;
  const predResult = Math.sign(pred.home - pred.away);
  const realResult = Math.sign(real.home - real.away);
  if (predResult === realResult) return 1;
  return 0;
}

// =============================================
//  RULETA — WHEEL
// =============================================
function updateWheelGroups() {
  const filter = document.getElementById('wheel-group-filter')?.value || 'all';
  state.currentWheelGroup = filter;

  if (filter === 'all') {
    state.wheelTeams = Object.values(WORLD_CUP_GROUPS).flatMap(g =>
      g.teams.map(t => ({ ...t, group: Object.keys(WORLD_CUP_GROUPS).find(k => WORLD_CUP_GROUPS[k] === g) }))
    );
  } else {
    state.wheelTeams = WORLD_CUP_GROUPS[filter].teams.map(t => ({ ...t, group: filter }));
  }

  drawWheel();
}

function drawWheel() {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const teams = state.wheelTeams;
  const n = teams.length;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const colors = [
    '#1a2a5e','#2e1a5e','#5e1a2e','#1a5e3a','#5e4a1a','#1a4a5e',
    '#3a1a5e','#5e1a4a','#1a5e5e','#4a5e1a','#5e2e1a','#1a3a5e'
  ];

  teams.forEach((team, i) => {
    const startAngle = (i / n) * 2 * Math.PI + state.currentAngle;
    const endAngle = ((i + 1) / n) * 2 * Math.PI + state.currentAngle;
    const mid = (startAngle + endAngle) / 2;

    // Slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Flag text
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(mid);
    ctx.textAlign = 'right';
    ctx.font = `${n > 24 ? 14 : 18}px Arial`;
    ctx.fillText(team.flag, radius - 10, 6);
    if (n <= 16) {
      ctx.font = `bold ${n > 12 ? 9 : 11}px Outfit, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(team.name, radius - 32, 6);
    }
    ctx.restore();
  });

  // Center circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
  ctx.fillStyle = '#080c14';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pointer (top)
  ctx.beginPath();
  ctx.moveTo(centerX, 6);
  ctx.lineTo(centerX - 14, 30);
  ctx.lineTo(centerX + 14, 30);
  ctx.closePath();
  ctx.fillStyle = '#ffd700';
  ctx.fill();
}

function spinWheel() {
  if (state.wheelSpinning) return;
  state.wheelSpinning = true;

  const btn = document.getElementById('btn-spin');
  btn.disabled = true;
  document.getElementById('wheel-result').classList.add('hidden');

  const teams = state.wheelTeams;
  const n = teams.length;
  const sliceAngle = (2 * Math.PI) / n;
  const spinAmount = 6 * 2 * Math.PI + Math.random() * 2 * Math.PI;
  const duration = 4000;
  const startTime = performance.now();
  const startAngle = state.currentAngle;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    state.currentAngle = startAngle + spinAmount * easeOut(t);
    drawWheel();

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      state.wheelSpinning = false;
      btn.disabled = false;

      // Determine winner (pointer is at top = angle=0 from canvas top)
      // The slice at -PI/2 offset from top
      const normalizedAngle = ((state.currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const winnerIndex = Math.floor(n - (normalizedAngle / sliceAngle) % n) % n;
      const winner = teams[winnerIndex];

      showWheelResult(winner);
    }
  }

  requestAnimationFrame(animate);
}

function showWheelResult(team) {
  const result = document.getElementById('wheel-result');
  document.getElementById('result-flag').textContent = team.flag;
  document.getElementById('result-team-name').textContent = team.name;
  document.getElementById('result-team-group').textContent = `Grupo ${team.group} · FIFA Ranking #${team.rank}`;
  result.classList.remove('hidden');
  launchConfetti(1500);
}

// =============================================
//  SORTEO
// =============================================
function runSorteo() {
  const perPerson = parseInt(document.getElementById('teams-per-person').value) || 2;
  const players = state.players;

  if (players.length === 0) {
    showToast('⚠️ Regístrate primero en la app', 'error');
    return;
  }

  const allTeams = Object.entries(WORLD_CUP_GROUPS).flatMap(([gKey, g]) =>
    g.teams.map(t => ({ ...t, group: gKey }))
  );

  // Shuffle
  const shuffled = [...allTeams].sort(() => Math.random() - 0.5);

  const results = players.map((player, idx) => ({
    player,
    teams: shuffled.slice(idx * perPerson, (idx + 1) * perPerson)
  }));

  const container = document.getElementById('sorteo-results');
  container.innerHTML = results.map((r, i) => `
    <div class="sorteo-player-card" style="animation-delay:${i * 0.1}s">
      <div class="user-avatar" style="background:${r.player.color}">${r.player.name[0].toUpperCase()}</div>
      <div class="sorteo-player-name">${r.player.name}</div>
      <div class="sorteo-player-teams">
        ${r.teams.map(t => `
          <div class="sorteo-team-badge">${t.flag} ${t.name} <span style="color:var(--text-muted);font-size:11px">(Grp ${t.group})</span></div>
        `).join('')}
      </div>
    </div>`
  ).join('');

  container.classList.remove('hidden');
  launchConfetti(3000);
  showToast('🎲 ¡Sorteo realizado! Revisa tus equipos 🏆');
}

// =============================================
//  TRIVIA
// =============================================
function startTrivia() {
  state.currentTriviaQ = 0;
  state.triviaScore = 0;
  state.triviaAnswered = false;
  renderTriviaQuestion();
}

function renderTriviaQuestion() {
  const area = document.getElementById('trivia-area');
  const questions = TRIVIA_QUESTIONS;

  if (state.currentTriviaQ >= questions.length) {
    renderTriviaResult(questions.length);
    return;
  }

  const q = questions[state.currentTriviaQ];
  const progress = ((state.currentTriviaQ) / questions.length) * 100;

  area.innerHTML = `
    <div class="trivia-question-card">
      <div class="trivia-q-num">Pregunta ${state.currentTriviaQ + 1} de ${questions.length}</div>
      <div class="trivia-progress"><div class="trivia-progress-bar" style="width:${progress}%"></div></div>
      <div class="trivia-q-text">${q.q}</div>
      <div class="trivia-options">
        ${q.opts.map((opt, i) =>
          `<button class="trivia-opt" onclick="answerTrivia(${i})" id="opt-${i}">${opt}</button>`
        ).join('')}
      </div>
    </div>`;
}

function answerTrivia(idx) {
  if (state.triviaAnswered) return;
  state.triviaAnswered = true;

  const q = TRIVIA_QUESTIONS[state.currentTriviaQ];
  const correct = q.ans;

  document.querySelectorAll('.trivia-opt').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add('correct');
    else if (i === idx) btn.classList.add('wrong');
  });

  if (idx === correct) state.triviaScore++;

  // Add explanation
  const area = document.getElementById('trivia-area');
  const exp = document.createElement('div');
  exp.style.cssText = 'margin-top:16px;padding:12px 16px;background:rgba(255,215,0,0.08);border-radius:10px;font-size:14px;color:var(--text-secondary);';
  exp.textContent = `💡 ${q.exp}`;
  area.querySelector('.trivia-question-card').appendChild(exp);

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-primary';
  nextBtn.style.marginTop = '16px';
  nextBtn.textContent = state.currentTriviaQ + 1 < TRIVIA_QUESTIONS.length ? 'Siguiente →' : '¡Ver resultados! 🏆';
  nextBtn.onclick = () => {
    state.currentTriviaQ++;
    state.triviaAnswered = false;
    renderTriviaQuestion();
  };
  area.querySelector('.trivia-question-card').appendChild(nextBtn);
}

function renderTriviaResult(total) {
  const area = document.getElementById('trivia-area');
  const pct = Math.round((state.triviaScore / total) * 100);
  let msg = '';
  if (pct === 100) msg = '¡Eres el crack del Mundial! 🏆';
  else if (pct >= 80) msg = '¡Muy buen mundialista! ⭐';
  else if (pct >= 60) msg = '¡Sabes de fútbol! 👍';
  else if (pct >= 40) msg = 'Hay que estudiar más futbol 😅';
  else msg = 'Suerte en los pronósticos 😂';

  area.innerHTML = `
    <div class="trivia-result">
      <div class="score-circle">${state.triviaScore}/${total}</div>
      <h3>${msg}</h3>
      <p>Respondiste ${state.triviaScore} de ${total} preguntas correctamente (${pct}%)</p>
      <button class="btn-primary btn-glow" onclick="startTrivia()">🔄 Jugar otra vez</button>
    </div>`;

  if (pct >= 60) launchConfetti(3000);
}

// =============================================
//  RULETA TABS
// =============================================
function switchRuleta(tab, btn) {
  document.querySelectorAll('.ruleta-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['equipo', 'sorteo', 'desafio'].forEach(t => {
    document.getElementById(`ruleta-${t}`)?.classList.toggle('hidden', t !== tab);
  });
  state.currentRuletaTab = tab;
}

// =============================================
//  CONFETTI
// =============================================
function launchConfetti(duration = 3000) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colors = ['#ffd700','#ff6b35','#00c853','#2979ff','#e91e63','#fff'];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10,
      w: Math.random() * 12 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      angle: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.2
    });
  }

  const start = performance.now();
  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.va;
      p.vy += 0.05;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (now - start < duration) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(draw);
}

// =============================================
//  TOAST
// =============================================
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// =============================================
//  RESIZE
// =============================================
window.addEventListener('resize', () => {
  updateWheelGroups();
});

// =============================================
//  FUNCIONES PANEL ADMIN
// =============================================

function populateAdminPlayerSelect() {
  const sel = document.getElementById('admin-player-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona un jugador —</option>';
  const sortedPlayers = [...state.players].sort((a, b) => a.name.localeCompare(b.name));
  sortedPlayers.forEach(p => {
    const opt = document.createElement('option');
    const playerKey = p.uid || p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    opt.value = playerKey;
    opt.textContent = `${p.name} (${p.email || 'Local'})`;
    sel.appendChild(opt);
  });
}

async function deletePlayerBtn() {
  const playerKey = document.getElementById('admin-player-select').value;
  if (!playerKey) {
    showToast('⚠️ Selecciona un jugador para eliminar', 'error');
    return;
  }
  
  const p = state.players.find(x => (x.uid === playerKey || x.id === playerKey || x.name.toLowerCase().replace(/[^a-z0-9]/g, '_') === playerKey));
  const pName = p ? p.name : playerKey;

  if (!confirm(`¿Estás seguro de que quieres eliminar por completo a "${pName}"? Esto borrará sus datos y pronósticos de forma permanente.`)) {
    return;
  }

  showToast('⏳ Eliminando jugador...');
  
  if (USE_FIREBASE) {
    const { doc, deleteDoc } = FB;
    try {
      await deleteDoc(doc(db, 'players', playerKey));
      showToast(`✅ Jugador ${pName} eliminado de Firestore`);
    } catch (err) {
      console.error('Error al borrar jugador de Firestore:', err);
      showToast('❌ Error al borrar de Firestore', 'error');
    }
  } else {
    state.players = state.players.filter(x => (x.uid !== playerKey && x.id !== playerKey && x.name.toLowerCase().replace(/[^a-z0-9]/g, '_') !== playerKey));
    saveState();
    renderRankingTable();
    showToast(`✅ Jugador ${pName} eliminado localmente`);
  }
  populateAdminPlayerSelect();
}

async function resetAllScoresBtn() {
  if (!confirm('⚠️ ¿Estás seguro de que quieres REINICIAR todos los marcadores reales? Esto pondrá los puntos y estadísticas de TODOS los jugadores en 0, pero mantendrá sus pronósticos intactos.')) {
    return;
  }

  showToast('⏳ Reiniciando marcadores...');

  state.realResults = {};
  GROUP_MATCHES.forEach(m => {
    m.realScore = null;
  });

  if (USE_FIREBASE) {
    const { doc, deleteDoc } = FB;
    try {
      for (let id = 1; id <= 104; id++) {
        await deleteDoc(doc(db, 'results', String(id)));
      }
      await recalculateAllPointsFirestore();
      showToast('✅ Marcadores y puntos reiniciados en la nube');
    } catch (err) {
      console.error('Error al reiniciar marcadores en Firestore:', err);
      showToast('❌ Error en Firebase', 'error');
    }
  } else {
    state.players.forEach(p => {
      p.points = 0;
      p.exactos = 0;
      p.ganadores = 0;
      p.racha = 0;
    });
    saveState();
    renderRankingTable();
    showToast('✅ Marcadores y puntos reiniciados localmente');
  }
  
  renderQuinielaSection();
  launchConfetti(1500);
}

async function clearAllDataBtn() {
  if (!confirm('🚨 ATENCIÓN: Esto borrará ABSOLUTAMENTE TODOS los datos (jugadores, pronósticos y marcadores reales). La app quedará totalmente vacía. ¿Deseas continuar?')) {
    return;
  }
  
  const doubleCheck = prompt('Para confirmar la eliminación total, escribe la palabra "BORRAR":');
  if (doubleCheck !== 'BORRAR') {
    showToast('❌ Cancelado. Texto de confirmación incorrecto.');
    return;
  }

  showToast('⏳ Borrando base de datos...');

  if (USE_FIREBASE) {
    const { doc, deleteDoc } = FB;
    try {
      for (let id = 1; id <= 104; id++) {
        await deleteDoc(doc(db, 'results', String(id)));
      }
      for (const p of state.players) {
        const pKey = p.uid || p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        await deleteDoc(doc(db, 'players', pKey));
      }
      showToast('✅ Base de datos borrada con éxito.');
      setTimeout(() => {
        location.reload();
      }, 1500);
    } catch (err) {
      console.error('Error al borrar la base de datos:', err);
      showToast('❌ Error al borrar datos en Firestore', 'error');
    }
  } else {
    localStorage.removeItem('mundialistas_snsp_2026');
    showToast('✅ Datos locales borrados con éxito.');
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}

// Exponer funciones globalmente para los controladores onclick en HTML
window.signInWithGoogle = signInWithGoogle;
window.enterApp = enterApp;
window.showSection = showSection;
window.savePredictions = savePredictions;
window.toggleAdminPanel = toggleAdminPanel;
window.saveRealResult = saveRealResult;
window.switchPhase = switchPhase;
window.switchRuleta = switchRuleta;
window.spinWheel = spinWheel;
window.runSorteo = runSorteo;
window.startTrivia = startTrivia;
window.answerTrivia = answerTrivia;
window.updateWheelGroups = updateWheelGroups;
window.deletePlayerBtn = deletePlayerBtn;
window.resetAllScoresBtn = resetAllScoresBtn;
window.clearAllDataBtn = clearAllDataBtn;
