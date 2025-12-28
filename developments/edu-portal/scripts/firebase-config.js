// Firebase Configuration & Initialization
// using compat libraries via Global Namespace (CDN)

import "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js";

const defaultFirebaseConfig = {
    apiKey: "AIzaSyAgqdWaukdkrCfOnad6qKmMtMdrQwJCLig",
    authDomain: "gridify-sub-projects.firebaseapp.com",
    projectId: "gridify-sub-projects",
    storageBucket: "gridify-sub-projects.firebasestorage.app",
    messagingSenderId: "267674314556",
    appId: "1:267674314556:web:14ae62fa950c73b09ee039",
    measurementId: "G-M4K3V143JP"
};

// Check for override
const savedConfig = localStorage.getItem('firebase_config_override');
const firebaseConfig = savedConfig ? JSON.parse(savedConfig) : defaultFirebaseConfig;

// Initialize Firebase
// Compat libraries pollute the global 'firebase' namespace
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Make them globally available for legacy scripts
window.firebaseConfig = firebaseConfig;
window.firebaseApp = app;
window.auth = auth;
window.db = db;

console.log("Firebase initialized (Global Namespace Mode)");

// Export for module usage
export { app, auth, db };