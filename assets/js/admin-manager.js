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

            // In a real app, use hashed passwords! 
            // For data migration parity, we are comparing plaintext if that's what was used, 
            // or simply accepting that this is a basic implementation.
            if (user.password === password) {
                if (user.status !== 'active') {
                    return { success: false, message: "Account suspended" };
                }
                this.startSession(user.username, user.role);
                return { success: true };
            } else {
                return { success: false, message: "Invalid password" };
            }
        } catch (error) {
            console.error("Login Error:", error);
            return { success: false, message: "Network Error: " + error.message };
        }
    }

    static startSession(username, role) {
        const session = {
            username: username,
            role: role,
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
        console.log("AutoLogout Initialized");
        // Activity Listeners
        ['click', 'mousemove', 'keypress'].forEach(evt => {
            document.addEventListener(evt, () => {
                const session = this.getSession();
                if (session) {
                    session.lastActivity = Date.now();
                    sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
                }
            });
        });

        // Check Interval
        setInterval(() => {
            const session = this.getSession();
            if (session) {
                const now = Date.now();
                if (now % 30000 < 5000) console.log("Checking session...", (now - session.lastActivity) / 1000, "s Activity");

                if (now - session.lastActivity > SESSION_TIMEOUT) {
                    console.warn("Session Expired!");
                    alert("Session expired due to inactivity.");
                    this.logout();
                }
            }
        }, 5000);
    }

    // --- USER MANAGEMENT ---
    static async getUsers() {
        const session = this.getSession();
        // Basic role check
        if (!session || session.username !== 'abhinand') return [];

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

    static async addUser(newUser) {
        const newPass = Math.random().toString(36).slice(-8);
        const session = this.getSession();

        if (!session || session.username !== 'abhinand') throw new Error("Unauthorized");

        try {
            // Check if user exists
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", newUser));
            const snap = await getDocs(q);
            if (!snap.empty) throw new Error("User already exists");

            // Add user
            // We use the username as Document ID for easier lookups/updates if we want, 
            // or let Firestore generate ID. Let's use Firestore ID but store username fields.
            await addDoc(collection(db, USERS_COLLECTION), {
                username: newUser,
                password: newPass, // Storing plaintext as requested/migrated
                role: 'admin',
                status: 'active',
                createdAt: new Date().toISOString()
            });

            return newPass;
        } catch (e) {
            console.error("Add User Error", e);
            throw e;
        }
    }

    static async toggleUserStatus(targetUser) {
        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", targetUser));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) return;

            querySnapshot.forEach(async (d) => {
                const data = d.data();
                const newStatus = data.status === 'active' ? 'suspended' : 'active';
                await updateDoc(doc(db, USERS_COLLECTION, d.id), { status: newStatus });
            });
        } catch (e) {
            console.error("Toggle User Error", e);
        }
    }

    static async deleteUser(targetUser) {
        try {
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", targetUser));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach(async (d) => {
                await deleteDoc(doc(db, USERS_COLLECTION, d.id));
            });
        } catch (e) {
            console.error("Delete User Error", e);
        }
    }

    static async changePassword(oldPass, newPass) {
        const session = this.getSession();
        if (!session) return { status: 'error', message: 'No session' };

        try {
            // Find user doc
            const q = query(collection(db, USERS_COLLECTION), where("username", "==", session.username));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) return { status: 'error', message: 'User not found' };

            let userDoc = null;
            querySnapshot.forEach((d) => { userDoc = d; });

            if (userDoc.data().password !== oldPass) {
                return { status: 'error', message: 'Incorrect old password' };
            }

            await updateDoc(doc(db, USERS_COLLECTION, userDoc.id), { password: newPass });
            return { status: 'success' };

        } catch (e) {
            console.error("Change Password Error", e);
            return { status: 'error', message: e.message };
        }
    }

    // --- COUPON MANAGEMENT ---
    static async getCoupons() {
        try {
            const querySnapshot = await getDocs(collection(db, COUPONS_COLLECTION));
            let coupons = [];
            querySnapshot.forEach((doc) => {
                coupons.push(doc.data());
            });
            return coupons;
        } catch (e) {
            console.error("Get Coupons Error", e);
            return [];
        }
    }

    static async addCoupon(code, type, value) {
        try {
            // Check for duplicate code
            const q = query(collection(db, COUPONS_COLLECTION), where("code", "==", code));
            const snap = await getDocs(q);
            if (!snap.empty) throw new Error("Coupon code already exists");

            await addDoc(collection(db, COUPONS_COLLECTION), {
                code: code,
                type: type,
                value: Number(value),
                status: 'active',
                createdAt: new Date().toISOString()
            });
        } catch (e) {
            console.error("Add Coupon Error", e);
            throw e;
        }
    }

    static async deleteCoupon(code) {
        try {
            const q = query(collection(db, COUPONS_COLLECTION), where("code", "==", code));
            const snap = await getDocs(q);
            snap.forEach(async (d) => {
                await deleteDoc(doc(db, COUPONS_COLLECTION, d.id));
            });
        } catch (e) {
            console.error("Delete Coupon Error", e);
        }
    }

    // --- ORDER MANAGEMENT ---
    static async getOrders() {
        try {
            const ordersRef = collection(db, 'orders');
            // Note: Firestore requires an index for sorting. If it fails, check console for link to create index.
            // For now, we will fetch then sort in JS to avoid index requirement blocking.
            const snap = await getDocs(ordersRef);
            let orders = [];
            snap.forEach(d => {
                orders.push({ id: d.id, ...d.data() });
            });
            // Sort Descending by Date
            orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
            return orders;
        } catch (e) {
            console.error("Get Orders Error", e);
            return [];
        }
    }

    static async updateOrderStatus(orderId, newStatus) {
        try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, { status: newStatus });
            return true;
        } catch (e) {
            console.error("Update Order Status Error", e);
            throw e;
        }
    }

    static async updatePaymentStatus(orderId, newStatus) {
        try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, { paymentStatus: newStatus });
            return true;
        } catch (e) {
            console.error("Update Payment Status Error", e);
            throw e;
        }
    }

    /**
     * Seeds the database with the initial 'abhinand' admin user.
     * Only works if the user does not exist.
     */
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
                status: 'active',
                createdAt: new Date().toISOString()
            });

            return { success: true, message: `Admin created! User: ${username}, Pass: ${password}` };
        } catch (e) {
            console.error("Setup Admin Error", e);
            return { success: false, message: "Error: " + e.message };
        }
    }
}

// Make it global for inline scripts in list.html
window.AdminManager = AdminManager;
export { AdminManager };
