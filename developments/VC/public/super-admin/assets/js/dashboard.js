import { db, auth } from '../../../assets/js/config-v3.js';
import {
    collection,
    query,
    orderBy,
    limit,
    doc,
    updateDoc,
    setDoc,
    onSnapshot,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { checkAdminAuth, logoutAdmin } from './auth.js';

// DOM Elements
const adminName = document.getElementById('adminName');
const logoutBtn = document.getElementById('logoutBtn');

// Views
const views = {
    dashboard: document.getElementById('view-dashboard'),
    users: document.getElementById('view-users'),
    admins: document.getElementById('view-admins'),
    meetings: document.getElementById('view-meetings'),
    settings: document.getElementById('view-settings')
};

// Nav Items
const navItems = {
    dashboard: document.getElementById('nav-dashboard'),
    users: document.getElementById('nav-users'),
    admins: document.getElementById('nav-admins'),
    meetings: document.getElementById('nav-meetings'),
    settings: document.getElementById('nav-settings')
};

// Unsubscribe functions storage
let listeners = {
    statsUsers: null,
    statsMeetings: null,
    recentUsers: null,
    allUsers: null,
    admins: null,
    allMeetings: null,
    settings: null
};

// Initialize Dashboard
const initDashboard = async () => {
    try {
        const user = await checkAdminAuth();
        if (!user) return; // Auth guard will handle redirect

        adminName.textContent = user.displayName || user.email;

        // Google Auth Security Check
        await validateGoogleAdmin(user);

        // Start Realtime Listeners
        startStatsListeners();
        startRecentUsersListener();

        // Load Settings (Realtime)
        startSettingsListener();

        // Setup Navigation
        setupNavigation();

    } catch (error) {
        console.error('Dashboard Init Error:', error);
    }
};

// --- Navigation Logic ---
const setupNavigation = () => {
    Object.keys(navItems).forEach(key => {
        navItems[key].addEventListener('click', () => switchView(key));
    });
};

const switchView = (viewName) => {
    // Update Nav
    Object.values(navItems).forEach(el => el.classList.remove('active'));
    navItems[viewName].classList.add('active');

    // Update View
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');

    // Load Data if needed
    if (viewName === 'users') startAllUsersListener();
    if (viewName === 'admins') startAdminsListener();
    if (viewName === 'meetings') startAllMeetingsListener();
};

// --- Data Fetching (Realtime) ---

// 1. Dashboard Stats
const startStatsListeners = () => {
    if (listeners.statsUsers) listeners.statsUsers(); // Unsub if exists (though init only runs once)
    if (listeners.statsMeetings) listeners.statsMeetings();

    // Users Stats
    try {
        listeners.statsUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            const el = document.getElementById('statsTotalUsers');
            if (el) el.textContent = snapshot.size;
        }, (error) => {
            console.error('Error listening to users stats:', error);
        });
    } catch (e) {
        console.error('Stats Users Init Error:', e);
    }

    // Meetings Stats
    try {
        listeners.statsMeetings = onSnapshot(collection(db, "meetings"), (snapshot) => {
            const elTotal = document.getElementById('statsTotalMeetings');
            if (elTotal) elTotal.textContent = snapshot.size;

            const activeMeetings = snapshot.docs.filter(doc => doc.data().status === 'active');
            const elActive = document.getElementById('statsActiveMeetings');
            if (elActive) elActive.textContent = activeMeetings.length;

            const elUptime = document.getElementById('statsUptime');
            if (elUptime) elUptime.textContent = '99.9%';
        }, (error) => {
            console.error('Error listening to meetings stats:', error);
        });
    } catch (e) {
        console.error('Stats Meetings Init Error:', e);
    }
};

