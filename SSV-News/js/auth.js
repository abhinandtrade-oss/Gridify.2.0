// auth.js - Authentication logic
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const USERS_COL = 'users';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-msg');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;

            try {
                showLoader('Authenticating...');
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Check user role in Firestore
                const userDocRef = doc(db, USERS_COL, user.email);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userData.active === false) {
                        await signOut(auth);
                        if (errorMsg) {
                            errorMsg.textContent = "Your account is deactivated. Contact Admin.";
                            errorMsg.style.display = 'block';
                        }
                        return;
                    }
                    // Redirect to dashboard
                    location.href = 'admin/dashboard.html';
                } else {
                    // User data missing or deleted
                    await signOut(auth);
                    if (errorMsg) {
                        errorMsg.textContent = "Account not found or access revoked.";
                        errorMsg.style.display = 'block';
                    }
                    return;
                }
            } catch (error) {
                console.error("Login error:", error);
                if (errorMsg) {
                    errorMsg.style.display = 'block';
                    errorMsg.textContent = "Invalid email or password.";
                }
            } finally {
                hideLoader();
            }
        });
    }

    // Auth state observer for other pages
    onAuthStateChanged(auth, user => {
        if (!user && window.location.pathname.includes('/admin/')) {
            window.location.href = '../login.html';
        }
    });
});
