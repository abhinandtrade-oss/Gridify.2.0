import { auth, db } from './firebase-config.js';
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
    serverTimestamp
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

        // Get Local Stream
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        // Initialize WebRTC
        webrtcManager = new WebRTCManager(meetingId, currentUser.uid, currentUser.displayName || "User");

        // Callbacks
        webrtcManager.onRemoteStreamCallback = (peerUid, stream, name) => {
            addRemoteVideo(peerUid, stream, name);
        };

        webrtcManager.onUserLeftCallback = (peerUid) => {
            removeRemoteVideo(peerUid);
        };

        await webrtcManager.init(localStream);

        // Host Controls
        if (meetingData.hostUid === currentUser.uid) {
            setupHostControls();
        }

        // Initialize Chat
        initChat();

    } catch (error) {
        console.error("Join Error:", error);
        alert("Error joining meeting: " + error.message);
        window.location.href = '../dashboard/index.html';
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
