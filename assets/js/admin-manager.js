/*
 * Admin Manager (Firebase Firestore Edition)
 * Handles admin authentication and management using Firebase Firestore.
 */

import { db } from './firebase-config.js';
import {
    collection, getDocs, doc, setDoc, deleteDoc, updateDoc,
    query, where, getDoc, addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const ADMIN_STORAGE_KEY = 'gridify_admin_session';
const SESSION_TIMEOUT = 120 * 1000; // 120 Seconds
const USERS_COLLECTION = 'users';
const COUPONS_COLLECTION = 'coupons';

class AdminManager {
    static GAS_URL = 'https://script.google.com/macros/s/AKfycbz1YjSVMjZYuouVG62jeCqaIUzyvXa_YNPYQQ2f_WegU0hVqzRWMDrnDICfjev-i69Ksw/exec';

    static async login(username, password) {
        try {
            console.log(`Attempting login for ${username}...`);
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", username));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return { success: false, message: "User not found" };
            }

            let user = null;
            querySnapshot.forEach((doc) => {
                user = doc.data();
            });

            if (user.password === password) {
                if (user.status !== 'active') {
                    return { success: false, message: "Account suspended" };
                }

                // Success
                this.startSession(user.username, user.role, user.allowedPrograms || []);
                return { success: true, role: user.role };
            } else {
                return { success: false, message: "Invalid password" };
            }
        } catch (error) {
            console.error("Login Error:", error);
            return { success: false, message: "Network Error: " + error.message };
        }
    }

    static startSession(username, role, allowedPrograms = []) {
        const session = {
            username: username,
            role: role,
            allowedPrograms: allowedPrograms,
            loginTime: Date.now(),
            lastActivity: Date.now()
        };
        sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
        this.initAutoLogout();
    }

    static getSession() {
        const data = sessionStorage.getItem(ADMIN_STORAGE_KEY);
        if (!data) return null;
        return JSON.parse(data);
    }

    static logout() {
        sessionStorage.removeItem(ADMIN_STORAGE_KEY);
        window.location.reload();
    }

    static initAutoLogout() {
        if (window.autoLogoutInterval) clearInterval(window.autoLogoutInterval);

        ['click', 'mousemove', 'keypress'].forEach(evt => {
            document.addEventListener(evt, () => {
                const session = this.getSession();
                if (session) {
                    session.lastActivity = Date.now();
                    sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
                }
            });
        });

        window.autoLogoutInterval = setInterval(() => {
            const session = this.getSession();
            if (session) {
                const now = Date.now();
                if (now - session.lastActivity > SESSION_TIMEOUT) {
                    this.logout();
                }
            }
        }, 5000);
    }

    // --- USER MANAGEMENT ---
    static async getUsers() {
        const session = this.getSession();
        if (!session || session.role !== 'admin') return [];

        try {
            const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
            let users = [];
            querySnapshot.forEach((doc) => {
                users.push(doc.data());
            });
            return users;
        } catch (e) {
            console.error("Error getting users", e);
            return [];
        }
    }

    // Creates a new user (Admin or Normal User)
    static async addUser(username, password, role, allowedPrograms = []) {
        const session = this.getSession();
        // Allow any admin to create users
        if (!session || session.role !== 'admin') throw new Error("Unauthorized");

        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", username));
            const snap = await getDocs(q);
            if (!snap.empty) throw new Error("User already exists");

            await addDoc(collection(db, USERS_COLLECTION), {
                username: username,
                password: password,
                role: role,
                allowedPrograms: allowedPrograms,
                status: 'active',
                createdAt: new Date().toISOString()
            });

            return true;
        } catch (e) {
            console.error("Add User Error", e);
            throw e;
        }
    }

    static async toggleUserStatus(targetUser) {
        const session = this.getSession();
        if (!session || session.role !== 'admin') throw new Error("Unauthorized");

        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", targetUser));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach(async (d) => {
                const data = d.data();
                const newStatus = data.status === 'active' ? 'suspended' : 'active';
                await updateDoc(doc(db, USERS_COLLECTION, d.id), { status: newStatus });
            });
        } catch (e) {
            console.error("Toggle User Error", e);
        }
    }

    static async updateUserDetails(targetUser, role, programs) {
        const session = this.getSession();
        if (!session || session.role !== 'admin') throw new Error("Unauthorized");

        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", targetUser));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) throw new Error("User not found");

            querySnapshot.forEach(async (d) => {
                await updateDoc(doc(db, USERS_COLLECTION, d.id), {
                    role: role,
                    allowedPrograms: programs
                });
            });
        } catch (e) {
            throw e;
        }
    }

    // --- DEFAULTS MANAGEMENT ---
    static async saveDefaultPrograms(programs) {
        const session = this.getSession();
        if (!session || session.role !== 'admin') throw new Error("Unauthorized");

        try {
            // 1. Save Global Defaults
            const docRef = doc(db, 'settings', 'global');
            await setDoc(docRef, { defaultPrograms: programs }, { merge: true });

            // 2. Retroactively Update ALL Existing 'user' role accounts
            const q = query(collection(db, USERS_COLLECTION), where("role", "==", "user"));
            const querySnapshot = await getDocs(q);

            const updatePromises = [];
            querySnapshot.forEach((d) => {
                updatePromises.push(updateDoc(doc(db, USERS_COLLECTION, d.id), { allowedPrograms: programs }));
            });

            await Promise.all(updatePromises);
            console.log(`Updated ${updatePromises.length} existing users with new defaults.`);

        } catch (e) {
            console.error("Save Defaults Error", e);
            throw e;
        }
    }

    static async getDefaultPrograms() {
        try {
            const docRef = doc(db, 'settings', 'global');
            const d = await getDoc(docRef);
            if (d.exists()) {
                const data = d.data().defaultPrograms || [];
                console.log("Defaults fetched:", data);
                return data;
            }
            console.log("No default settings doc found.");
            return [];
        } catch (e) {
            console.error("Get Defaults Error (likely permissions):", e);
            return [];
        }
    }

    static async deleteUser(targetUser) {
        const session = this.getSession();
        if (!session || session.role !== 'admin') throw new Error("Unauthorized");

        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", targetUser));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(async (d) => {
                await deleteDoc(doc(db, USERS_COLLECTION, d.id));
            });
        } catch (e) {
            console.error("Delete User Error", e);
            throw e;
        }
    }

    static async changePassword(oldPass, newPass) {
        const session = this.getSession();
        if (!session) return { status: 'error', message: 'No session' };

        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", session.username));
            const snap = await getDocs(q);
            let userDoc = null;
            snap.forEach((d) => { userDoc = d; });

            if (!userDoc || userDoc.data().password !== oldPass) {
                return { status: 'error', message: 'Incorrect old password' };
            }

            await updateDoc(doc(db, USERS_COLLECTION, userDoc.id), { password: newPass });
            return { status: 'success' };
        } catch (e) {
            return { status: 'error', message: e.message };
        }
    }

    // --- OTP LOGIC (GAS) ---

    static async sendOtp(email) {
        try {
            const response = await fetch(this.GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'send_otp', email: email })
            });
            const data = await response.json();
            return data;
        } catch (e) {
            return { result: 'error', error: e.toString() };
        }
    }

    static async verifyOtp(email, otp) {
        try {
            const response = await fetch(this.GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'verify_otp', email: email, otp: otp })
            });
            const data = await response.json();
            return data;
        } catch (e) {
            return { result: 'error', error: e.toString() };
        }
    }

    static async registerUser(email, password) {
        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", email));
            const snap = await getDocs(q);
            if (!snap.empty) return { success: false, message: "User already exists" };

            // Fetch Defaults
            const defaults = await this.getDefaultPrograms();
            console.log(`Registering user ${email} with defaults:`, defaults);

            await addDoc(collection(db, USERS_COLLECTION), {
                username: email,
                password: password,
                role: 'user',
                allowedPrograms: defaults,
                status: 'active',
                createdAt: new Date().toISOString()
            });
            return { success: true };
        } catch (e) {
            return { success: false, message: e.toString() };
        }
    }

    static async resetPassword(email, newPass) {
        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", email));
            const snap = await getDocs(q);
            if (snap.empty) return { success: false, message: "User not found" };

            let id;
            snap.forEach(d => id = d.id);

            await updateDoc(doc(db, USERS_COLLECTION, id), { password: newPass });
            return { success: true };
        } catch (e) {
            return { success: false, message: e.toString() };
        }
    }

    // --- DATA SYNC ---
    static async getLatestData(email, sheetName = 'builder') {
        const response = await fetch(this.GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'fetch_data', email: email, sheetName: sheetName })
        });
        return await response.json();
    }

    // --- UTILS ---
    static async getCoupons() {
        try {
            const querySnapshot = await getDocs(collection(db, COUPONS_COLLECTION));
            let coupons = [];
            querySnapshot.forEach((doc) => {
                coupons.push(doc.data());
            });
            return coupons;
        } catch (e) {
            return [];
        }
    }

    static async addCoupon(code, type, value) {
        const session = this.getSession();
        if (!session || session.role !== 'admin') throw new Error("Unauthorized");

        const q = query(collection(db, COUPONS_COLLECTION), where("code", "==", code));
        const snap = await getDocs(q);
        if (!snap.empty) throw new Error("Code exists");

        await addDoc(collection(db, COUPONS_COLLECTION), {
            code, type, value: Number(value), status: 'active', createdAt: new Date().toISOString()
        });
    }

    static async deleteCoupon(code) {
        const session = this.getSession();
        if (!session || session.role !== 'admin') throw new Error("Unauthorized");

        const q = query(collection(db, COUPONS_COLLECTION), where("code", "==", code));
        const snap = await getDocs(q);
        snap.forEach(async (d) => {
            await deleteDoc(doc(db, COUPONS_COLLECTION, d.id));
        });
    }

    static async setupInitialAdmin() {
        const username = "abhinand";
        const password = "admin123";

        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", username));
            const snap = await getDocs(q);

            if (!snap.empty) {
                return { success: false, message: "Admin user 'abhinand' already exists." };
            }

            await addDoc(collection(db, USERS_COLLECTION), {
                username: username,
                password: password,
                role: 'admin',
                allowedPrograms: ['builder', 'scanner', 'admin'],
                status: 'active',
                createdAt: new Date().toISOString()
            });

            return { success: true, message: `Admin created!` };
        } catch (e) {
            return { success: false, message: "Error: " + e.message };
        }
    }
}

// Make it global for inline scripts in list.html
window.AdminManager = AdminManager;
export { AdminManager };
