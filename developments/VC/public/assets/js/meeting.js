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
import { signInAnonymously, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Super Admin Config
const ADMIN_EMAILS = [
    'admin@gridify.in',
    'superadmin@gridify.in'
];

let meetingId = null;
let currentUser = null;
let hostUid = null;
let hasHostPrivileges = false; // NEW: Controls permissions
let isSuperAdmin = false;      // NEW: Tracks role
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

// Helper: Check Super Admin
async function checkIfSuperAdmin(user) {
    if (!user) return false;
    // 1. Email Check
    if (ADMIN_EMAILS.includes(user.email)) return true;

    // 2. Firestore Role Check
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') return true;
    } catch (e) {
        console.warn("Could not check role:", e);
    }
    return false;
}

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
    currentUser = await checkAuth(false);
    if (!currentUser || (currentUser.isAnonymous && !currentUser.displayName)) {
        showGuestEntryUI();
        return; // Wait for guest login or name entry
    }

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

        // Determine Privileges
        isSuperAdmin = await checkIfSuperAdmin(currentUser);
        hasHostPrivileges = (hostUid === currentUser.uid) || isSuperAdmin;

        if (meetingData.status === 'ended') {
            showToast("Meeting has ended", "error");
            setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
            return;
        }

        document.getElementById('meetingTitle').textContent = meetingData.title;

        // Listen for meeting end
        onSnapshot(meetingRef, (doc) => {
            const data = doc.data();
            if (data && data.status === 'ended') {
                const reason = data.endReason || "The meeting has ended.";
                // Use a persistent alert or just a long toast
                // We'll use a custom confirm modal but just as an alert (hide cancel)
                showPersistentAlert(reason);
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                setTimeout(() => window.location.href = '../dashboard/index.html', 4000);
            }
        });

        // Auto-End Check (Lazy)
        if (meetingData.lastActivity && meetingData.status === 'active') {
            const lastActivity = meetingData.lastActivity.toDate();
            const now = new Date();
            const diffSeconds = (now - lastActivity) / 1000;

            if (diffSeconds > 300) {
                // Confirm inactivity
                await updateDoc(meetingRef, { status: 'ended' });
                showToast("This meeting has expired due to inactivity.", "error");
                setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
                return;
            }
        }

        // Update lastActivity immediately on join to cancel any pending auto-end
        await updateDoc(meetingRef, { lastActivity: serverTimestamp() });
        startHeartbeat();

        // Join Logic
        if (hasHostPrivileges) {
            // Host/Super Admin joins immediately
            await initializeMeetingMediaAndLogic();
            setupHostControls();
            listenForJoinRequests();
            setupParticipantsUI(); // Setup UI for host

            if (isSuperAdmin && hostUid !== currentUser.uid) {
                showToast("Joined with Super Admin Privileges", "success");
            }

        } else {
            // Guest/Regular User
            if (meetingData.autoAdmit) {
                await initializeMeetingMediaAndLogic();
                setupParticipantsUI(); // Guest sees restricted UI
            } else {
                // Must request
                await requestToJoin();
            }
        }

    } catch (error) {
        console.error("Join Error:", error);
        showToast("Error joining meeting: " + error.message, "error");
    }
}



