import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyArjDsAfi0pzNj9Ovc-FIyWdMKzRZIpaFw",
    authDomain: "gridify-hr-management.firebaseapp.com",
    projectId: "gridify-hr-management",
    storageBucket: "gridify-hr-management.firebasestorage.app",
    messagingSenderId: "286876940991",
    appId: "1:286876940991:web:1dfd338afb0460e773a40a",
    measurementId: "G-0TMLXSZ380"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Commented out unused services to silence "Authorized Domain" console warnings during local development
// const auth = getAuth(app);
// const storage = getStorage(app);
// const functions = getFunctions(app);

export { app, analytics, db };
