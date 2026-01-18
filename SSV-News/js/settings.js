// settings.js - Handle System Settings
import { auth, db } from './firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const SETTINGS_DOC = 'drive_config';
const SETTINGS_COL = 'settings';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        // Check if user is admin (optional, depending on your auth structure)
        // For now, we assume if they can reach the admin folder, they are authorized.

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

        // Load existing settings
        showLoader('Loading settings...');
        await loadSettings();
        hideLoader();

        // Setup Event Listeners
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
