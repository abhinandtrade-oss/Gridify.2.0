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
    setDoc,
    limit,
    updateDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let currentMeetingId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.displayName || currentUser.email || "Guest";
        // Check if admin needs to set password
        if (currentUser.providerData.some(p => p.providerId === 'google.com')) {
            await validateAdminSetup(currentUser);
        }

        loadMeetingHistory();

        // Periodically refresh to catch auto-ended meetings
        setInterval(loadMeetingHistory, 60000);
    }
});

// Admin Setup Validation
async function validateAdminSetup(user) {
    try {
        const userDocRef = doc(db, "users", user.uid);
        const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            // If user is Admin AND uses Google AND has NO adminPassword
            if (data.role === 'admin' && !data.adminPassword) {
                await promptSetAdminPassword(userDocRef);
            }
        }
    } catch (e) {
        console.error("Admin validation error:", e);
    }
}

function promptSetAdminPassword(userDocRef) {
    return new Promise((resolve) => {
        // Create modal dynamically
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        `;

        overlay.innerHTML = `
            <div class="glass-panel" style="max-width: 400px; width: 90%; padding: 2rem; border: 1px solid var(--accent);">
                <h3 style="color: var(--accent); margin-bottom: 1rem;">Setup Admin Access</h3>
                <p class="text-muted" style="margin-bottom: 1.5rem;">
                    Your account has <b>Admin privileges</b>. For security, please set a secondary password for accessing the Admin Portal.
                </p>
                <div style="margin-bottom: 1rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Create Password</label>
                    <input type="password" id="newAdminPass" class="form-control" placeholder="Min 6 characters">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Confirm Password</label>
                    <input type="password" id="confirmAdminPass" class="form-control" placeholder="Re-enter password">
                </div>
                <div id="setupError" style="color: var(--danger); font-size: 0.9rem; margin-bottom: 1rem; display: none;"></div>
                <button id="saveAdminPassBtn" class="btn btn-primary" style="width: 100%;">Set Password & Continue</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const btn = document.getElementById('saveAdminPassBtn');
        const err = document.getElementById('setupError');

        btn.onclick = async () => {
            const p1 = document.getElementById('newAdminPass').value;
            const p2 = document.getElementById('confirmAdminPass').value;

            if (p1.length < 6) {
                err.textContent = "Password must be at least 6 characters.";
                err.style.display = 'block';
                return;
            }
            if (p1 !== p2) {
                err.textContent = "Passwords do not match.";
                err.style.display = 'block';
                return;
            }

            btn.textContent = "Saving...";
            btn.disabled = true;

            try {
                await updateDoc(userDocRef, {
                    adminPassword: p1,
                    updatedAt: serverTimestamp()
                });
                overlay.remove();
                resolve();
            } catch (error) {
                console.error("Save error:", error);
                err.textContent = "Failed to save. Please try again.";
                btn.disabled = false;
                btn.textContent = "Set Password & Continue";
            }
        };
    });
}

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
            lastActivity: serverTimestamp(),
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

    // Fix path if serving from subdirectory or standard
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
    historyContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> <p class="text-muted">Loading history...</p></div>';

    try {
        let meetingsToDisplay = [];

        // 1. Try fetching from User History (Joined Meetings)
        const historyQ = query(
            collection(db, "users", currentUser.uid, "meeting_history"),
            orderBy("lastJoined", "desc"),
            limit(10)
        );
        const historySnap = await getDocs(historyQ);

        if (!historySnap.empty) {
            const ids = [];
            const historyMap = new Map();
            historySnap.forEach(docSnap => {
                ids.push(docSnap.id);
                historyMap.set(docSnap.id, docSnap.data());
            });

            // Fetch actual meeting details
            // Note: firestore 'in' query limit is 10, which matches our limit(10)
            const meetingsQ = query(
                collection(db, "meetings"),
                where("meetingId", "in", ids)
            );
            const meetingsSnap = await getDocs(meetingsQ);

            const fetchedMeetingsMap = new Map();
            meetingsSnap.forEach(docSnap => fetchedMeetingsMap.set(docSnap.data().meetingId, docSnap.data()));

            // Order by history and mix in lastJoined
            ids.forEach(id => {
                if (fetchedMeetingsMap.has(id)) {
                    const data = fetchedMeetingsMap.get(id);
                    const histData = historyMap.get(id);
                    meetingsToDisplay.push({
                        ...data,
                        displayDate: histData.lastJoined || data.createdAt
                    });
                }
            });
        }

        // 2. Fallback / Additional: Hosted Meetings (if history is short or empty)
        if (meetingsToDisplay.length < 5) {
            try {
                const hostedQ = query(
                    collection(db, "meetings"),
                    where("hostUid", "==", currentUser.uid),
                    orderBy("createdAt", "desc"),
                    limit(10)
                );
                const hostedSnap = await getDocs(hostedQ);
                hostedSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    // Don't add if already in history list
                    if (!meetingsToDisplay.some(m => m.meetingId === data.meetingId)) {
                        meetingsToDisplay.push({
                            ...data,
                            displayDate: data.createdAt
                        });
                    }
                });
            } catch (hostedErr) {
                console.warn("Hosted meetings query failed (possibly missing index):", hostedErr);
                // If this fails, we still have the history meetings (if any)
            }
        }

        // Sort by displayDate final
        meetingsToDisplay.sort((a, b) => {
            const dateA = a.displayDate ? a.displayDate.seconds : 0;
            const dateB = b.displayDate ? b.displayDate.seconds : 0;
            return dateB - dateA;
        });

        // Limit again after merge
        meetingsToDisplay = meetingsToDisplay.slice(0, 10);

        // 3. Render
        if (meetingsToDisplay.length === 0) {
            historyContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="fas fa-history" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No meeting history found.</p>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = '';
        meetingsToDisplay.forEach((data, index) => {
            const date = data.displayDate ? new Date(data.displayDate.seconds * 1000).toLocaleString() : 'Recently';
            let status = data.status || 'active';

            // Auto-End Check (Lazy background update)
            if (status === 'active' && data.lastActivity) {
                const lastActivity = data.lastActivity.toDate();
                const now = new Date();
                const diffSeconds = (now - lastActivity) / 1000;
                if (diffSeconds > 300) {
                    status = 'ended';
                    updateDoc(doc(db, "meetings", data.meetingId), { status: 'ended' }).catch(console.error);
                }
            }

            const isLatest = index === 0;

            const item = document.createElement('div');
            item.className = `meeting-item ${isLatest ? 'latest-meeting' : ''}`;
            if (isLatest) {
                item.style.borderLeft = '4px solid var(--primary)';
                item.style.background = 'rgba(255, 255, 255, 0.05)';
            }

            item.innerHTML = `
                <div class="meeting-info">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="meeting-title" title="${data.title || 'Untitled Meeting'}">${data.title || 'Untitled Meeting'}</div>
                        ${isLatest ? '<span class="badge" style="background: var(--primary); color: white; padding: 2px 6px; font-size: 0.6rem; border-radius: 4px;">LAST JOINED</span>' : ''}
                    </div>
                    <div class="meeting-meta">${data.meetingId} • ${date} ${data.hostName ? `• Host: ${data.hostName}` : ''}</div>
                </div>
                <div class="meeting-actions">
                    <span class="badge" style="color: ${status === 'active' ? 'var(--success)' : 'var(--text-muted)'}">
                        ${status.toUpperCase()}
                    </span>
                    ${status === 'active' ? `
                        <a href="../meeting/room.html?id=${data.meetingId}" class="btn btn-sm btn-primary" 
                           style="margin-left: 1rem; padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 6px;">
                            <i class="fas fa-sign-in-alt"></i> Re-join
                        </a>
                    ` : ''}
                </div>
            `;
            historyContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Error loading history:", error);
        historyContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem; color: var(--danger);"></i>
                <p>Unable to load history. Please try again later.</p>
                <button id="retryHistoryBtn" class="btn btn-secondary" style="margin-top: 1rem; font-size: 0.8rem;">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
        document.getElementById('retryHistoryBtn')?.addEventListener('click', loadMeetingHistory);
    }
}

// Export for global use (retry button)
window.loadMeetingHistory = loadMeetingHistory;

// Maintenance Mode Logic
let maintenanceInterval = null;

const initMaintenanceListener = () => {
    onSnapshot(doc(db, "config", "public"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.maintenanceMode) {
                const gracePeriod = data.maintenanceGracePeriod || 20;
                triggerMaintenanceMode(gracePeriod);
            } else {
                cancelMaintenanceMode();
            }
        }
    });
};

