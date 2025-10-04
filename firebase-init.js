// firebase-init.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxxN6Fh9NPeY5O7tpvZEOu3X5kbXsJ5Nw",
  authDomain: "flaskart-6b1c9.firebaseapp.com",
  projectId: "flaskart-6b1c9",
  storageBucket: "flaskart-6b1c9.firebasestorage.app",
  messagingSenderId: "25479701217",
  appId: "1:25479701217:web:44cedffb2717e14ea18da0",
  measurementId: "G-JB7J6N3P37"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Bu fonksiyon, bir sayfanın sadece giriş yapmış kullanıcılar tarafından
// görüntülenmesini sağlar. Kullanıcı giriş yapmamışsa login sayfasına yönlendirir.
function requireAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe(); // Listener'ı hemen kaldırarak hafıza sızıntısını önle
      if (user) {
        resolve(user);
      } else {
        console.log("Kullanıcı giriş yapmamış, yönlendiriliyor...");
        window.location.href = 'login.html';
        reject('Authentication required');
      }
    });
  });
}

export { app, auth, db, requireAuth };