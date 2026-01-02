import { auth, db } from './config-v3.js';
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
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let meetingId = null;
let currentUser = null;
let webrtcManager = null;
let localStream = null;
let isMicOn = true;
let isCamOn = true;

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
        alert("No meeting ID provided");
        window.location.href = '../dashboard/index.html';
        return;
    }

    document.getElementById('meetingIdDisplay').textContent = `ID: ${meetingId}`;

    // Auth Check
    currentUser = await checkAuth();
    if (!currentUser) return; // checkAuth redirects

    // Initialize Meeting
    await joinMeeting();
});

async function joinMeeting() {
    try {
        // Get Meeting Details
        const meetingRef = doc(db, "meetings", meetingId);
        const meetingSnap = await getDoc(meetingRef);

        if (!meetingSnap.exists()) {
            alert("Meeting not found");
            window.location.href = '../dashboard/index.html';
            return;
        }

        const meetingData = meetingSnap.data();
        if (meetingData.status === 'ended') {
            alert("Meeting has ended");
            window.location.href = '../dashboard/index.html';
            return;
        }

        document.getElementById('meetingTitle').textContent = meetingData.title;

        // Apply defaults? (We ignore micDefault/camDefault for now, defaulting to ON, or user choice)

        // Listen for meeting end
        onSnapshot(meetingRef, (doc) => {
            const data = doc.data();
            if (data && data.status === 'ended') {
                alert("The host has ended the meeting.");
                window.location.href = '../dashboard/index.html';
            }
        });

        if (meetingData.hostUid === currentUser.uid) {
            // Host joins immediately
            await initializeMeetingMediaAndLogic();
            setupHostControls();
            listenForJoinRequests();
            setupParticipantsUI(); // Setup UI for host
        } else {
            // Guest must request
            await requestToJoin();
            // initializeMeetingMediaAndLogic called after acceptance
        }

        // Extracted logic to avoid duplication
    } catch (error) {
        console.error("Join Error:", error);
        alert("Error joining meeting: " + error.message);
    }
}



// === WAITING ROOM LOGIC ===
async function requestToJoin() {
    // Show Waiting Room UI
    document.getElementById('waitingRoom').style.display = 'flex';

    const requestRef = doc(db, "meetings", meetingId, "requests", currentUser.uid);

    // Check if we already have a request
    const reqSnap = await getDoc(requestRef);
    if (!reqSnap.exists()) {
        await setDoc(requestRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || "User",
            status: 'pending',
            timestamp: serverTimestamp()
        });
    } else {
        // If rejected previously, maybe update to pending again? Or just listen.
        const data = reqSnap.data();
        if (data.status === 'rejected') {
            alert("The host has denied your request to join.");
            window.location.href = '../dashboard/index.html';
            return;
        }
    }

    // Listen for status changes
    onSnapshot(requestRef, (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'accepted') {
            // Hide waiting room and proceed
            document.getElementById('waitingRoom').style.display = 'none';
            // Start the actual join process (media, webrtc)
            initializeMeetingMediaAndLogic();
        } else if (data.status === 'rejected') {
            alert("The host has denied your request to join.");
            window.location.href = '../dashboard/index.html';
        }
    });
}

async function initializeMeetingMediaAndLogic() {
    // Get Local Stream
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (mediaError) {
        console.warn("Media access error:", mediaError);
        // ... [Reuse error handling logic if possible, or just duplicate for safety/speed]
        if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError' || mediaError.message.includes('Device in use')) {
            const proceed = confirm("Camera/Mic is being used. Try with Audio only?");
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
}

function removeRemoteVideo(peerUid) {
    const el = document.getElementById(`video-${peerUid}`);
    if (el) el.remove();
    updateParticipantCount();
}

function updateParticipantCount() {
    const count = videoGrid.children.length; // Approximation
    document.getElementById('participantCount').innerHTML = `<i class="fas fa-users"></i> ${count}`;
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
    if (confirm("Are you sure you want to leave?")) {
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
function initChat() {
    const q = query(collection(db, "meetings", meetingId, "messages"), orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'chat-msg';
            div.innerHTML = `
                <div class="chat-sender">${data.sender}</div>
                <div>${data.text}</div>
            `;
            chatMessages.appendChild(div);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) {
            await addDoc(collection(db, "meetings", meetingId, "messages"), {
                sender: currentUser.displayName || "User",
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
        if (confirm("End meeting for everyone?")) {
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
            document.getElementById('peopleBtn').innerHTML = `<i class="fas fa-user-friends"></i> <span style="font-size: 0.7rem; background: var(--danger); padding: 2px 5px; border-radius: 4px; margin-left: 5px;">${pendingCount}</span>`;
        } else {
            document.getElementById('peopleBtn').style.borderColor = 'var(--border)';
            document.getElementById('peopleBtn').innerHTML = `<i class="fas fa-user-friends"></i>`;
        }
    });

    // Attach global handler (hacky but effective against module scope)
    window.handleAdmit = async (uid, isAccepted) => {
        await updateDoc(doc(db, "meetings", meetingId, "requests", uid), {
            status: isAccepted ? 'accepted' : 'rejected'
        });
    };
}
