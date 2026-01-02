// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBHoqE-sFSApRaQGBxQ0BXGH1XJJY1zCqk",
    authDomain: "grd-vc-12ca7.firebaseapp.com",
    projectId: "grd-vc-12ca7",
    storageBucket: "grd-vc-12ca7.firebasestorage.app",
    messagingSenderId: "430905544172",
    appId: "1:430905544172:web:f7658f57613b4d5b8604c9",
    measurementId: "G-8RDTBK32M6",
    databaseURL: "https://grd-vc-12ca7-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { auth, db, rtdb };
