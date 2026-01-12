/**
 * Auth Service
 * Handles Login, Logout, and Role Verification
 */

const AuthService = {
    // Login with Email & Password
    login: async (email, password) => {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // Logout
    logout: async () => {
        try {
            await auth.signOut();
            await auth.signOut();
            // Go to root landing page
            // If in public/user/dashboard.html -> ../../index.html (Desktop/SSV/index.html)
            // If in public/admin/dashboard.html -> ../../index.html (Desktop/SSV/index.html)
            // If in SSV/index.html -> ../../index.html is wrong, but logout button is usually inside dashboard
            window.location.href = '../../index.html';
        } catch (error) {
            console.error("Logout failed", error);
        }
    },

    // Get Current User Profile with Role
    getUserProfile: async (uid) => {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                return doc.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }
    },

    // Middleware: Protect Routes
    requireRole: (requiredRole) => {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Check if suspended
                const profile = await AuthService.getUserProfile(user.uid);

                if (!profile) {
                    alert("User profile not found.");
                    auth.signOut();
                    return;
                }

                if (profile.suspended) {
                    alert("Your account has been suspended.");
                    auth.signOut();
                    window.location.href = '../../index.html';
                    return;
                }

                if (requiredRole === 'admin' && profile.role !== 'admin') {
                    // Redirect non-admins trying to access admin
                    window.location.href = '../user/dashboard.html';
                } else if (requiredRole === 'user' && profile.role !== 'user') {
                    // Allow Admins to access User Portal
                    if (profile.role === 'admin') {
                        // Admin is allowed in user area
                        return;
                    }
                    window.location.href = '../admin/dashboard.html';
                }

                // If on a login page or root, redirect based on role
                if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
                    // Specific check for explicit login pages
                    if (document.title.toLowerCase().includes('login')) {
                        const path = window.location.pathname;
                        // Check if we are in a subfolder (admin/ or user/ or super-admin/)
                        // If we are at root, path won't have public/ probably, or might be /SSV/index.html
                        // Simplistic check:
                        const isSubfolderLogin = path.includes('/admin/') || path.includes('/user/') || path.includes('/super-admin/');

                        if (profile.role === 'admin') {
                            window.location.href = isSubfolderLogin ? 'dashboard.html' : 'public/admin/dashboard.html';
                        } else {
                            window.location.href = isSubfolderLogin ? 'dashboard.html' : 'public/user/dashboard.html';
                        }
                    }
                }

            } else {
                // Not logged in
                // If we are NOT on a login page, redirect to login
                const path = window.location.pathname;
                // Simple logic: if in a subfolder and not on index, kick to index
                if ((path.includes('/admin/') || path.includes('/user/')) && !path.includes('index.html')) {
                    // public/user/dashboard.html -> ../../index.html
                    window.location.href = '../../index.html';
                }
            }
        });
    },

    // Password Reset
    sendPasswordResetEmail: async (email) => {
        try {
            await auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};
