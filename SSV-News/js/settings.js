// settings.js - Handle System Settings
import { auth, db } from './firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const SETTINGS_DOC = 'drive_config';
const SETTINGS_COL = 'settings';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        const displayEl = document.getElementById('user-display-name');
        if (displayEl) displayEl.textContent = user.email;

        // Check role and toggle admin-only elements
        const userDocRef = doc(db, 'users', user.email);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            await signOut(auth);
            window.location.href = '../login.html';
            return;
        }

        const userData = userDocSnap.data();

        if (userData.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
        } else {
            // If reporter tries to access settings, redirect them
            window.location.href = 'dashboard.html';
            return;
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => signOut(auth).then(() => location.href = '../login.html');
        }

        // --- Security Check Logic ---
        const authModal = document.getElementById('auth-modal');
        const mainContent = document.getElementById('main-content');
        const confirmBtn = document.getElementById('auth-confirm-btn');
        const cancelBtn = document.getElementById('auth-cancel-btn');
        const passwordInput = document.getElementById('auth-password');

        // Cancel -> Redirect back
        cancelBtn.onclick = () => window.location.href = 'dashboard.html';

        // Confirm -> Check password
        confirmBtn.onclick = async () => {
            const password = passwordInput.value;
            if (!password) {
                alert("Please enter password");
                return;
            }

            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
            confirmBtn.disabled = true;

            try {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);

                // Success
                authModal.style.display = 'none';
                mainContent.style.display = 'block';

                // Load existing settings only after auth success
                showLoader('Loading settings...');
                await loadSettings();
                hideLoader();

            } catch (error) {
                console.error("Auth error:", error);
                alert("Incorrect password. Access denied.");
                confirmBtn.innerHTML = 'Confirm Access';
                confirmBtn.disabled = false;
                passwordInput.value = '';
            }
        };

        // Allow Enter key to submit
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });

        // Setup Event Listeners for Settings (only if we get here?)
        // Actually, we can set them up but they won't be clickable until modal is gone
        const copyBtn = document.getElementById('copy-script-btn');
        const saveBtn = document.getElementById('save-settings-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', copyScriptToClipboard);
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', saveSettings);
        }
    });
});

async function loadSettings() {
    try {
        const docRef = doc(db, SETTINGS_COL, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const urlInput = document.getElementById('drive-script-url');
            if (urlInput) urlInput.value = data.scriptUrl || '';
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

async function saveSettings() {
    const urlInput = document.getElementById('drive-script-url');
    const scriptUrl = urlInput.value.trim();

    if (!scriptUrl) {
        alert("Please enter a valid Google Script Web App URL.");
        return;
    }

    if (!scriptUrl.startsWith('https://script.google.com/')) {
        alert("Invalid URL. It should start with https://script.google.com/");
        return;
    }

    const saveBtn = document.getElementById('save-settings-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    try {
        showLoader('Saving settings...');
        const docRef = doc(db, SETTINGS_COL, SETTINGS_DOC);
        await setDoc(docRef, {
            scriptUrl: scriptUrl,
            updatedBy: auth.currentUser.email,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        alert("Settings saved successfully!");
    } catch (error) {
        console.error("Error saving settings:", error);
        alert("Error saving: " + error.message);
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        hideLoader();
    }
}

function copyScriptToClipboard() {
    const code = document.getElementById('google-script-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        const copyBtn = document.getElementById('copy-script-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Coiped!';
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert("Failed to copy script. Please select and copy manually.");
    });
}
