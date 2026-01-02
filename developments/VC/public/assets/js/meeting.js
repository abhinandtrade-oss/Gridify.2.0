import { auth, db, rtdb } from './config-v3.js';
import { checkAuth } from './auth.js';
import { WebRTCManager } from './webrtc.js';
import {
    doc,
    getDoc,
    onSnapshot,
    updateDoc,
    collection,
    addDoc,
    query,
    orderBy,
    serverTimestamp,
    setDoc,
    deleteDoc,
    getDocs,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let meetingId = null;
let currentUser = null;
let hostUid = null;
let webrtcManager = null;
let localStream = null;
let isMicOn = true;
let isCamOn = true;
let heartbeatInterval = null;

// UI Elements
const localVideo = document.getElementById('localVideo');
const videoGrid = document.getElementById('videoGrid');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');
const leaveBtn = document.getElementById('leaveBtn');
const screenBtn = document.getElementById('screenBtn');
const chatBtn = document.getElementById('chatBtn');
const chatSidebar = document.getElementById('chatSidebar');
const closeChat = document.getElementById('closeChat');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Get Meeting ID
    const urlParams = new URLSearchParams(window.location.search);
    meetingId = urlParams.get('id');

    if (!meetingId) {
        showToast("No meeting ID provided", "error");
        setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
        return;
    }

    document.getElementById('meetingIdDisplay').textContent = `ID: ${meetingId}`;

    // Auth Check
    currentUser = await checkAuth();
    if (!currentUser) return; // checkAuth redirects

    // Initialize Meeting
    await joinMeeting();

    // Copy Logic using Modal
    const copyBtn = document.getElementById('copyRoomLinkBtn');
    const copyModal = document.getElementById('copySelectionModal');
    const btnCopyID = document.getElementById('btnCopyMeetingID');
    const btnCopyURL = document.getElementById('btnCopyMeetingURL');
    const btnCopyCancel = document.getElementById('btnCopyCancel');

    copyBtn.addEventListener('click', () => {
        copyModal.classList.add('show');
    });

    const closeCopyModal = () => {
        copyModal.classList.remove('show');
    };

    btnCopyCancel.addEventListener('click', closeCopyModal);

    // Close on click outside
    copyModal.addEventListener('click', (e) => {
        if (e.target === copyModal) closeCopyModal();
    });

    btnCopyID.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(meetingId);
            showToast("Meeting ID copied to clipboard!", "success");
        } catch (err) {
            showToast("Failed to copy", "error");
        }
        closeCopyModal();
    });

    btnCopyURL.addEventListener('click', async () => {
        try {
            const url = window.location.href;
            await navigator.clipboard.writeText(url);
            showToast("Meeting URL copied to clipboard!", "success");
        } catch (err) {
            showToast("Failed to copy", "error");
        }
        closeCopyModal();
    });

    // Close Action Menus on Click Outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.participant-actions')) {
            document.querySelectorAll('.action-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
});