// 2. Recent Users
const startRecentUsersListener = () => {
    if (listeners.recentUsers) return; // Keep running

    const tbody = document.getElementById('overviewUsersTableBody');
    if (!tbody) return;

    try {
        const q = query(collection(db, "users"), orderBy("lastActive", "desc"), limit(5));

        listeners.recentUsers = onSnapshot(q, (snapshot) => {
            renderUserTable(snapshot, tbody, false);
        }, (error) => {
            console.error('Error listening to recent users:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading data</td></tr>';
        });
    } catch (error) {
        console.error('Recent Users Init Error:', error);
    }
};

// 3. All Users
const startAllUsersListener = () => {
    if (listeners.allUsers) return; // Already listening

    const tbody = document.getElementById('fullUsersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

    try {
        const q = query(collection(db, "users"), orderBy("lastActive", "desc"), limit(50));

        listeners.allUsers = onSnapshot(q, (snapshot) => {
            renderUserTable(snapshot, tbody, true);
        }, (error) => {
            console.error('Error listening to all users:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading users</td></tr>';
        });
    } catch (error) {
        console.error('All Users Init Error:', error);
    }
};

// 3.5. Admins
const startAdminsListener = () => {
    if (listeners.admins) return;

    const tbody = document.getElementById('adminsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Loading admins...</td></tr>';

    try {
        // Query for admins
        const q = query(collection(db, "users"), where("role", "==", "admin"));

        listeners.admins = onSnapshot(q, (snapshot) => {
            renderAdminsTable(snapshot, tbody);
        }, (error) => {
            console.error('Error listening to admins:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Error loading admins</td></tr>';
        });
    } catch (error) {
        console.error('Admins Init Error:', error);
    }
};

// 4. All Meetings
const startAllMeetingsListener = () => {
    if (listeners.allMeetings) return; // Already listening

    const tbody = document.getElementById('meetingsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

    try {
        const q = query(collection(db, "meetings"), orderBy("createdAt", "desc"), limit(20));

        listeners.allMeetings = onSnapshot(q, (snapshot) => {
            tbody.innerHTML = '';
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No meetings found.</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const row = document.createElement('tr');

                let statusBadge = `<span class="status-badge status-offline">${data.status || 'ended'}</span>`;
                if (data.status === 'active') statusBadge = `<span class="status-badge status-active">Active</span>`;

                row.innerHTML = `
                    <td>${doc.id}</td>
                    <td>${data.hostName || 'Unknown Host'}</td>
                    <td>${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-icon delete-btn end-meeting-btn" data-mid="${doc.id}" title="End Meeting"><i class="fas fa-stop-circle"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }, (error) => {
            console.error('Error listening to all meetings:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading meetings</td></tr>';
        });
    } catch (error) {
        console.error('All Meetings Init Error:', error);
    }
};


// --- Modal Helpers ---
const modal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalFooter = document.getElementById('modalFooter');

// Make closeModal global so it can be called from HTML onclick
window.closeModal = () => {
    if (modal) modal.classList.remove('active');
};

const showModal = ({ title, content, onConfirm, showCancel = true, confirmText = 'Confirm', confirmColor = null }) => {
    if (!modal) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = content;

    // Reset footer
    modalFooter.innerHTML = '';

    // Add Cancel Button
    if (showCancel) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-modal btn-modal-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = window.closeModal;
        modalFooter.appendChild(cancelBtn);
    }

    // Add Confirm/OK Button
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-modal btn-modal-confirm';
    if (confirmColor) confirmBtn.style.backgroundColor = confirmColor;
    confirmBtn.textContent = confirmText;

    if (onConfirm) {
        confirmBtn.onclick = async () => {
            // Loading state
            const originalText = confirmBtn.textContent;
            confirmBtn.textContent = 'Processing...';
            confirmBtn.disabled = true;
            try {
                await onConfirm();
                window.closeModal();
            } catch (e) {
                console.error(e);
                confirmBtn.textContent = originalText;
                confirmBtn.disabled = false;
            }
        };
    } else {
        confirmBtn.onclick = window.closeModal;
    }

    modalFooter.appendChild(confirmBtn);
    modal.classList.add('active');
};


// --- Action Handlers and Listeners ---

const handleUserAction = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const uid = btn.dataset.uid;
    if (!uid) return;

    if (btn.classList.contains('view-btn')) {
        viewUserDetails(uid);
    } else if (btn.classList.contains('block-btn')) {
        await blockUser(uid);
    } else if (btn.classList.contains('verify-btn')) {
        await toggleVerification(uid, btn.dataset.status === 'true');
    } else if (btn.classList.contains('make-admin-btn')) {
        await toggleAdminRole(uid, btn.dataset.role === 'admin');
    }
};

const handleMeetingAction = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const mid = btn.dataset.mid;
    if (!mid) return;

    if (btn.classList.contains('end-meeting-btn')) {
        await endMeeting(mid);
    }
};

const viewUserDetails = async (uid) => {
    try {
        const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docSnap = await getDoc(doc(db, "users", uid));

        if (docSnap.exists()) {
            const data = docSnap.data();
            const content = `
                <div class="modal-details-grid">
                    <span class="modal-details-label">Full Name:</span>
                    <span class="modal-details-value">${data.name || 'N/A'}</span>
                    
                    <span class="modal-details-label">Email:</span>
                    <span class="modal-details-value">${data.email || 'N/A'}</span>
                    
                    <span class="modal-details-label">User ID:</span>
                    <span class="modal-details-value">${uid}</span>
                    
                    <span class="modal-details-label">Last Active:</span>
                    <span class="modal-details-value">${data.lastActive?.toDate().toLocaleString() || 'N/A'}</span>
                    
                    <span class="modal-details-label">Status:</span>
                    <span class="modal-details-value">${data.disabled ? 'Banned' : 'Active'}</span>
                </div>
            `;

            showModal({
                title: 'User Profile Details',
                content: content,
                showCancel: false,
                confirmText: 'Close',
                confirmColor: '#3b82f6' // Blue for info
            });
        }
    } catch (error) {
        console.error("Error viewing user:", error);
    }
};

const blockUser = async (uid) => {
    showModal({
        title: 'Block User?',
        content: 'Are you sure you want to block this user? They will be immediately signed out and prevented from logging in again.',
        confirmText: 'Block User',
        onConfirm: async () => {
            await updateDoc(doc(db, "users", uid), {
                disabled: true, // Legacy field
                status: 'banned',
                isBanned: true // Explicit ban field often used
            });
        }
    });
};

const toggleVerification = async (uid, currentStatus) => {
    const action = currentStatus ? 'Remove' : 'Grant';
    showModal({
        title: `${action} Verification Badge?`,
        content: `Are you sure you want to ${action.toLowerCase()} the verified blue tick for this user?`,
        confirmText: `${action} Badge`,
        confirmColor: currentStatus ? '#ef4444' : '#3b82f6',
        onConfirm: async () => {
            await updateDoc(doc(db, "users", uid), {
                isVerified: !currentStatus
            });
        }
    });
};

const toggleAdminRole = async (uid, isAdmin) => {
    const action = isAdmin ? 'Revoke' : 'Grant';
    showModal({
        title: `${action} Admin Privileges?`,
        content: `Are you sure you want to ${action.toLowerCase()} Admin rights for this user? They will have full access to this dashboard.`,
        confirmText: `${action} Admin`,
        confirmColor: isAdmin ? '#ef4444' : '#22c55e',
        onConfirm: async () => {
            await updateDoc(doc(db, "users", uid), {
                role: isAdmin ? 'user' : 'admin'
            });
        }
    });
};

const endMeeting = async (mid) => {
    const inputId = `reason-${mid}`;
    showModal({
        title: 'End Meeting?',
        content: `
            <div style="color: #94a3b8; margin-bottom: 1rem;">Are you sure you want to forcibly end this meeting? All participants will be disconnected.</div>
            <div>
                <label style="display:block; color:white; margin-bottom:0.5rem; font-size: 0.9rem;">Reason for ending (active users will see this):</label>
                <textarea id="${inputId}" class="form-control" rows="3" 
                    placeholder="Enter reason..." 
                    style="width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; border-radius: 8px; resize: vertical; box-sizing: border-box;"></textarea>
            </div>
        `,
        confirmText: 'End Meeting',
        confirmColor: '#ef4444',
        onConfirm: async () => {
            const reasonEl = document.getElementById(inputId);
            let reason = reasonEl ? reasonEl.value.trim() : "";
            if (!reason) reason = "Meeting ended by administrator.";

            // Append Footer
            reason += "\n\n(by Gridify Tec Team)";

            await updateDoc(doc(db, "meetings", mid), {
                status: 'ended',
                endReason: reason,
                endedAt: new Date()
            });
        }
    });
};

// Add global listeners to tables for delegation
const userTableAdmins = document.getElementById('adminsTableBody');
if (userTableAdmins) userTableAdmins.addEventListener('click', handleUserAction);

const userTable1 = document.getElementById('overviewUsersTableBody');
if (userTable1) userTable1.addEventListener('click', handleUserAction);

const userTable2 = document.getElementById('fullUsersTableBody');
if (userTable2) userTable2.addEventListener('click', handleUserAction);

const meetingsTable = document.getElementById('meetingsTableBody');
if (meetingsTable) meetingsTable.addEventListener('click', handleMeetingAction);


const renderUserTable = (snapshot, tbody, detailed = false) => {
    tbody.innerHTML = '';
    snapshot.forEach(doc => {
        const userData = doc.data();
        const row = document.createElement('tr');

        // Logic
        let lastActive = 'N/A';
        if (userData.lastActive && userData.lastActive.toDate) {
            lastActive = timeAgo(userData.lastActive.toDate());
        }

        let status = '<span class="status-badge status-offline">Offline</span>';
        if (userData.disabled || userData.status === 'banned' || userData.isBanned) {
            status = '<span class="status-badge status-ended">Banned</span>';
        } else if (userData.lastActive) {
            const diff = (new Date() - userData.lastActive.toDate()) / 1000 / 60;
            if (diff < 5) status = '<span class="status-badge status-active">Active</span>';
        }

        let details = '';
        if (detailed) {
            const joined = userData.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
            details = `<td>${joined}</td>`;
        }

        let actions = `
            <td>
                <button class="btn-icon view-btn" data-uid="${doc.id}" title="View Details"><i class="fas fa-eye"></i></button>
            </td>`;

        if (detailed) {
            const isVerified = userData.isVerified || false;
            const isAdmin = userData.role === 'admin';

            actions = `
            <td>
                <button class="btn-icon view-btn" data-uid="${doc.id}" title="View Details"><i class="fas fa-eye"></i></button>
                <button class="btn-icon verify-btn" data-uid="${doc.id}" data-status="${isVerified}" title="${isVerified ? 'Remove Verification' : 'Verify User'}" style="${isVerified ? 'color: #3b82f6;' : ''}">
                    <i class="fas fa-check-circle"></i>
                </button>

                <button class="btn-icon delete-btn block-btn" data-uid="${doc.id}" title="Block User"><i class="fas fa-ban"></i></button>
            </td>`;
        }


        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${(userData.name || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="user-name">
                            ${userData.name || 'Unknown'}
                            ${userData.isVerified ? '<i class="fas fa-check-circle" style="color: #3b82f6; margin-left: 5px; font-size: 0.8rem;" title="Verified"></i>' : ''}
                        </div>
                        <div style="font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
                            ${userData.role === 'admin'
                ? '<span style="background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 1px 6px; border-radius: 4px; font-weight: 600;">ADMIN</span>'
                : '<span style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; padding: 1px 6px; border-radius: 4px;">USER</span>'}
                            <span title="${doc.id}" style="font-family: monospace; font-size: 0.7rem; letter-spacing: -0.5px;">ID: ${doc.id}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td>${userData.email || 'No Email'}</td>
            ${details}
            <td>${lastActive}</td>
            <td>${status}</td>
            ${actions}
        `;
        tbody.appendChild(row);
    });
}

const renderAdminsTable = (snapshot, tbody) => {
    tbody.innerHTML = '';
    if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem; color: var(--text-muted);">No admin users found.</td></tr>';
        return;
    }

    snapshot.forEach(doc => {
        const userData = doc.data();
        const row = document.createElement('tr');

        const isMe = (auth.currentUser && auth.currentUser.uid === doc.id);

        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background: var(--accent-green);">${(userData.name || 'A').charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="user-name">
                            ${userData.name || 'Admin'}
                            ${userData.isVerified ? '<i class="fas fa-check-circle" style="color: #ef4444; margin-left: 5px; font-size: 0.8rem;" title="Verified"></i>' : ''}
                        </div>
                        <div style="font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
                           <span title="${doc.id}" style="font-family: monospace; font-size: 0.7rem; letter-spacing: -0.5px;">ID: ${doc.id}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td>${userData.email || 'N/A'}</td>
            <td><span class="status-badge status-active" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">Active Admin</span></td>
            <td>
                ${!isMe ? `
                <button class="btn-icon make-admin-btn" data-uid="${doc.id}" data-role="admin" title="Revoke Admin Access" style="color: #ef4444;">
                    <i class="fas fa-user-minus"></i>
                </button>
                ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">(You)</span>'}
            </td>
        `;
        tbody.appendChild(row);
    });
};

// Add Admin Button Handler
const addAdminBtn = document.getElementById('addAdminBtn');
if (addAdminBtn) {
    addAdminBtn.addEventListener('click', () => {
        const inputId = 'new-admin-email';
        showModal({
            title: 'Add New Admin',
            content: `
                <div style="margin-bottom: 1rem; color: #94a3b8;">
                    Enter the email address of an <b>existing user</b> to grant them Admin privileges.
                </div>
                <div>
                    <label style="display:block; color:white; margin-bottom:0.5rem; font-size: 0.9rem;">User Email:</label>
                    <input type="email" id="${inputId}" class="form-control" placeholder="user@example.com" 
                        style="width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; border-radius: 8px;">
                </div>
            `,
            confirmText: 'Grant Access',
            confirmColor: '#22c55e',
            onConfirm: async () => {
                const email = document.getElementById(inputId).value.trim();
                if (!email) throw new Error("Please enter an email address");

                // We need to find the user by email. 
                // Since email is not a document ID, we must query.
                const q = query(collection(db, "users"), where("email", "==", email));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    throw new Error("User not found with this email. Please ask them to register first.");
                }

                const userDoc = querySnapshot.docs[0];
                if (userDoc.data().role === 'admin') {
                    throw new Error("This user is already an Admin.");
                }

                // Update the user
                await updateDoc(doc(db, "users", userDoc.id), {
                    role: 'admin',
                    updatedAt: new Date()
                });

                showModal({
                    title: 'Success',
                    content: `<b>${email}</b> has been upgraded to Admin.`,
                    showCancel: false,
                    confirmText: 'OK',
                    confirmColor: '#22c55e'
                });
            }
        });
    });
}

const startSettingsListener = () => {
    if (listeners.settings) listeners.settings();

    try {
        const docRef = doc(db, "config", "public");

        listeners.settings = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const maintCheckbox = document.getElementById('setting-maintenance');
                const timeContainer = document.getElementById('maintenance-time-container');
                const timeInput = document.getElementById('setting-maintenance-time');

                if (maintCheckbox && document.activeElement !== maintCheckbox) {
                    maintCheckbox.checked = data.maintenanceMode || false;
                    if (timeContainer) timeContainer.style.display = data.maintenanceMode ? 'flex' : 'none';
                }

                if (timeInput && document.activeElement !== timeInput) {
                    let seconds = data.maintenanceGracePeriod || 20;
                    let unit = 'seconds';
                    let value = seconds;

                    // Smartly determine if we should show minutes
                    if (seconds >= 60 && seconds % 60 === 0) {
                        unit = 'minutes';
                        value = seconds / 60;
                    }

                    timeInput.value = value;
                    const unitSelect = document.getElementById('setting-maintenance-unit');
                    if (unitSelect && document.activeElement !== unitSelect) unitSelect.value = unit;
                }

                if (document.getElementById('setting-registration'))
                    document.getElementById('setting-registration').checked = data.registrationEnabled !== false;

                if (document.getElementById('setting-guest'))
                    document.getElementById('setting-guest').checked = data.guestAccess !== false;

                if (document.getElementById('setting-google'))
                    document.getElementById('setting-google').checked = data.googleAuthEnabled !== false;

                if (document.getElementById('setting-verification'))
                    document.getElementById('setting-verification').checked = data.emailVerificationRequired || false;

                const passAlert = document.getElementById('setting-password-alert');
                if (passAlert && document.activeElement !== passAlert)
                    passAlert.value = data.passwordAlertMessage || '';
            } else {
                initDefaultSettings(docRef);
            }
        }, (error) => {
            console.warn("Settings listener error:", error);
        });
    } catch (e) {
        console.warn("Settings init error:", e);
    }
};

const initDefaultSettings = async (docRef) => {
    try {
        const defaults = {
            maintenanceMode: false,
            maintenanceGracePeriod: 20,
            registrationEnabled: true,
            guestAccess: true,
            googleAuthEnabled: true,
            emailVerificationRequired: false,
            passwordAlertMessage: '',
            updatedAt: new Date()
        };
        await setDoc(docRef, defaults);
    } catch (writeErr) {
        console.warn("Could not init defaults:", writeErr);
    }
};


// Add listener for instant toggle UI
const maintCheckboxMain = document.getElementById('setting-maintenance');
if (maintCheckboxMain) {
    maintCheckboxMain.addEventListener('change', (e) => {
        const timeContainer = document.getElementById('maintenance-time-container');
        if (timeContainer) timeContainer.style.display = e.target.checked ? 'flex' : 'none';
    });
}


document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveSettingsBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const maintenance = document.getElementById('setting-maintenance').checked;

        let maintenanceTime = parseInt(document.getElementById('setting-maintenance-time').value) || 20;
        const maintenanceUnit = document.getElementById('setting-maintenance-unit').value;

        if (maintenanceUnit === 'minutes') {
            maintenanceTime = maintenanceTime * 60;
        }

        const registration = document.getElementById('setting-registration').checked;
        const guest = document.getElementById('setting-guest').checked;
        const googleAuth = document.getElementById('setting-google').checked;
        const verification = document.getElementById('setting-verification').checked;
        const passwordAlert = document.getElementById('setting-password-alert').value.trim();

        await setDoc(doc(db, "config", "public"), {
            maintenanceMode: maintenance,
            maintenanceGracePeriod: maintenanceTime,
            registrationEnabled: registration,
            guestAccess: guest,
            googleAuthEnabled: googleAuth,
            emailVerificationRequired: verification,
            passwordAlertMessage: passwordAlert,
            updatedAt: new Date()
        }, { merge: true });

        showModal({
            title: 'Success',
            content: 'Settings have been saved successfully.',
            showCancel: false,
            confirmText: 'OK',
            confirmColor: '#22c55e'
        });
    } catch (error) {
        console.error("Error saving settings:", error);
        showModal({
            title: 'Error',
            content: 'Failed to save settings. Please check console for details.',
            showCancel: false,
            confirmText: 'OK',
            confirmColor: '#ef4444'
        });
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});


// Helper: Time Ago
function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

// Google Admin Security Validation
const validateGoogleAdmin = async (user) => {
    // Check if provider is Google
    const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
    if (!isGoogle) return;

    try {
        const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) return; // Should allow normal flow or error out?
        const userData = userSnap.data();

        if (userData.adminPassword) {
            // Case 1: Password Exists -> Verify
            await promptForAdminPassword(userDocRef, userData.adminPassword);
        } else {
            // Case 2: No Password -> Set New
            await promptToSetAdminPassword(userDocRef);
        }

    } catch (e) {
        console.error("Validation Error:", e);
        // Fail safe: logout
        await logoutAdmin();
    }
};

