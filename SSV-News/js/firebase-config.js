// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBX0dFRpWoWe61ApSGQLm_hlPOmgDYj93E",
    authDomain: "chronicles-ssv.firebaseapp.com",
    projectId: "chronicles-ssv",
    storageBucket: "chronicles-ssv.firebasestorage.app",
    messagingSenderId: "713446458610",
    appId: "1:713446458610:web:b5efc60f48def41ad8bc6b",
    measurementId: "G-WCRNMTBE89"
};

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, firebaseConfig };
