import { auth, db } from '../../../assets/js/config-v3.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    getDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Hardcoded Admin Emails (for Development/Demo)
const ADMIN_EMAILS = [
    'admin@gridify.in',
    'superadmin@gridify.in'
];

// Login Super Admin
export const loginSuperAdmin = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Strict Admin Check
        const isEmailAdmin = ADMIN_EMAILS.includes(user.email);

        // Also check Firestore role for flexibility
        let isRoleAdmin = false;
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                isRoleAdmin = true;
            }
        } catch (e) {
            console.warn("Could not check role:", e);
        }

        if (!isEmailAdmin && !isRoleAdmin) {
            await signOut(auth); // Log out immediately
            throw new Error('Unauthorized Access: You do not have super admin privileges.');
        }

        // Update last active if user doc exists
        try {
            await updateDoc(doc(db, "users", user.uid), {
                lastActive: serverTimestamp()
            });
        } catch (e) {
            // Ignore if doc doesn't exist (e.g. fresh admin account)
        }

        window.location.href = '../dashboard/index.html';
    } catch (error) {
        console.error("Admin Login Error:", error);
        if (error.code === 'auth/invalid-credential') {
            throw new Error("Invalid email or password.");
        }
        throw error;
    }
};

// Logout Admin
export const logoutAdmin = async () => {
    try {
        await signOut(auth);
        window.location.href = '../login/index.html';
    } catch (error) {
        console.error("Logout Error:", error);
        throw error;
    }
};

// Admin Auth Guard
export const checkAdminAuth = (redirectIfNotLoggedIn = true) => {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Double Check Context on Page Load
                const isEmailAdmin = ADMIN_EMAILS.includes(user.email);
                let isRoleAdmin = false;

                if (!isEmailAdmin) {
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists() && userDoc.data().role === 'admin') {
                            isRoleAdmin = true;
                        }
                    } catch (e) {
                        // silently fail
                    }
                }

                if (isEmailAdmin || isRoleAdmin) {
                    resolve(user);
                } else {
                    // Not authorized
                    if (redirectIfNotLoggedIn) {
                        await signOut(auth);
                        window.location.href = '../login/index.html';
                    }
                    resolve(null);
                }
            } else {
                if (redirectIfNotLoggedIn) {
                    window.location.href = '../login/index.html';
                }
                resolve(null);
            }
        });
    });
};
