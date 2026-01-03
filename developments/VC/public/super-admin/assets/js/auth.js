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
    updateDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Login Super Admin
export const loginSuperAdmin = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check Firestore role for permissions
        let hasPrivilege = false;

        // BOOTSTRAP: Ensure main admins used in development/production are set correctly in DB
        // This runs on every login to ensure permissions are always up to date for these keys.
        if (email === 'admin@gridify.in' || email === 'superadmin@gridify.in') {
            try {
                await setDoc(doc(db, "users", user.uid), {
                    email: email,
                    role: 'super_admin',
                    lastActive: serverTimestamp()
                }, { merge: true });
                hasPrivilege = true; // Auto-grant for these specific emails
            } catch (e) {
                console.error("Bootstrap failed", e);
            }
        }

        if (!hasPrivilege) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const role = userDoc.data().role;
                    if (role === 'admin' || role === 'super_admin') {
                        hasPrivilege = true;
                    }
                }
            } catch (e) {
                console.warn("Could not check role:", e);
            }
        }

        if (!hasPrivilege) {
            await signOut(auth); // Log out immediately
            throw new Error('Unauthorized Access: You do not have admin privileges.');
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
                let isAuthorized = false;

                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const role = userDoc.data().role;
                        if (role === 'admin' || role === 'super_admin') {
                            isAuthorized = true;
                        }
                    }
                } catch (e) {
                    // silently fail
                }

                if (isAuthorized) {
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
