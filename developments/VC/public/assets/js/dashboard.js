import { auth, db } from './config-v3.js';
import { checkAuth, logoutUser } from './auth.js';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let currentMeetingId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;
        loadMeetingHistory();
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', logoutUser);

// Generate Meeting ID
const generateMeetingId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const segment = (length) => {
        let text = '';
        for (let i = 0; i < length; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return text;
    };
    return `${segment(3)}-${segment(4)}-${segment(3)}`;
};

// Create Meeting
document.getElementById('createMeetingBtn').addEventListener('click', async (e) => {
    const btn = e.target;
    const title = document.getElementById('meetingTitle').value || "Untitled Meeting";
    const micEnabled = document.getElementById('micEnabled').checked;
    const camEnabled = document.getElementById('camEnabled').checked;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const meetingId = generateMeetingId();
        currentMeetingId = meetingId;

        // Save to Firestore
        await setDoc(doc(db, "meetings", meetingId), {
            meetingId: meetingId,
            hostUid: currentUser.uid,
            hostName: currentUser.displayName || "Host",
            title: title,
            createdAt: serverTimestamp(),
            status: 'active',
            settings: {
                micDefault: micEnabled,
                camDefault: camEnabled
            }
        });

        // Show Modal instead of redirecting immediately
        showShareModal(meetingId);

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> Create Instant Meeting';

    } catch (error) {
        console.error("Error creating meeting full:", error);
        console.error("Error Code:", error.code);
        console.error("Error Message:", error.message);
        alert("Failed to create meeting: " + error.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> Create Instant Meeting';
    }
});

function showShareModal(meetingId) {
    const modal = document.getElementById('shareModal');
    const input = document.getElementById('shareLinkInput');
    const link = `${window.location.origin}/meeting/room.html?id=${meetingId}`; // Adjust path if needed

    // Fix path if serving from subdirectory or standard
    // Usually origin/meeting/room.html works if 'public' is root.
    // However, if we are in /dashboard/index.html, we need to go up.
    // Let's use absolute path relative to domain.
    const cleanLink = new URL('../meeting/room.html?id=' + meetingId, window.location.href).href;

    input.value = cleanLink;
    modal.style.display = 'flex';
}

// Modal Actions
document.getElementById('copyLinkBtn').addEventListener('click', () => {
    const input = document.getElementById('shareLinkInput');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        const btn = document.getElementById('copyLinkBtn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    });
});

document.getElementById('enterMeetingBtn').addEventListener('click', () => {
    if (currentMeetingId) {
        window.location.href = `../meeting/room.html?id=${currentMeetingId}`;
    }
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('shareModal').style.display = 'none';
    // Optional: Reload history to show the new meeting
    loadMeetingHistory();
});

// Join Meeting
document.getElementById('joinMeetingBtn').addEventListener('click', () => {
    const meetingId = document.getElementById('meetingCodeInput').value.trim();
    if (meetingId) {
        // Maybe validate ID format?
        window.location.href = `../meeting/room.html?id=${meetingId}`;
    } else {
        alert("Please enter a meeting code");
    }
});

// Load History
async function loadMeetingHistory() {
    const historyContainer = document.getElementById('meetingHistory');

    try {
        const q = query(
            collection(db, "meetings"),
            where("hostUid", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyContainer.innerHTML = '<p class="text-muted">No meetings found.</p>';
            return;
        }

        historyContainer.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'Just now';

            const item = document.createElement('div');
            item.className = 'meeting-item';
            item.innerHTML = `
                <div>
                    <strong>${data.title}</strong>
                    <div class="text-muted" style="font-size: 0.85rem;">${data.meetingId} • ${date}</div>
                </div>
                <div>
                    <span class="badge" style="color: ${data.status === 'active' ? 'var(--success)' : 'var(--text-muted)'}">
                        ${data.status.toUpperCase()}
                    </span>
                    ${data.status === 'active' ? `<a href="../meeting/room.html?id=${data.meetingId}" class="btn btn-sm btn-primary" style="margin-left: 1rem; padding: 0.25rem 0.75rem; font-size: 0.8rem;">Re-join</a>` : ''}
                </div>
            `;
            historyContainer.appendChild(item);
        });

    } catch (error) {
        // Console error usually means index missing
        console.error("Error loading history:", error);
        // historyContainer.innerHTML = '<p class="text-danger">Failed to load history (Requires Firestore Index)</p>';
        historyContainer.innerHTML = `<p class="text-muted">History currently unavailable (Index building).</p>`;
    }
}