const cancelMaintenanceMode = () => {
    const overlay = document.getElementById('maintenance-overlay');
    if (overlay) {
        overlay.remove();
    }
    if (maintenanceInterval) {
        clearInterval(maintenanceInterval);
        maintenanceInterval = null;
    }
};

const triggerMaintenanceMode = (gracePeriod = 20) => {
    if (document.getElementById('maintenance-overlay')) return;

    // Create full screen overlay
    const overlay = document.createElement('div');
    overlay.id = 'maintenance-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.98);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        backdrop-filter: blur(10px);
        font-family: 'Inter', sans-serif;
    `;

    overlay.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.05); padding: 3rem; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); max-width: 90%; width: 600px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
            <div style="width: 80px; height: 80px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem auto;">
                <i class="fas fa-tools" style="font-size: 2.5rem; color: #ef4444;"></i>
            </div>
            <h1 style="font-size: 1.8rem; margin-bottom: 1rem; font-weight: 700; line-height: 1.3;">The Portal is Currently Under Maintanance Mode. We will Back Shortly</h1>
            <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 2rem;">Auto logging out in <span id="maintenance-countdown" style="color: #ef4444; font-weight: bold; font-size: 1.4rem; font-variant-numeric: tabular-nums;">${gracePeriod}</span> seconds.</p>
            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div id="maintenance-progress" style="width: 100%; height: 100%; background: #ef4444; transition: width 1s linear;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    let timeLeft = gracePeriod;
    const countdownEl = document.getElementById('maintenance-countdown');
    const progressEl = document.getElementById('maintenance-progress');

    // Clear any existing interval just in case
    if (maintenanceInterval) clearInterval(maintenanceInterval);

    maintenanceInterval = setInterval(() => {
        timeLeft--;
        if (countdownEl) countdownEl.textContent = timeLeft;
        if (progressEl) progressEl.style.width = `${(timeLeft / gracePeriod) * 100}%`;

        if (timeLeft <= 0) {
            clearInterval(maintenanceInterval);
            logoutUser();
        }
    }, 1000);
};

// Start listener immediately
initMaintenanceListener();