const promptForAdminPassword = async (docRef, correctPassword) => {
    return new Promise((resolve) => {
        const inputId = 'admin-pass-verify';
        showModal({
            title: 'Admin Identification Required',
            content: `
                <div style="color: #94a3b8; margin-bottom: 1rem;">
                    For security, please enter your secondary <b>Admin Password</b> to continue.
                </div>
                <input type="password" id="${inputId}" class="form-control" placeholder="Enter password"
                    style="width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; border-radius: 8px;">
                <div id="pass-error" style="color: #ef4444; font-size: 0.8rem; margin-top: 0.5rem; display: none;">Incorrect password.</div>
            `,
            showCancel: false,
            confirmText: 'Verify Access',
            confirmColor: '#3b82f6',
            onConfirm: async () => {
                const entered = document.getElementById(inputId).value;
                if (entered === correctPassword) {
                    resolve(true); // Success
                } else {
                    document.getElementById('pass-error').style.display = 'block';
                    throw new Error("Incorrect Password"); // Keeps modal open due to catch in showModal implementation, wait... 
                    // My showModal usage catches error and keeps modal open? 
                    // Actually, showModal implementation handles errors by logging and keeping modal. 
                    // But we need to RE-THROW to prevent closing?
                    // Let's re-trigger the modal if it fails, OR modify showModal to not close on error.
                    // The current showModal closes on success. If I throw, it stays?
                    // checking showModal: catch(e) -> confirmBtn.textContent = original; disabled=false. Modal STAYS open. Correct.
                }
            }
        });

        // Handle Cancel/Close via global or override?
        // Since showCancel is false, user must verify or sticky. 
        // But if they refresh, the process starts again.
    });
};

const promptToSetAdminPassword = async (docRef) => {
    return new Promise((resolve) => {
        const id1 = 'new-pass-1';
        const id2 = 'new-pass-2';
        showModal({
            title: 'Set Admin Password',
            content: `
                <div style="color: #94a3b8; margin-bottom: 1rem;">
                    Since you are using Google Login, you must set a secondary <b>Admin Password</b> for portal access.
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <input type="password" id="${id1}" class="form-control" placeholder="Create Password"
                        style="width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; border-radius: 8px;">
                </div>
                <div>
                    <input type="password" id="${id2}" class="form-control" placeholder="Confirm Password"
                        style="width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; border-radius: 8px;">
                </div>
            `,
            showCancel: false,
            confirmText: 'Save & Continue',
            confirmColor: '#22c55e',
            onConfirm: async () => {
                const p1 = document.getElementById(id1).value;
                const p2 = document.getElementById(id2).value;

                if (p1.length < 6) throw new Error("Password must be at least 6 characters.");
                if (p1 !== p2) throw new Error("Passwords do not match.");

                await updateDoc(docRef, {
                    adminPassword: p1
                });
                resolve(true);
            }
        });
    });
};

// Handlers
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await logoutAdmin();
    });
}

// Start
initDashboard();