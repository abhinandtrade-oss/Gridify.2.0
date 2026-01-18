// setup-admin.js - Initialization logic for first user
import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, limit, query, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const setupMessage = document.getElementById('setup-message');
    const setupForm = document.getElementById('setup-form');

    try {
        // Check if any users exist
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            setupMessage.textContent = "The system is already initialized. Please go to the login page.";
            setupMessage.className = "message info";
            if (setupForm) setupForm.style.display = 'none';
        }
    } catch (error) {
        console.error("Initialization check error:", error);
        if (setupMessage) {
            setupMessage.textContent = "Error checking system status. Check console for details.";
            setupMessage.style.color = "#d9534f";
        }
    }

    if (setupForm) {
        setupForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('admin-name').value;
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;

            const btn = setupForm.querySelector('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing...';
            btn.disabled = true;

            try {
                // 1. Create Auth User
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Create User Profile in Firestore as Admin
                await setDoc(doc(db, 'users', email), {
                    displayName: name,
                    email: email,
                    role: 'admin',
                    active: true,
                    createdAt: serverTimestamp()
                });

                setupMessage.textContent = "Super Admin created successfully! Redirecting to login...";
                setupMessage.className = "message success";
                setupMessage.style.color = "#28a745";

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } catch (error) {
                console.error("Setup error:", error);
                setupMessage.textContent = "Error: " + error.message;
                setupMessage.style.color = "#d9534f";
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };
    }
});