async function joinMeeting() {
    try {
        // Get Meeting Details
        const meetingRef = doc(db, "meetings", meetingId);
        const meetingSnap = await getDoc(meetingRef);

        if (!meetingSnap.exists()) {
            showToast("Meeting not found", "error");
            setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
            return;
        }

        const meetingData = meetingSnap.data();
        hostUid = meetingData.hostUid; // Set Global

        if (meetingData.status === 'ended') {
            showToast("Meeting has ended", "error");
            setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
            return;
        }

        document.getElementById('meetingTitle').textContent = meetingData.title;

        // Apply defaults? (We ignore micDefault/camDefault for now, defaulting to ON, or user choice)

        // Listen for meeting end
        onSnapshot(meetingRef, (doc) => {
            const data = doc.data();
            if (data && data.status === 'ended') {
                showToast("The meeting has ended.", "error");
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
            }
        });

        // Auto-End Check (Lazy)
        if (meetingData.lastActivity && meetingData.status === 'active') {
            const lastActivity = meetingData.lastActivity.toDate();
            const now = new Date();
            const diffSeconds = (now - lastActivity) / 1000;

            if (diffSeconds > 300) {
                // Check if anyone is actually in RTDB to be sure
                const participantsRef = ref(rtdb, `rooms/${meetingId}/participants`);
                // Using a quick check here is hard with async in onSnapshot/join flow, 
                // but we can trust lastActivity if we are rigorous.
                // However, to be safe, let's assume if we are joining, we RE-ACTIVATE it if it was within 300s.
                // If it's > 300s, it's really dead.
                await updateDoc(meetingRef, { status: 'ended' });
                showToast("This meeting has expired due to inactivity.", "error");
                setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
                return;
            }
        }

        // Update lastActivity immediately on join to cancel any pending auto-end
        await updateDoc(meetingRef, { lastActivity: serverTimestamp() });
        startHeartbeat();

        if (meetingData.hostUid === currentUser.uid) {
            // Host joins immediately
            await initializeMeetingMediaAndLogic();
            setupHostControls();
            listenForJoinRequests();
            setupParticipantsUI(); // Setup UI for host
        } else {
            // Check Auto-Admit
            if (meetingData.autoAdmit) {
                await initializeMeetingMediaAndLogic();
                setupParticipantsUI(); // Guest sees restricted UI
            } else {
                // Guest must request
                await requestToJoin();
                // initializeMeetingMediaAndLogic called after acceptance
            }
        }

        // Extracted logic to avoid duplication
    } catch (error) {
        console.error("Join Error:", error);
        showToast("Error joining meeting: " + error.message, "error");
    }
}



// === WAITING ROOM LOGIC ===
// === WAITING ROOM LOGIC ===
// === WAITING ROOM LOGIC ===
async function requestToJoin() {
    const requestRef = doc(db, "meetings", meetingId, "requests", currentUser.uid);

    // Initial State: Connecting
    showConnectingUI();

    // Initial check/create
    const reqSnap = await getDoc(requestRef);
    const alreadyAccepted = reqSnap.exists() && reqSnap.data().status === 'accepted';

    if (alreadyAccepted) {
        // Accepted -> Keep "Connecting", init logic, then hide
        if (!localStream) {
            await initializeMeetingMediaAndLogic();
        }
        hideWaitingRoom();
    } else {
        // Not accepted -> check if rejected -> Show Waiting
        if (reqSnap.exists() && reqSnap.data().status === 'rejected') {
            // Let status listener handle UI or specific logic
            // But we need to switch from "Connecting" to something else if status is rejected
            // Actually listener will fire.
        } else {
            // New or Pending -> Show Waiting UI
            if (!reqSnap.exists()) {
                await setDoc(requestRef, {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || "User",
                    status: 'pending',
                    timestamp: serverTimestamp(),
                    attempts: 1
                });
            } else {
                if (typeof reqSnap.data().attempts === 'undefined') {
                    await updateDoc(requestRef, { attempts: 1 });
                }
            }
            showWaitingUI(); // Switch to waiting state
        }
    }

    // Listen for status changes
    onSnapshot(requestRef, (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'accepted') {
            // Accepted -> Show Connecting (briefly maybe?) or just proceed
            // If we were waiting, we can switch to connecting or just hide
            // User requested "Connecting" on rejoining. But here we are joining.
            // Let's just proceed.
            if (!localStream) {
                initializeMeetingMediaAndLogic();
            }
            hideWaitingRoom();
        } else if (data.status === 'rejected') {
            showWaitingUI(); // Ensure overlay is visible
            const attempts = data.attempts || 1;
            if (attempts < 8) {
                showRetryUI(attempts);
            } else {
                showMaxAttemptsUI();
            }
        } else if (data.status === 'pending') {
            showWaitingUI();
        }
    });
}

