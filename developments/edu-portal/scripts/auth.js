/* Authentication Manager - Firebase Integrated */

// We assume firebase-config.js is loaded BEFORE this file in the HTML.

const Auth = {
    // Current User State
    currentUser: null,
    userProfile: null, // Additional data from Firestore

    // Helper for formatting roles
    formatRole: (r) => {
        if (!r) return 'User';
        return r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },

    // Toast Notification Utility (Internal Helper)
    showToast: (message, type = 'info') => {
        message = message.replace(/Firebase:?/gi, 'Gridify');
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.zIndex = '50000'; // Ensure toasts appear above all modals
            document.body.appendChild(container); // Safe to append to body
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${message}</span> <button class="toast-close" onclick="this.parentElement.remove()">×</button>`;

        container.appendChild(toast);

        // Trigger Flow
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000); // 5s timeout
    },

    init: () => {
        // Listen for auth state changes
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log("User logged in:", user.email);
                Auth.currentUser = user;

                // Fetch extra profile data
                try {
                    const docRef = window.db.collection('users').doc(user.uid);
                    const doc = await docRef.get();
                    if (doc.exists) {
                        Auth.userProfile = doc.data();

                        // Role management is now fully handled via Database/Setup Page
                        // No hardcoded promotions.

                    } else {
                        console.log("No profile found for user");
                    }
                } catch (e) {
                    console.error("Error fetching profile:", e);
                }

                Auth.updateUI(true);
            } else {
                console.log("User logged out");
                Auth.currentUser = null;
                Auth.userProfile = null;
                Auth.updateUI(false);
            }

            // Check for Flash Messages (Session Storage)
            const flashMsg = sessionStorage.getItem('flash_message');
            if (flashMsg) {
                try {
                    const { message, type } = JSON.parse(flashMsg);
                    Auth.showToast(message, type);
                } catch (e) { Auth.showToast(flashMsg); }
                sessionStorage.removeItem('flash_message');
            }
        });

        // Attach Logout Listener
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }
    },

    login: async (email, password) => {
        try {
            // Auto-pad password if < 6 chars to match creation logic
            if (password.length >= 4 && password.length < 6) {
                password = password.padEnd(6, '0');
            }
            const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Get role to direct properly
            const doc = await window.db.collection('users').doc(user.uid).get();
            const role = doc.exists ? doc.data().role : 'student';
            const userData = doc.exists ? doc.data() : {};

            /* Start Email Verification Check - Enforce only for Students */
            if (role === 'student' && !user.emailVerified) {
                // Attempt to resend verification email so they aren't stuck
                try {
                    await user.sendEmailVerification();
                } catch (e) {
                    console.log("Verification email resend rate limited or error:", e);
                }

                await window.auth.signOut();
                return { success: false, message: 'Email not verified. A new verification link has been sent to your inbox.' };
            }
            /* End Email Verification Check */

            // Check if mobile number is missing (except for super_admin)
            if (role !== 'super_admin' && !userData.mobile) {
                sessionStorage.setItem('requireMobileNumber', 'true');
            }

            let redirect = 'dashboard/index.html';
            // Admin, Super Admin, Head Admin, and Staff go to the Admin Panel
            if (['admin', 'super_admin', 'head_admin', 'staff'].includes(role)) {
                redirect = 'admin/index.html';
            }

            return { success: true, redirect: redirect };
        } catch (error) {
            if (error.code === 'auth/invalid-login-credentials') {
                return { success: false, message: 'Invalid login credentials' };
            }
            return { success: false, message: error.message.replace(/Firebase:?/gi, 'Gridify') };
        }
    },

    googleLogin: async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await window.auth.signInWithPopup(provider);
            const user = result.user;

            // Check if user exists in Firestore
            const userDoc = await window.db.collection('users').doc(user.uid).get();
            let role = 'student';
            let userData = {};

            if (!userDoc.exists) {
                // Create new user document if they don't exist
                userData = {
                    name: user.displayName || 'Google User',
                    email: user.email,
                    role: 'student',
                    createdAt: new Date(),
                    subscription: 'inactive',
                    authMethod: 'google'
                };
                await window.db.collection('users').doc(user.uid).set(userData);
            } else {
                role = userDoc.data().role || 'student';
                userData = userDoc.data();
            }

            // Check if mobile number is missing (except for super_admin)
            if (role !== 'super_admin' && !userData.mobile) {
                sessionStorage.setItem('requireMobileNumber', 'true');
            }

            let redirect = 'dashboard/index.html';
            if (['admin', 'super_admin', 'head_admin', 'staff'].includes(role)) {
                redirect = 'admin/index.html';
            }

            return { success: true, redirect: redirect };
        } catch (error) {
            return { success: false, message: 'Login with Google error' };
        }
    },

    signup: async (email, password, name, mobile = '') => {
        try {
            // Validate Indian mobile number format (10 digits starting with 6-9)
            if (mobile && !/^[6-9][0-9]{9}$/.test(mobile)) {
                return { success: false, message: 'Invalid mobile number. Must be a 10-digit Indian number starting with 6-9.' };
            }

            // Check if mobile number is already in use
            if (mobile) {
                const existingMobile = await window.db.collection('users')
                    .where('mobile', '==', mobile)
                    .get();

                if (!existingMobile.empty) {
                    return { success: false, message: 'This mobile number is already registered with another account.' };
                }
            }

            // Auto-pad password
            if (password.length >= 4 && password.length < 6) {
                password = password.padEnd(6, '0');
            }
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Send Verification Email
            await user.sendEmailVerification();

            // Create User Document in Firestore
            await window.db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                mobile: mobile, // Save mobile number
                role: 'student', // Default role
                subscription: 'inactive',
                createdAt: new Date(),
                isPaddedPassword: true // Mark if needed
            });

            // Sign out to force login after verification
            await window.auth.signOut();

            return { success: true, requireVerification: true };
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                return { success: false, message: 'The email address is already in use by another account' };
            }
            return { success: false, message: error.message.replace(/Firebase:?/gi, 'Gridify') };
        }
    },

    createStaffUser: async (email, password, name, role) => {
        let secondaryApp = null;
        try {
            if (!['student', 'staff', 'admin', 'head_admin'].includes(role)) {
                throw new Error('Invalid role.');
            }

            // AUTO-FIX: Pad password if it's 4 or 5 chars, because Firebase requires 6
            if (password.length >= 4 && password.length < 6) {
                // We pad with "00" or similar to reach 6 chars internally
                // The user logic must know this or we simply enforce 6. 
                // BUT the user asked to ALLOW 4 digits.
                // The only way to support "1234" is if we store "123400" or similar.
                // Let's explain this is a limitation or use a predictable pad.
                password = password.padEnd(6, '0');
            }

            const appName = 'secondaryAuth';
            const existingApp = firebase.apps.find(app => app.name === appName);
            secondaryApp = existingApp || firebase.initializeApp(window.firebaseConfig, appName);

            const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Send verification email
            await user.sendEmailVerification();

            // Note: We typically don't send verification emails to staff created by admin, 
            // but if desired, we could. Assuming admin verifies them manually or trusts the email.

            await window.db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                role: role,
                createdAt: new Date(),
                createdBy: Auth.currentUser ? Auth.currentUser.uid : 'admin',
                isPaddedPassword: true // Mark this so we know (optional)
            });

            await secondaryApp.auth().signOut();
            return { success: true };
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                return { success: false, message: 'The email address is already in use by another account' };
            }
            return { success: false, message: error.message.replace(/Firebase:?/gi, 'Gridify') };
        } finally {
            if (secondaryApp) await secondaryApp.delete();
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        try {
            const user = window.auth.currentUser;
            if (!user) throw new Error('No user logged in.');

            // Auto-pad inputs
            if (currentPassword.length >= 4 && currentPassword.length < 6) {
                currentPassword = currentPassword.padEnd(6, '0');
            }
            if (newPassword.length >= 4 && newPassword.length < 6) {
                newPassword = newPassword.padEnd(6, '0');
            }

            // Verify Current Password
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            await user.reauthenticateWithCredential(credential);

            // Update Password
            await user.updatePassword(newPassword);
            return { success: true };
        } catch (error) {
            if (error.code === 'auth/wrong-password') {
                return { success: false, message: 'Incorrect Current Password.' };
            }
            return { success: false, message: error.message.replace(/Firebase:?/gi, 'Gridify') };
        }
    },

    forgotPassword: async (email) => {
        try {
            // Check if user exists in our DB first
            const userQuery = await window.db.collection('users').where('email', '==', email).get();

            if (userQuery.empty) {
                return { success: false, message: 'No account found with this email address. Create a new account and start your journey' };
            }

            await window.auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message.replace(/Firebase:?/gi, 'Gridify') };
        }
    },

    logout: async () => {
        try {
            await window.auth.signOut();
            window.location.href = window.location.pathname.match(/\/(dashboard|admin|auth)\//) ? '../index.html' : 'index.html';
        } catch (error) {
            console.error("Logout Error:", error);
        }
    },

    checkProtection: async (requiredRole = null) => {
        // Wait a moment for auth state to resolve if it's initial load
        // In a real app we'd show a loading spinner

        return new Promise((resolve) => {
            const unsubscribe = window.auth.onAuthStateChanged(async (user) => {
                unsubscribe();
                if (!user) {
                    window.location.href = '../auth/login.html';
                    resolve(false);
                    return;
                }

                Auth.currentUser = user;

                if (requiredRole) {
                    const doc = await window.db.collection('users').doc(user.uid).get();
                    if (!doc.exists) {
                        sessionStorage.setItem('flash_message', JSON.stringify({ message: 'User record not found.', type: 'error' }));
                        await Auth.logout();
                        return;
                    }

                    const userData = doc.data();
                    Auth.userProfile = userData;
                    const role = userData.role || 'student';

                    // Check if User is Suspended
                    if (userData.status === 'suspended') {
                        sessionStorage.setItem('flash_message', JSON.stringify({ message: 'Your account has been SUSPENDED. Contact Admin.', type: 'error' }));
                        await Auth.logout();
                        return;
                    }

                    // Check System Offline Status (Block Admin/Staff if offline)
                    try {
                        const statusDoc = await window.db.collection('settings').doc('system').get();
                        const sysData = statusDoc.exists ? statusDoc.data() : { status: 'online' };
                        const sysStatus = sysData.status;
                        const sysReason = sysData.reason || 'Maintenance Mode';

                        // Strict check: if system is offline, ONLY super_admin can proceed for admin paths
                        // STUDENTS ARE EXEMPT from this check as per requirements
                        if (sysStatus === 'offline' && role !== 'super_admin' && role !== 'student') {
                            sessionStorage.setItem('flash_message', JSON.stringify({ message: `System Offline: ${sysReason}`, type: 'error' }));
                            window.location.href = '../index.html';
                            resolve(false);
                            return;
                        }
                    } catch (e) {
                        console.error("Error checking system status:", e);
                    }

                    // Consolidated Access Control
                    if (requiredRole === 'admin') {
                        // Allow Admin, Super Admin, Head Admin, and STAFF to access admin area
                        if (!['admin', 'super_admin', 'head_admin', 'staff'].includes(role)) {
                            sessionStorage.setItem('flash_message', JSON.stringify({ message: 'Unauthorized Access', type: 'error' }));
                            window.location.href = '../index.html';
                            resolve(false);
                            return;
                        }
                    } else if (requiredRole === 'student') {
                        // 'student' routes (dashboard) are accessible by EVERYONE with a role
                        // No logic needed here as long as role exists, which we checked above
                    } else if (role !== requiredRole) {
                        sessionStorage.setItem('flash_message', JSON.stringify({ message: `Unauthorized. Required: ${requiredRole}`, type: 'error' }));
                        window.location.href = '../index.html';
                        resolve(false);
                        return;
                    }
                }
                resolve(true); // Authorized
            });
        });
    },

    updateUI: (isLoggedIn) => {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');

        const isDeep = window.location.pathname.match(/\/(dashboard|admin|auth)\//);
        const prefix = isDeep ? '../' : '';

        if (isLoggedIn) {
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) {
                userMenu.classList.remove('hidden');
                const dashLink = userMenu.querySelector('a');
                if (dashLink && Auth.userProfile) {
                    const dashboardPath = Auth.userProfile.role === 'admin' ? 'admin/index.html' : 'dashboard/index.html';
                    dashLink.href = prefix + dashboardPath;
                }
            }
            // Update Name Displays
            const nameDisplay = document.getElementById('user-name-display');
            if (nameDisplay && Auth.userProfile) {
                // Determine if we are on student dashboard (which has this ID)
                // We show just the name because we have an icon.
                nameDisplay.innerText = Auth.userProfile.name;

                // Update icon if present
                const iconEl = document.getElementById('header-role-icon');
                if (iconEl) {
                    if (Auth.userProfile.role.includes('admin')) iconEl.className = 'fas fa-user-shield';
                    else if (Auth.userProfile.role === 'student') iconEl.className = 'fas fa-user-graduate';
                }
            }
            // Admin Name
            const adminName = document.getElementById('admin-name');
            if (adminName && Auth.userProfile) {
                adminName.innerText = `${Auth.formatRole(Auth.userProfile.role)} : ${Auth.userProfile.name}`;
            }

        } else {
            if (authButtons) authButtons.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    }
};

// Initialize only after scripts load
document.addEventListener('DOMContentLoaded', Auth.init);
