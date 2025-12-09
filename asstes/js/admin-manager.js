const ADMIN_STORAGE_KEY = 'gridify_admin_session';
const SESSION_TIMEOUT = 120 * 1000; // 120 Seconds

class AdminManager {
    static async login(username, password) {
        try {
            const formData = new URLSearchParams();
            // We use JSON for custom actions to our script
            const payload = {
                action: 'login',
                username: username,
                password: password
            };

            const response = await fetch(APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.status === 'success') {
                this.startSession(username, result.role);
                return { success: true };
            } else {
                return { success: false, message: result.message };
            }
        } catch (error) {
            console.error("Login Error:", error);
            return { success: false, message: "Network Error" };
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
                // Debug log every 30s so we don't spam too much, but enough to know it's running
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
        if (!session || session.username !== 'abhinand') return [];

        const response = await fetch(`${APP_SCRIPT_URL}?action=getUsers&adminUser=${session.username}`);
        return await response.json();
    }

    static async addUser(newUser) { // newUser, newPass generated internally or passed?
        // Let's generate a random password
        const newPass = Math.random().toString(36).slice(-8);
        const session = this.getSession();

        const payload = {
            action: 'addUser',
            adminUser: session.username,
            newUser: newUser,
            newPass: newPass
        };

        await fetch(APP_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        return newPass;
    }

    static async toggleUserStatus(targetUser) {
        const session = this.getSession();
        const payload = {
            action: 'toggleUser',
            adminUser: session.username,
            targetUser: targetUser
        };
        await fetch(APP_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    }

    static async deleteUser(targetUser) {
        const session = this.getSession();
        const payload = {
            action: 'deleteUser',
            adminUser: session.username,
            targetUser: targetUser
        };
        await fetch(APP_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    }

    static async changePassword(oldPass, newPass) {
        const session = this.getSession();
        const payload = {
            action: 'changePassword',
            username: session.username,
            oldPassword: oldPass,
            newPassword: newPass
        };
        const response = await fetch(APP_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        return await response.json();
    }

    // --- COUPON MANAGEMENT ---
    static async getCoupons() {
        const response = await fetch(`${APP_SCRIPT_URL}?action=getCoupons`);
        return await response.json();
    }

    static async addCoupon(code, type, value) {
        const payload = {
            action: 'addCoupon',
            code: code,
            type: type,
            value: value
        };
        await fetch(APP_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    }

    static async deleteCoupon(code) {
        const payload = {
            action: 'deleteCoupon',
            code: code
        };
        await fetch(APP_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    }
}
