// dashboard.js - Admin & Reporter Dashboard
import { auth, db } from './firebase-config.js';
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    deleteDoc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const NEWSPAPERS_COL = 'newspapers';
const PAGES_COL = 'pages';
const USERS_COL = 'users';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, USERS_COL, user.email);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                await signOut(auth);
                window.location.href = '../login.html';
                return;
            }

            const userData = userDocSnap.data();

            const displayEl = document.getElementById('user-display-name');
            if (displayEl) displayEl.textContent = user.email;

            if (userData.role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
            }

            showLoader('Loading dashboard...');
            await loadStats();
            await loadNewspapers(userData);
            hideLoader();
        } else {
            window.location.href = '../login.html';
        }
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => location.href = '../login.html');
        });
    }

    // Change Password Logic
    const changePasswordBtn = document.getElementById('change-password-btn');
    const passwordModal = document.getElementById('password-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelPasswordBtn = document.getElementById('cancel-password-btn');
    const savePasswordBtn = document.getElementById('save-password-btn');

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            passwordModal.style.display = 'flex';
        });
    }

    const closePasswordModal = () => {
        passwordModal.style.display = 'none';
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', closePasswordModal);
    if (cancelPasswordBtn) cancelPasswordBtn.addEventListener('click', closePasswordModal);

    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', async () => {
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                alert("Please fill in all fields.");
                return;
            }

            if (newPassword !== confirmPassword) {
                alert("New passwords do not match.");
                return;
            }

            if (newPassword.length < 6) {
                alert("Password should be at least 6 characters.");
                return;
            }

            try {
                showLoader("Updating password...");
                const user = auth.currentUser;
                const credential = EmailAuthProvider.credential(user.email, currentPassword);

                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPassword);

                alert("Password updated successfully!");
                closePasswordModal();
            } catch (error) {
                console.error("Password update error:", error);
                if (error.code === 'auth/wrong-password') {
                    alert("Incorrect current password.");
                } else if (error.code === 'auth/weak-password') {
                    alert("Password is too weak.");
                } else {
                    alert("Error updating password: " + error.message);
                }
            } finally {
                hideLoader();
            }
        });
    }
});

async function loadStats() {
    try {
        const newspapersRef = collection(db, NEWSPAPERS_COL);
        const snapshot = await getDocs(newspapersRef);
        const total = snapshot.size;
        const published = snapshot.docs.filter(d => d.data().status === 'published').length;
        const drafts = total - published;

        const totalEl = document.getElementById('total-newspapers');
        const pubEl = document.getElementById('published-newspapers');
        const draftEl = document.getElementById('draft-newspapers');

        if (totalEl) totalEl.textContent = total;
        if (pubEl) pubEl.textContent = published;
        if (draftEl) draftEl.textContent = drafts;
    } catch (error) {
        console.error("Stats error:", error);
    }
}

async function loadNewspapers(userData) {
    const tableBody = document.getElementById('newspaper-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';

    try {
        const newspapersRef = collection(db, NEWSPAPERS_COL);
        const q = query(newspapersRef, orderBy('createdAt', 'desc'));

        const snapshot = await getDocs(q);
        tableBody.innerHTML = '';

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No editions found.</td></tr>';
            return;
        }

        snapshot.forEach(docSnapshot => {
            const news = docSnapshot.data();
            const id = docSnapshot.id;
            const isOwner = news.createdBy === auth.currentUser.email;
            const isAdmin = userData.role === 'admin';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><b>${news.month} ${news.year}</b></td>
                <td><i class="fas fa-images"></i> ${news.pageCount || 0}</td>
                <td>${news.pdfUrl ? '<i class="fas fa-file-pdf" style="color:#d9534f"></i>' : '-'}</td>
                <td><span class="status-badge status-${news.status}">${news.status}</span></td>
                <td><small>${news.createdBy}</small></td>
                <td>
                    <div class="action-btns">
                        <button onclick="editNewspaper('${id}')" class="btn" style="padding:4px 8px; background:#eee;"><i class="fas fa-edit"></i></button>
                        ${isAdmin || (isOwner && news.status === 'draft') ?
                    `<button onclick="deleteNewspaper('${id}')" class="btn" style="padding:4px 8px; background:#fee; color:#d9534f;"><i class="fas fa-trash"></i></button>` : ''}
                        ${isAdmin ?
                    `<button onclick="togglePublish('${id}', '${news.status}')" class="btn" style="padding:4px 8px; background:var(--primary-color); color:white; font-size: 0.75rem;">
                                ${news.status === 'published' ? 'Unpublish' : 'Publish'}
                             </button>` : ''}
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Load error:", error);
    }
}

window.editNewspaper = function (id) {
    location.href = `manage-newspaper.html?id=${id}`;
}

window.deleteNewspaper = async function (id) {
    if (confirm("Are you sure you want to delete this edition? This will remove all pages and data.")) {
        const bgStatus = document.getElementById('background-status');
        const statusText = document.getElementById('status-text');
        const statusCount = document.getElementById('status-count');
        const statusIcon = document.getElementById('status-icon');

        try {
            showLoader('Deleting edition...');
            if (bgStatus) bgStatus.style.display = 'block';
            if (statusText) statusText.textContent = "Deleting from Google Drive...";
            if (statusCount) statusCount.textContent = "This may take a moment.";

            // 1. Fetch Drive Settings and Newspaper Data
            let driveScriptUrl = null;
            let month = "", year = "";
            try {
                const [settingsSnap, newsSnap] = await Promise.all([
                    getDoc(doc(db, 'settings', 'drive_config')),
                    getDoc(doc(db, NEWSPAPERS_COL, id))
                ]);

                if (settingsSnap.exists()) driveScriptUrl = settingsSnap.data().scriptUrl;
                if (newsSnap.exists()) {
                    month = newsSnap.data().month;
                    year = newsSnap.data().year;
                }
            } catch (err) { console.error("Data fetch error", err); }

            // 2. Call Drive Delete if configured
            if (driveScriptUrl && month && year) {
                try {
                    const searchPattern = `SSV_e-news_${month.toLowerCase()}-${year}`;
                    await fetch(driveScriptUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({
                            action: 'delete',
                            pattern: searchPattern
                        })
                    });
                } catch (driveErr) { console.error("Drive file deletion failed", driveErr); }
            }

            // 3. Delete from Firestore
            if (statusText) statusText.textContent = "Removing from Database...";
            const pagesRef = collection(db, PAGES_COL);
            const q = query(pagesRef, where('newspaperId', '==', id));
            const pagesSnapshot = await getDocs(q);

            const batch = writeBatch(db);
            pagesSnapshot.forEach(p => batch.delete(p.ref));
            batch.delete(doc(db, NEWSPAPERS_COL, id));
            await batch.commit();

            if (statusText) statusText.textContent = "Deleted Successfully!";
            if (statusIcon) {
                statusIcon.className = "fas fa-check-circle";
                statusIcon.style.color = "#3c763d";
            }

            setTimeout(() => {
                location.reload();
            }, 1000);
            hideLoader();

        } catch (error) {
            if (bgStatus) bgStatus.style.display = 'none';
            alert("Error deleting: " + error.message);
            hideLoader();
        }
    }
}

window.togglePublish = async function (id, currentStatus) {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
        showLoader(`Changing status to ${newStatus}...`);
        const newsRef = doc(db, NEWSPAPERS_COL, id);
        await updateDoc(newsRef, {
            status: newStatus
        });
        location.reload();
        hideLoader();
    } catch (error) {
        alert("Error updating status: " + error.message);
        hideLoader();
    }
}
