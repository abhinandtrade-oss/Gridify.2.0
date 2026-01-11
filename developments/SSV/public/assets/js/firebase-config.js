const firebaseConfig = {
    apiKey: "AIzaSyDNLYdo2Ko2IIUQzpgWTq9ckTy_JGpZvPM",
    authDomain: "ssv-events.firebaseapp.com",
    projectId: "ssv-events",
    storageBucket: "ssv-events.firebasestorage.app",
    messagingSenderId: "541327565780",
    appId: "1:541327565780:web:1ca3aace43eeefb2e76c41",
    measurementId: "G-9MKN42BRXX"
};

// Initialize Firebase (Compat)
// We use the compat libraries in HTML so we stick to namespaced init
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);

    // Initialize services
    var db = firebase.firestore();
    var auth = firebase.auth();

    // Optional: Analytics
    if (firebase.analytics) {
        firebase.analytics();
    }
} else {
    console.error("Firebase SDK not loaded.");
}
