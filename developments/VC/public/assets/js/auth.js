import { auth, db } from './config-v3.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Register User
export const registerUser = async (email, password, name) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update displayName in Auth
        await updateProfile(user, { displayName: name });

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
        throw error;
    }
};

// Login User
export const loginUser = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Update last active
        if (auth.currentUser) {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                lastActive: serverTimestamp()
            });
        }
        window.location.href = '../dashboard/index.html';
    } catch (error) {
        console.error("Login Error:", error);
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