function showConnectingUI() {
    document.getElementById('waitingRoom').style.display = 'flex';
    document.getElementById('waitContent').style.display = 'none';
    document.getElementById('connectingContent').style.display = 'flex';
}

function showWaitingUI() {
    document.getElementById('waitingRoom').style.display = 'flex';
    document.getElementById('waitContent').style.display = 'block';
    document.getElementById('connectingContent').style.display = 'none';

    // Reset internal waiting items
    document.getElementById('waitSpinner').style.display = 'block';
    document.getElementById('waitTitle').textContent = 'Waiting for Host';
    document.getElementById('waitMessage').textContent = 'The host needs to admit you into the meeting. Please wait...';
    document.getElementById('retryContainer').style.display = 'none';
}

function hideWaitingRoom() {
    document.getElementById('waitingRoom').style.display = 'none';
}

function resetWaitingRoomUI() {
    showWaitingUI();
}




function showRetryUI(attempts) {
    document.getElementById('waitSpinner').style.display = 'none';
    document.getElementById('waitTitle').textContent = 'Request Denied';
    document.getElementById('waitMessage').textContent = `The host denied your request. You have ${8 - attempts} attempts remaining.`;
    document.getElementById('retryContainer').style.display = 'block';

    // Reset button display in case it was hidden by max attempts
    document.getElementById('retryJoinBtn').style.display = 'inline-flex';

    const btn = document.getElementById('retryJoinBtn');
    btn.onclick = async () => {
        resetWaitingRoomUI(); // Show spinner immediately
        await updateDoc(doc(db, "meetings", meetingId, "requests", currentUser.uid), {
            status: 'pending',
            timestamp: serverTimestamp(),
            attempts: attempts + 1
        });
    };
}

function showMaxAttemptsUI() {
    document.getElementById('waitSpinner').style.display = 'none';
    document.getElementById('waitTitle').textContent = 'Access Denied';
    document.getElementById('waitMessage').textContent = "You have exceeded the maximum number of join attempts.";
    document.getElementById('retryContainer').style.display = 'block';
    document.getElementById('retryJoinBtn').style.display = 'none';
}

