// manage-users.js - Admin User Management
import { auth, db, firebaseConfig } from './firebase-config.js';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const USERS_COL = 'users';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        const displayEl = document.getElementById('user-display-name');
        if (displayEl) displayEl.textContent = user.email;

        // Check role and toggle admin-only elements
        getDoc(doc(db, 'users', user.email)).then(snap => {
            if (!snap.exists()) {
                signOut(auth).then(() => window.location.href = '../login.html');
                return;
            }
            const userData = snap.data();
            if (userData.role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
            }
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => signOut(auth).then(() => location.href = '../login.html');
        }

        showLoader('Loading users...');
        loadUsers();
    });

    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.onsubmit = async (e) => {
            e.preventDefault();
            createUser();
        };
    }
});

async function loadUsers() {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await getDocs(collection(db, USERS_COL));
        tableBody.innerHTML = '';

        snapshot.forEach(docSnapshot => {
            const user = docSnapshot.data();
            const id = docSnapshot.id;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.email || id}</td>
                <td><span class="role-badge role-${user.role || 'reporter'}">${user.role || 'reporter'}</span></td>
                <td>
                    <span style="color: ${user.active !== false ? '#3c763d' : '#d9534f'}">
                        ${user.active !== false ? 'Active' : 'Deactivated'}
                    </span>
                </td>
                <td>
                    <button onclick="toggleUserStatus('${id}', ${user.active !== false})" class="toggle-btn" style="font-size: 0.75rem;">
                        ${user.active !== false ? 'Deactivate' : 'Activate'}
                    </button>
                    ${user.role !== 'admin' ?
                    `<button onclick="deleteUserRecord('${id}')" class="toggle-btn" style="color:#d9534f; margin-left:10px; font-size: 0.75rem;">Delete</button>` : ''}
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Load users error:", error);
    } finally {
        hideLoader();
    }
}

async function createUser() {
    const emailEl = document.getElementById('user-email');
    const passwordEl = document.getElementById('user-password');
    const roleEl = document.getElementById('user-role');

    if (!emailEl || !passwordEl || !roleEl) return;

    const email = emailEl.value.trim().toLowerCase();
    const password = passwordEl.value;
    const role = roleEl.value;

    const btn = document.querySelector('#user-form button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    btn.disabled = true;

    try {
        showLoader('Creating user account...');

        let isRestoration = false;

        // Create secondary app to handle creating another user without logging out the current admin
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            await createUserWithEmailAndPassword(secondaryAuth, email, password);
            await signOut(secondaryAuth);
            await deleteApp(secondaryApp);
        } catch (authError) {
            if (authError.code === 'auth/email-already-in-use') {
                // Check if the user document actually exists in Firestore
                const docSnap = await getDoc(doc(db, USERS_COL, email));
                if (docSnap.exists()) {
                    throw new Error("User already exists in the system.");
                }
                // If not in text, we are effectively restoring access
                isRestoration = true;
                // We don't throw here, just continue to create the Firestore Doc
            } else {
                throw authError;
            }
        }

        const userRef = doc(db, USERS_COL, email);
        await setDoc(userRef, {
            email,
            role,
            active: true,
            createdAt: serverTimestamp()
        });

        if (isRestoration) {
            alert("User access restored! Note: The user's previous password remains active (the new one provided here was ignored by the system).");
        } else {
            alert("User created successfully!");
        }

        document.getElementById('user-form').reset();
        loadUsers();
    } catch (error) {
        console.error("Create user error:", error);
        alert("Error: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        hideLoader();
    }
}

window.toggleUserStatus = async function (email, currentActive) {
    try {
        showLoader('Updating user status...');
        const userRef = doc(db, USERS_COL, email);
        await updateDoc(userRef, {
            active: !currentActive
        });
        loadUsers();
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        hideLoader();
    }
}

window.deleteUserRecord = async function (email) {
    if (confirm("Remove user record? Note: This does not delete the Firebase Auth account, only the portal access.")) {
        showLoader('Deleting user record...');
        try {
            await deleteDoc(doc(db, USERS_COL, email));
            loadUsers();
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            hideLoader();
        }
    }
}
