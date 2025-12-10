// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Your web app's Firebase configuration
// REPLACE THE VLAUES BELOW WITH YOUR KEY FROM FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyD9G64Wu-hOHadZUfk9EG8MaXfqL7T9-F0",
    authDomain: "grfy-b1731.firebaseapp.com",
    projectId: "grfy-b1731",
    storageBucket: "grfy-b1731.firebasestorage.app",
    messagingSenderId: "376190086826",
    appId: "1:376190086826:web:71c268ada23c4163f02ad3",
    measurementId: "G-M45BCQPTPV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