// === WAITING ROOM LOGIC ===
async function requestToJoin() {
    const requestRef = doc(db, "meetings", meetingId, "requests", currentUser.uid);

    // Initial State: Connecting
    showConnectingUI();

    // Initial check/create
    const reqSnap = await getDoc(requestRef);
    const alreadyAccepted = reqSnap.exists() && reqSnap.data().status === 'accepted';

    if (alreadyAccepted) {
        if (!localStream) {
            await initializeMeetingMediaAndLogic();
        }
        hideWaitingRoom();
    } else {
        if (reqSnap.exists() && reqSnap.data().status === 'rejected') {
            // handled by listener
        } else {
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
            showWaitingUI();
        }
    }

    onSnapshot(requestRef, (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'accepted') {
            if (!localStream) {
                initializeMeetingMediaAndLogic();
            }
            hideWaitingRoom();
        } else if (data.status === 'rejected') {
            showWaitingUI();
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

    document.getElementById('retryJoinBtn').style.display = 'inline-flex';

    const btn = document.getElementById('retryJoinBtn');
    btn.onclick = async () => {
        resetWaitingRoomUI();
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

function showGuestEntryUI() {
    document.getElementById('waitingRoom').style.display = 'flex';
    document.getElementById('guestEntryContent').style.display = 'block';
    document.getElementById('waitContent').style.display = 'none';
    document.getElementById('connectingContent').style.display = 'none';

    const nameInput = document.getElementById('guestNameInput');
    const joinBtn = document.getElementById('joinAsGuestBtn');

    const handleJoin = async () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter your name");
            return;
        }

        joinBtn.disabled = true;
        joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';

        try {
            if (!currentUser) {
                const userCredential = await signInAnonymously(auth);
                currentUser = userCredential.user;
            }
            await updateProfile(currentUser, { displayName: name });
            document.getElementById('guestEntryContent').style.display = 'none';
            await joinMeeting();
        } catch (error) {
            console.error("Guest Join Error:", error);
            alert("Failed to join as guest: " + error.message);
            joinBtn.disabled = false;
            joinBtn.innerHTML = 'Join Meeting';
        }
    };

    joinBtn.onclick = handleJoin;
    nameInput.onkeypress = (e) => {
        if (e.key === 'Enter') handleJoin();
    };
}

async function initializeMeetingMediaAndLogic() {
    // Super Admin Default: Turn Off Camera
    if (isSuperAdmin) {
        isCamOn = false;
        // Update UI
        camBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
        camBtn.classList.add('active'); // Status indicator (Red/Off)
    }

    // Get Local Stream
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Disable video track if cam shouldn't be on
        if (!isCamOn) {
            localStream.getVideoTracks().forEach(track => track.enabled = false);
        }

    } catch (mediaError) {
        console.warn("Media access error:", mediaError);
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
    /***** SUPER ADMIN DISPLAY NAME LOGIC *****/
    let displayName = currentUser.displayName || "User";
    if (isSuperAdmin) {
        displayName = "Gridify Tec Team HO";
    }

    webrtcManager = new WebRTCManager(meetingId, currentUser.uid, displayName);

    // Update Local Video Label
    const localContainer = document.getElementById('localVideoContainer');
    const localLabel = localContainer.querySelector('.participant-label');
    if (localLabel) {
        if (displayName === "Gridify Tec Team HO") {
            localLabel.innerHTML = `${displayName} <i class="fas fa-check-circle" style="margin-left: 4px; color: #ef4444;"></i>`;
            localLabel.style.cssText = "color: #22c55e; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.8);";
        } else {
            // Use span for verification targeting
            localLabel.innerHTML = `<span id="v-label-local">${displayName} (You)</span>`;
            checkVerification(currentUser.uid, 'v-label-local');
        }
    }

    webrtcManager.onRemoteStreamCallback = (peerUid, stream, name) => {
        addRemoteVideo(peerUid, stream, name);
    };

    webrtcManager.onUserLeftCallback = (peerUid) => {
        removeRemoteVideo(peerUid);
    };

    await webrtcManager.init(localStream);

    initChat();
    setupParticipantsUI();
    addParticipantToList(currentUser.uid, displayName); // Use the overridden name

    listenForCommands();

    if (!currentUser.isAnonymous) {
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

    /***** GREEN NAME LOGIC *****/
    let nameStyle = "";
    if (name === "Gridify Tec Team HO") {
        nameStyle = "color: #22c55e; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.8);";
    }

    const label = document.createElement('div');
    label.className = 'participant-label';

    if (name === "Gridify Tec Team HO") {
        label.innerHTML = `${name} <i class="fas fa-check-circle" style="margin-left: 4px; color: #ef4444;"></i>`;
    } else {
        // Inner span for name targeting
        label.innerHTML = `<span id="v-label-${peerUid}">${name || "User"}</span>`;
        checkVerification(peerUid, `v-label-${peerUid}`);
    }

    if (nameStyle) label.style.cssText = nameStyle; // Apply style

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

chatBtn.addEventListener('click', () => {
    chatSidebar.classList.add('open');
});

closeChat.addEventListener('click', () => {
    chatSidebar.classList.remove('open');
});

// Chat Logic
function initChat() {
    const q = query(collection(db, "meetings", meetingId, "messages"), orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'chat-msg';

            const isMsgFromHost = (data.uid === hostUid);
            if (isMsgFromHost) {
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

            const canDelete = (hasHostPrivileges && !isRemoved);
            const deleteBtn = canDelete ?
                `<button onclick="deleteChatMessage('${doc.id}')" class="chat-delete-btn" title="Remove Message"><i class="fas fa-trash"></i></button>` : '';

            // Maybe color name here too?
            const senderStyle = (data.sender === "Gridify Tec Team HO") ? "color: #22c55e; font-weight: bold;" : (isMsgFromHost ? 'color: var(--success); font-weight: bold;' : '');

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="chat-sender" style="${senderStyle}">
                        ${data.sender} ${data.sender === "Gridify Tec Team HO" ? '<i class="fas fa-check-circle" style="margin-left: 4px; color: #ef4444;"></i>' : ''} ${isMsgFromHost ? '<span style="font-size:0.7em; border: 1px solid var(--success); padding: 0 4px; border-radius: 4px; margin-left: 4px;">HOST</span>' : ''}
                    </div>
                    ${deleteBtn}
                </div>
                <div style="${contentStyle}">${messageContent}</div>
            `;
            chatMessages.appendChild(div);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

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
            // Use Admin Display Name if applicable
            let senderName = currentUser.displayName || "User";
            if (isSuperAdmin) senderName = "Gridify Tec Team HO";

            await addDoc(collection(db, "meetings", meetingId, "messages"), {
                sender: senderName,
                uid: currentUser.uid,
                text: text,
                createdAt: serverTimestamp()
            });
            chatInput.value = '';
        }
    });
}

function setupHostControls() {
    if (document.getElementById('hostEndBtn')) return;

    const endBtn = document.createElement('button');
    endBtn.id = 'hostEndBtn';
    endBtn.className = 'control-btn';
    endBtn.style.background = '#ef4444';
    endBtn.title = "End Meeting for All";
    endBtn.innerHTML = '<i class="fas fa-power-off"></i>';

    endBtn.addEventListener('click', async () => {
        let reason = "";

        /***** END MEETING LOGIC *****/
        if (isSuperAdmin) {
            reason = await showPrompt("End Meeting for All?", "Please provide a reason to display to all users:");
            if (reason === null) return; // User cancelled
            if (!reason.trim()) reason = "The meeting was ended by the administrator.";
        } else {
            if (!await showConfirm("End meeting for everyone?")) return;
        }

        await updateDoc(doc(db, "meetings", meetingId), {
            status: 'ended',
            endReason: reason,
            endedAt: serverTimestamp()
        });
    });

    document.querySelector('.controls-bar').appendChild(endBtn);
}

function addPinButton(videoTile) {
    const btn = document.createElement('button');
    btn.className = 'pin-btn';
    btn.innerHTML = '<i class="fas fa-thumbtack"></i>';
    btn.title = "Pin/Unpin this video";

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin(videoTile);
    });

    videoTile.appendChild(btn);
}

function togglePin(tile) {
    const isPinned = tile.classList.contains('pinned');
    const mainStage = document.getElementById('mainStage');
    const meetingArea = document.getElementById('meetingArea');
    const videoGrid = document.getElementById('videoGrid');

    const currentlyPinned = document.querySelector('.video-tile.pinned');
    if (currentlyPinned) {
        currentlyPinned.classList.remove('pinned');
        videoGrid.appendChild(currentlyPinned);
    }

    meetingArea.classList.remove('has-pin');
    mainStage.style.display = 'none';

    if (!isPinned || currentlyPinned !== tile) {
        tile.classList.add('pinned');
        meetingArea.classList.add('has-pin');
        mainStage.style.display = 'flex';
        mainStage.innerHTML = '';
        mainStage.appendChild(tile);
    }
}

function setupParticipantsUI() {
    const peopleBtn = document.getElementById('peopleBtn');
    const peopleSidebar = document.getElementById('peopleSidebar');
    const closePeople = document.getElementById('closePeople');
    peopleBtn.addEventListener('click', () => peopleSidebar.classList.add('open'));
    closePeople.addEventListener('click', () => peopleSidebar.classList.remove('open'));
}

function listenForJoinRequests() {
    const list = document.getElementById('joinRequestsList');
    const section = document.getElementById('paramsRequestsSection');
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
                    </div>`;
                list.appendChild(div);
            }
        });

        if (pendingCount > 0) {
            document.getElementById('peopleBtn').style.borderColor = 'var(--accent)';
            document.getElementById('peopleBtn').innerHTML = `MANAGE <span style="font-size: 0.7rem; background: var(--danger); padding: 2px 5px; border-radius: 4px; margin-left: 5px;">${pendingCount}</span>`;
        } else {
            document.getElementById('peopleBtn').style.borderColor = 'var(--border)';
            document.getElementById('peopleBtn').innerHTML = `MANAGE`;
        }
    });

    window.handleAdmit = async (uid, isAccepted) => {
        await updateDoc(doc(db, "meetings", meetingId, "requests", uid), {
            status: isAccepted ? 'accepted' : 'rejected'
        });
    };

    const toggle = document.getElementById('autoAdmitToggle');
    getDoc(doc(db, "meetings", meetingId)).then(snap => {
        if (snap.exists() && snap.data().autoAdmit) toggle.checked = true;
    });

    toggle.addEventListener('change', async (e) => {
        const isEnabled = e.target.checked;
        await updateDoc(doc(db, "meetings", meetingId), { autoAdmit: isEnabled });
        if (isEnabled) {
            const q = query(collection(db, "meetings", meetingId, "requests"), where("status", "==", "pending"));
            const pendingSnaps = await getDocs(q);
            pendingSnaps.forEach(async (d) => {
                await updateDoc(doc(db, "meetings", meetingId, "requests", d.id), { status: 'accepted' });
            });
        }
    });
}

function addParticipantToList(uid, name) {
    const list = document.getElementById('inMeetingList');
    if (document.getElementById(`p-${uid}`)) return;

    const div = document.createElement('div');
    div.id = `p-${uid}`;
    div.className = 'request-item';
    div.style.justifyContent = 'flex-start';
    div.style.gap = '10px';

    const isActualHost = (uid === hostUid);
    /***** GREEN NAME LOGIC *****/
    let nameStyle = "";
    if (name === "Gridify Tec Team HO") {
        nameStyle = "color: #22c55e; font-weight: bold;";
    }

    div.innerHTML = `
        <div style="width: 32px; height: 32px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
            ${name.charAt(0).toUpperCase()}
        </div>
        <div style="font-size: 0.9rem; ${nameStyle}">
            <span id="p-name-${uid}">${name}</span> 
            ${name === "Gridify Tec Team HO" ? '<i class="fas fa-check-circle" style="margin-left: 4px; color: #ef4444;"></i>' : ''}
        </div>
        ${isActualHost ? '<div class="host-badge" style="margin-left:auto;">HOST</div>' : ''}
        
        ${(hasHostPrivileges && uid !== currentUser.uid) ? `
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

    if (name !== "Gridify Tec Team HO") {
        checkVerification(uid, `p-name-${uid}`);
    }
}

// Caching verified status
const verifiedCache = new Set();
async function checkVerification(uid, elementId) {
    if (verifiedCache.has(uid)) {
        appendBlueTick(elementId);
        return;
    }
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists() && snap.data().isVerified) {
            verifiedCache.add(uid);
            appendBlueTick(elementId);
        }
    } catch (e) { }
}