async function initializeMeetingMediaAndLogic() {
    // Get Local Stream
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (mediaError) {
        console.warn("Media access error:", mediaError);
        // ... [Reuse error handling logic if possible, or just duplicate for safety/speed]
        if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError' || mediaError.message.includes('Device in use')) {
            const proceed = await showConfirm("Camera/Mic is being used. Try with Audio only?");
            if (proceed) {
                try { localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); }
                catch (e) { localStream = new MediaStream(); }
            } else { return; }
        } else {
            localStream = new MediaStream();
        }
    }

    localVideo.srcObject = localStream;
    addPinButton(localVideo.parentElement);

    // Initialize WebRTC
    webrtcManager = new WebRTCManager(meetingId, currentUser.uid, currentUser.displayName || "User");

    webrtcManager.onRemoteStreamCallback = (peerUid, stream, name) => {
        addRemoteVideo(peerUid, stream, name);
    };

    webrtcManager.onUserLeftCallback = (peerUid) => {
        removeRemoteVideo(peerUid);
    };

    await webrtcManager.init(localStream);

    // Host controls check (redundant for guest but harmless)
    // Chat
    initChat();

    // Participants Logic
    setupParticipantsUI();
    addParticipantToList(currentUser.uid, currentUser.displayName || "You (Host/User)");

    // Listen for Host Commands
    listenForCommands();

    // ADDED: Save to User History
    try {
        const historyRef = doc(db, "users", currentUser.uid, "meeting_history", meetingId);
        await setDoc(historyRef, {
            meetingId: meetingId,
            lastJoined: serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.error("Failed to save meeting history:", err);
    }
}


function addRemoteVideo(peerUid, stream, name) {
    if (document.getElementById(`video-${peerUid}`)) return;

    const div = document.createElement('div');
    div.className = 'video-tile';
    div.id = `video-${peerUid}`;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const label = document.createElement('div');
    label.className = 'participant-label';
    label.textContent = name || "User";

    div.appendChild(video);
    div.appendChild(label);
    addPinButton(div);
    videoGrid.appendChild(div);
    updateParticipantCount();
    addParticipantToList(peerUid, name);
}

function removeRemoteVideo(peerUid) {
    const el = document.getElementById(`video-${peerUid}`);
    if (el) el.remove();
    updateParticipantCount();
    removeParticipantFromList(peerUid);
}

function updateParticipantCount() {
    const count = videoGrid.children.length; // Approximation
    const el = document.getElementById('participantCount');
    if (el) {
        el.innerHTML = `<i class="fas fa-users"></i> ${count}`;
    }
}

// Controls
micBtn.addEventListener('click', () => {
    isMicOn = !isMicOn;
    webrtcManager.toggleAudio(isMicOn);
    micBtn.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    micBtn.classList.toggle('active', !isMicOn);
});

camBtn.addEventListener('click', () => {
    isCamOn = !isCamOn;
    webrtcManager.toggleVideo(isCamOn);
    camBtn.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    camBtn.classList.toggle('active', !isCamOn);
});

leaveBtn.addEventListener('click', async () => {
    if (await showConfirm("Are you sure you want to leave?")) {
        if (webrtcManager) webrtcManager.cleanup();
        window.location.href = '../dashboard/index.html';
    }
});

let isSharing = false;
screenBtn.addEventListener('click', async () => {
    if (!isSharing) {
        const stream = await webrtcManager.shareScreen();
        if (stream) {
            localVideo.srcObject = stream;
            isSharing = true;
            screenBtn.classList.add('active');

            // Revert when ended
            stream.getVideoTracks()[0].onended = () => {
                localVideo.srcObject = localStream;
                isSharing = false;
                screenBtn.classList.remove('active');
                webrtcManager.stopScreenShare();
            };
        }
    } else {
        localVideo.srcObject = localStream;
        webrtcManager.stopScreenShare();
        isSharing = false;
        screenBtn.classList.remove('active');
    }
});

// Chat UI Toggle
chatBtn.addEventListener('click', () => {
    chatSidebar.classList.add('open');
});

closeChat.addEventListener('click', () => {
    chatSidebar.classList.remove('open');
});

// Chat Logic
// Chat Logic
function initChat() {
    const q = query(collection(db, "meetings", meetingId, "messages"), orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'chat-msg';

            // Highlight Host Messages
            const isHost = (data.uid === hostUid);
            if (isHost) {
                div.classList.add('host-msg');
            }

            const isRemoved = data.isRemoved === true;
            let messageContent = data.text;
            let contentStyle = '';

            if (isRemoved) {
                messageContent = '<i class="fas fa-ban"></i> <em>Chat removed by host</em>';
                contentStyle = 'color: var(--text-muted); font-style: italic;';
                div.style.opacity = '0.7';
            }

            // Delete button for Host (if not already removed)
            const deleteBtn = (currentUser.uid === hostUid && !isRemoved) ?
                `<button onclick="deleteChatMessage('${doc.id}')" class="chat-delete-btn" title="Remove Message"><i class="fas fa-trash"></i></button>` : '';

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="chat-sender" style="${isHost ? 'color: var(--success); font-weight: bold;' : ''}">
                        ${data.sender} ${isHost ? '<span style="font-size:0.7em; border: 1px solid var(--success); padding: 0 4px; border-radius: 4px; margin-left: 4px;">HOST</span>' : ''}
                    </div>
                    ${deleteBtn}
                </div>
                <div style="${contentStyle}">${messageContent}</div>
            `;
            chatMessages.appendChild(div);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Global delete handler
    window.deleteChatMessage = async (msgId) => {
        if (!await showConfirm("Remove this message permanently?")) return;
        await updateDoc(doc(db, "meetings", meetingId, "messages", msgId), {
            text: "Chat removed by host",
            isRemoved: true
        });
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) {
            await addDoc(collection(db, "meetings", meetingId, "messages"), {
                sender: currentUser.displayName || "User",
                uid: currentUser.uid, // Add UID for identification
                text: text,
                createdAt: serverTimestamp()
            });
            chatInput.value = '';
        }
    });
}

function setupHostControls() {
    const endBtn = document.createElement('button');
    endBtn.className = 'control-btn';
    endBtn.style.background = '#ef4444'; // Red
    endBtn.title = "End Meeting for All";
    endBtn.innerHTML = '<i class="fas fa-power-off"></i>';

    endBtn.addEventListener('click', async () => {
        if (await showConfirm("End meeting for everyone?")) {
            await updateDoc(doc(db, "meetings", meetingId), {
                status: 'ended'
            });
            // Cleanup will happen via local listener or immediate redirect
        }
    });

    // Replace leave button or add next to it?
    // Let's add it
    document.querySelector('.controls-bar').appendChild(endBtn);
}

function addPinButton(videoTile) {
    const btn = document.createElement('button');
    btn.className = 'pin-btn';
    btn.innerHTML = '<i class="fas fa-thumbtack"></i>';
    btn.title = "Pin/Unpin this video";

    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent other clicks
        togglePin(videoTile);
    });

    videoTile.appendChild(btn);
}

function togglePin(tile) {
    const isPinned = tile.classList.contains('pinned');
    const mainStage = document.getElementById('mainStage');
    const meetingArea = document.getElementById('meetingArea');
    const videoGrid = document.getElementById('videoGrid');

    // Unpin all first
    const currentlyPinned = document.querySelector('.video-tile.pinned');
    if (currentlyPinned) {
        currentlyPinned.classList.remove('pinned');
        // Move back to grid
        videoGrid.appendChild(currentlyPinned);
    }

    // Reset layout
    meetingArea.classList.remove('has-pin');
    mainStage.style.display = 'none';

    // If it wasn't the same tile that was just unpinned, pin it now
    if (!isPinned || currentlyPinned !== tile) {
        tile.classList.add('pinned');
        meetingArea.classList.add('has-pin');
        mainStage.style.display = 'flex';

        // Move to Stage
        mainStage.innerHTML = ''; // Clear just in case
        mainStage.appendChild(tile);
    }
}

// === HOST & PARTICIPANT UI LOGIC ===

function setupParticipantsUI() {
    const peopleBtn = document.getElementById('peopleBtn');
    const peopleSidebar = document.getElementById('peopleSidebar');
    const closePeople = document.getElementById('closePeople');

    peopleBtn.addEventListener('click', () => {
        peopleSidebar.classList.add('open');
    });

    closePeople.addEventListener('click', () => {
        peopleSidebar.classList.remove('open');
    });
}

function listenForJoinRequests() {
    const list = document.getElementById('joinRequestsList');
    const section = document.getElementById('paramsRequestsSection');

    // Show the section
    section.style.display = 'block';

    const q = query(collection(db, "meetings", meetingId, "requests"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        list.innerHTML = '';
        let pendingCount = 0;

        snapshot.forEach((doc) => {
            const req = doc.data();
            if (req.status === 'pending') {
                pendingCount++;
                const div = document.createElement('div');
                div.className = 'request-item';
                div.innerHTML = `
                    <div style="font-weight: 500;">${req.displayName}</div>
                    <div class="request-actions">
                        <button class="icon-btn btn-accept" onclick="handleAdmit('${doc.id}', true)"><i class="fas fa-check"></i></button>
                        <button class="icon-btn btn-reject" onclick="handleAdmit('${doc.id}', false)"><i class="fas fa-times"></i></button>
                    </div>
                `;
                list.appendChild(div);
            }
        });

        // Update badge or alert if needed
        if (pendingCount > 0) {
            document.getElementById('peopleBtn').style.borderColor = 'var(--accent)';
            // Keep "MANAGE" text and add badge
            document.getElementById('peopleBtn').innerHTML = `MANAGE <span style="font-size: 0.7rem; background: var(--danger); padding: 2px 5px; border-radius: 4px; margin-left: 5px;">${pendingCount}</span>`;
        } else {
            document.getElementById('peopleBtn').style.borderColor = 'var(--border)';
            document.getElementById('peopleBtn').innerHTML = `MANAGE`;
        }
    });

    // Attach global handler (hacky but effective against module scope)
    window.handleAdmit = async (uid, isAccepted) => {
        await updateDoc(doc(db, "meetings", meetingId, "requests", uid), {
            status: isAccepted ? 'accepted' : 'rejected'
        });
    };

    // Auto Admit Toggle Logic
    const toggle = document.getElementById('autoAdmitToggle');
    // Set initial state
    getDoc(doc(db, "meetings", meetingId)).then(snap => {
        if (snap.exists() && snap.data().autoAdmit) {
            toggle.checked = true;
        }
    });

    toggle.addEventListener('change', async (e) => {
        const isEnabled = e.target.checked;
        await updateDoc(doc(db, "meetings", meetingId), {
            autoAdmit: isEnabled
        });

        if (isEnabled) {
            // Auto-accept all pending requests
            const q = query(collection(db, "meetings", meetingId, "requests"), where("status", "==", "pending"));
            const pendingSnaps = await getDocs(q);
            pendingSnaps.forEach(async (d) => {
                await updateDoc(doc(db, "meetings", meetingId, "requests", d.id), {
                    status: 'accepted'
                });
            });
        }
    });
}

function addParticipantToList(uid, name) {
    const list = document.getElementById('inMeetingList');
    if (document.getElementById(`p-${uid}`)) return;

    const div = document.createElement('div');
    div.id = `p-${uid}`;
    div.className = 'request-item'; // Reuse style for simplicity or add new class
    // Simple row style
    div.style.justifyContent = 'flex-start';
    div.style.gap = '10px';

    div.innerHTML = `
        <div style="width: 32px; height: 32px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
            ${name.charAt(0).toUpperCase()}
        </div>
        <div style="font-size: 0.9rem;">${name}</div>
        ${uid === hostUid ? '<div class="host-badge" style="margin-left:auto;">HOST</div>' : ''}
        
        ${(currentUser.uid === hostUid && uid !== currentUser.uid) ? `
        <div class="participant-actions">
            <button class="icon-btn" onclick="toggleMenu('${uid}')" style="width: 24px; height: 24px; font-size: 0.8rem;">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div id="menu-${uid}" class="action-menu">
                <button class="action-item" onclick="sendHostCommand('${uid}', 'mute')">
                    <i class="fas fa-microphone-slash"></i> Mute Audio
                </button>
                <button class="action-item" onclick="sendHostCommand('${uid}', 'stopShare')">
                    <i class="fas fa-desktop"></i> Stop Share
                </button>
                <button class="action-item danger" onclick="sendHostCommand('${uid}', 'kick')">
                    <i class="fas fa-ban"></i> Remove
                </button>
            </div>
        </div>
        ` : ''}
    `;
    list.appendChild(div);
}

// Global scope for onclick handlers
window.toggleMenu = (uid) => {
    document.getElementById(`menu-${uid}`).classList.toggle('show');
    // auto close others? maybe later.
};

window.sendHostCommand = async (targetUid, action) => {
    // Close menu
    const menu = document.getElementById(`menu-${targetUid}`);
    if (menu) menu.classList.remove('show');

    if (action === 'kick') {
        if (!await showConfirm("Remove this user?")) return;
    }

    console.log(`Sending host command: ${action} to ${targetUid}`);
    try {
        await addDoc(collection(db, "meetings", meetingId, "commands"), {
            targetUid: targetUid,
            action: action,
            startAt: serverTimestamp()
        });
        showToast("Command sent", "success");
    } catch (e) {
        console.error("Failed to send command:", e);
        showToast("Failed to send command", "error");
    }
};

function listenForCommands() {
    const q = query(collection(db, "meetings", meetingId, "commands"), where("targetUid", "==", currentUser.uid));

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
                const data = change.doc.data();
                console.log(`[Command Listener] Event: ${change.type}, Action: ${data.action}, ID: ${change.doc.id}`, data);

                const hasPendingWrite = change.doc.metadata.hasPendingWrites;

                // If timestamp is missing (local pending write or latency), skip and wait for 'modified' with timestamp
                if (!data.startAt) {
                    console.log("[Command Listener] Missing startAt timestamp, waiting for update...");
                    return;
                }

                // Ignore commands if they are local writes (we want to process only confirmed server writes? 
                // Actually target != sender usually, so pendingWrites is false.

                // Ignore old commands (> 60 seconds) to prevent loops on rejoin
                // Note: toDate() might fail if startAt is null, checked above.
                const cmdTime = data.startAt.toDate().getTime();
                const now = Date.now();
                if (now - cmdTime > 60000) {
                    // Clean up old command silently
                    console.log(`[Command Listener] Ignoring old command (${Math.round((now - cmdTime) / 1000)}s old). Cleaning up.`);
                    deleteDoc(doc(db, "meetings", meetingId, "commands", change.doc.id)).catch(console.error);
                    return;
                }

                console.log("[Command Listener] Executing command:", data.action);

                // Logic:
                if (data.action === 'kick') {
                    showToast("You have been removed from the meeting.", "error");
                    setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
                }
                if (data.action === 'mute') {
                    if (isMicOn) {
                        micBtn.click(); // toggle off
                        showToast("The host muted you.", "error");
                    } else {
                        console.log("[Command Listener] Mic already off, no action needed.");
                    }
                }
                if (data.action === 'stopShare') {
                    if (isSharing) {
                        screenBtn.click(); // toggle off
                        showToast("The host stopped your screen share.", "error");
                    } else {
                        console.log("[Command Listener] Sharing already off, no action needed.");
                    }
                }

                // Cleanup command to prevent re-run
                deleteDoc(doc(db, "meetings", meetingId, "commands", change.doc.id))
                    .then(() => console.log("[Command Listener] Command cleaned up successfully."))
                    .catch(e => {
                        console.error("[Command Listener] Failed to cleanup command:", e);
                        // If it fails, that's okay, the timestamp check protects us next time
                    });
            }
        });
    });
}

function removeParticipantFromList(uid) {
    const el = document.getElementById(`p-${uid}`);
    if (el) el.remove();
}

// === HELPER FUNCTIONS FOR TOAST/MODAL ===
window.showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;

    let icon = '<i class="fas fa-info-circle"></i>';
    if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.showConfirm = (message) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const msgEl = document.getElementById('confirmMessage');
        const btnOk = document.getElementById('btnConfirmOk');
        const btnCancel = document.getElementById('btnConfirmCancel');

        msgEl.textContent = message;
        modal.classList.add('show');

        const cleanup = () => {
            modal.classList.remove('show');
            btnOk.removeEventListener('click', onConfirm);
            btnConfirmCancel.removeEventListener('click', onCancel); // Note: using id element directly works in browsers but better to use ref
            btnCancel.removeEventListener('click', onCancel); // Just to be safe with var
        };

        const onConfirm = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        btnOk.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
    });
};

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(async () => {
        try {
            const meetingRef = doc(db, "meetings", meetingId);
            // Only update if the meeting is still active
            const snap = await getDoc(meetingRef);
            if (snap.exists() && snap.data().status === 'active') {
                await updateDoc(meetingRef, {
                    lastActivity: serverTimestamp()
                });
            } else {
                if (heartbeatInterval) clearInterval(heartbeatInterval);
            }
        } catch (e) {
            console.error("Heartbeat failed:", e);
        }
    }, 30000); // Every 30 seconds
}
