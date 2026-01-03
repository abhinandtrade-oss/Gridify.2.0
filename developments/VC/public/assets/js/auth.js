import { auth, db } from './config-v3.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    signInAnonymously,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Fetch Public Configuration
export const getPublicConfig = async () => {
    try {
        const docRef = doc(db, "config", "public");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null; // or default config?
        }
    } catch (error) {
        console.error("Error fetching config:", error);
        return null;
    }
};

// Real-time Configuration Listener
export const subscribeToPublicConfig = (callback) => {
    const docRef = doc(db, "config", "public");
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback(null);
        }
    });
};

// Verify Configuration (Guard)
const verifyConfig = async (action) => {
    const config = await getPublicConfig();
    if (!config) return; // Open by default if no config? Or strict? Let's assume open.

    if (config.maintenanceMode) {
        // Check if grace period active? simplified:
        throw new Error("System is currently in maintenance mode. Please try again later.");
    }

    if (action === 'registration' && config.registrationEnabled === false) {
        throw new Error("New user registration is currently disabled.");
    }

    if (action === 'guest' && config.guestAccess === false) {
        throw new Error("Guest access is currently disabled.");
    }

    if (action === 'google' && config.googleAuthEnabled === false) {
        throw new Error("Google authentication is currently disabled.");
    }
};

// Register User
export const registerUser = async (email, password, name) => {
    try {
        await verifyConfig('registration');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update displayName in Auth
        await updateProfile(user, { displayName: name });

        // Check if verification is required
        const config = await getPublicConfig();
        if (config && config.emailVerificationRequired) {
            await sendEmailVerification(user);
            await signOut(auth); // Force logout to enforce subsequent login check
            throw new Error("Account created! A verification email has been sent. Please verify your email before logging in.");
        }

        // Create user profile in Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp()
        });

        window.location.href = '../dashboard/index.html';
    } catch (error) {
        console.error("Registration Error:", error);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("Email is already registered. Please login.");
        }
        throw error;
    }
};

// Login User
export const loginUser = async (email, password) => {
    try {
        await verifyConfig('login');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check Verification
        const config = await getPublicConfig();
        if (config && config.emailVerificationRequired && !user.emailVerified) {
            await signOut(auth);
            throw new Error("Please verify your email address before logging in.");
        }

        // Update last active
        if (auth.currentUser) {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                lastActive: serverTimestamp()
            });
        }
        window.location.href = '../dashboard/index.html';
    } catch (error) {
        console.error("Login Error:", error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            throw new Error("Invalid email or password.");
        }
        throw error;
    }
};

// Login with Google
export const loginWithGoogle = async () => {
    try {
        await verifyConfig('google');
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            // Create user profile in Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                photoURL: user.photoURL,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp()
            });
        } else {
            // Update last active
            await updateDoc(doc(db, "users", user.uid), {
                lastActive: serverTimestamp()
            });
        }

        window.location.href = '../dashboard/index.html';
    } catch (error) {
        console.error("Google Sign-in Error:", error);
        throw error;
    }
};

// Continue as Guest
export const continueAsGuest = async () => {
    try {
        await verifyConfig('guest');
        await signInAnonymously(auth);
        window.location.href = '../dashboard/index.html';
    } catch (error) {
        console.error("Guest Sign-in Error:", error);
        throw error;
    }
};

// Forgot Password
export const sendPasswordReset = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return "Password reset email sent! Check your inbox.";
    } catch (error) {
        console.error("Reset Password Error:", error);
        if (error.code === 'auth/user-not-found') {
            throw new Error("No account found with this email.");
        }
        throw error;
    }
};

// Logout User
export const logoutUser = async () => {
    try {
        await signOut(auth);
        window.location.href = '../auth/login.html';
    } catch (error) {
        console.error("Logout Error:", error);
        throw error;
    }
};

// Auth Guard (Check if user is logged in)
export const checkAuth = (redirectIfNotLoggedIn = true) => {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                resolve(user);
            } else {
                if (redirectIfNotLoggedIn) {
                    window.location.href = '../auth/login.html';
                }
                resolve(null);
            }
        });
    });
};