function appendBlueTick(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    // Check if parent (or el) already has the icon
    if (el.parentNode.querySelector('.fa-check-circle')) return;

    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle';
    icon.style.cssText = 'margin-left: 4px; color: #3b82f6; font-size: 0.9em;';

    // Append to parent of the name span, so it sits next to it
    el.parentNode.appendChild(icon);
}

window.toggleMenu = (uid) => {
    document.getElementById(`menu-${uid}`).classList.toggle('show');
};

window.sendHostCommand = async (targetUid, action) => {
    const menu = document.getElementById(`menu-${targetUid}`);
    if (menu) menu.classList.remove('show');

    if (action === 'kick') {
        if (!await showConfirm("Remove this user?")) return;
    }

    try {
        await addDoc(collection(db, "meetings", meetingId, "commands"), {
            targetUid: targetUid,
            action: action,
            startAt: serverTimestamp()
        });
        showToast("Command sent", "success");
    } catch (e) {
        showToast("Failed to send command", "error");
    }
};

function listenForCommands() {
    const q = query(collection(db, "meetings", meetingId, "commands"), where("targetUid", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
                const data = change.doc.data();
                if (!data.startAt) return;
                const cmdTime = data.startAt.toDate().getTime();
                if (Date.now() - cmdTime > 60000) {
                    deleteDoc(doc(db, "meetings", meetingId, "commands", change.doc.id)).catch(console.error);
                    return;
                }

                if (data.action === 'kick') {
                    showToast("You have been removed from the meeting.", "error");
                    setTimeout(() => window.location.href = '../dashboard/index.html', 2000);
                }
                if (data.action === 'mute') {
                    if (isMicOn) {
                        micBtn.click();
                        showToast("The host muted you.", "error");
                    }
                }
                if (data.action === 'stopShare') {
                    if (isSharing) {
                        screenBtn.click();
                        showToast("The host stopped your screen share.", "error");
                    }
                }
                deleteDoc(doc(db, "meetings", meetingId, "commands", change.doc.id));
            }
        });
    });
}

