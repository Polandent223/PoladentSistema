// 🔥 CONFIGURACIÓN FIREBASE
const firebaseConfig = {
  apiKey:"AIzaSyAFOyMEo2SgWpcs8WHp2nKCO_ax9-lYZWo",
  authDomain:"poladent-5fa13.firebaseapp.com",
  databaseURL:"https://poladent-5fa13-default-rtdb.firebaseio.com",
  projectId:"poladent-5fa13",
  storageBucket:"poladent-5fa13.firebasestorage.app",
  messagingSenderId:"539152567873",
  appId:"1:539152567873:web:89c67ebb14bd55a77900c0"
};
// 🔹 INICIALIZAR FIREBASE (ESTO FALTABA)
firebase.initializeApp(firebaseConfig);

// 🔹 VARIABLES QUE USA app.js
const auth = firebase.auth();
const db = firebase.database();