function removeParticipantFromList(uid) {
    const el = document.getElementById(`p-${uid}`);
    if (el) el.remove();
}

window.showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    let icon = '<i class="fas fa-info-circle"></i>';
    if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
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
            btnCancel.removeEventListener('click', onCancel);
        };
        const onConfirm = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        btnOk.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
    });
};

/***** PROMPT HELPER *****/
window.showPrompt = (title, message) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('customPromptModal');
        const titleEl = document.getElementById('promptTitle');
        const msgEl = document.getElementById('promptMessage');
        const inputEl = document.getElementById('promptInput');
        const btnOk = document.getElementById('btnPromptOk');
        const btnCancel = document.getElementById('btnPromptCancel');

        titleEl.textContent = title;
        msgEl.textContent = message;
        inputEl.value = ''; // Reset
        modal.classList.add('show');

        // Focus input
        setTimeout(() => inputEl.focus(), 100);

        const cleanup = () => {
            modal.classList.remove('show');
            btnOk.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
        };

        const onConfirm = () => {
            const val = inputEl.value;
            cleanup();
            resolve(val);
        };

        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        btnOk.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
    });
};


/***** PERSISTENT ALERT HELPER *****/
// Uses showConfirm but without cancel button to force user to acknowledge
function showPersistentAlert(message) {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const btnOk = document.getElementById('btnConfirmOk');
    const btnCancel = document.getElementById('btnConfirmCancel');

    titleEl.textContent = "ATTENTION";
    msgEl.textContent = message;

    // Hide cancel
    btnCancel.style.display = 'none';
    btnOk.textContent = "OK";

    modal.classList.add('show');

    // No promise resolve needed strictly, it just blocks 'thinking'
    btnOk.onclick = () => {
        modal.classList.remove('show');
    };
}

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
        try {
            const meetingRef = doc(db, "meetings", meetingId);
            const snap = await getDoc(meetingRef);
            if (snap.exists() && snap.data().status === 'active') {
                await updateDoc(meetingRef, { lastActivity: serverTimestamp() });
            } else {
                if (heartbeatInterval) clearInterval(heartbeatInterval);
            }
        } catch (e) {
            console.error("Heartbeat failed:", e);
        }
    }, 30000);
}
