import { db, rtdb } from './config-v3.js';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    doc,
    deleteDoc,
    getDocs,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    ref,
    set,
    onDisconnect,
    remove,
    onChildAdded,
    onChildRemoved
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const servers = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        }
    ],
    iceCandidatePoolSize: 10,
};

export class WebRTCManager {
    constructor(meetingId, userId, userName) {
        this.meetingId = meetingId;
        this.userId = userId;
        this.userName = userName;
        this.localStream = null;
        this.peerConnections = {}; // uid -> RTCPeerConnection
        this.remoteStreams = {}; // uid -> MediaStream
        this.remoteUserNames = {}; // uid -> string
        this.onRemoteStreamCallback = null;
        this.onUserLeftCallback = null;

        this.unsubSignals = null;

        // Audio mixing state
        this.audioContext = null;
        this.mixedAudioTrack = null;
        this.micGainNode = null;
    }

    async init(localStream) {
        this.localStream = localStream;
        await this.joinPresence();
        this.listenForSignals();
    }

    async joinPresence() {
        // Set presence in RTDB
        const userRef = ref(rtdb, `rooms/${this.meetingId}/participants/${this.userId}`);

        onDisconnect(userRef).remove();

        await set(userRef, {
            name: this.userName,
            joinedAt: Date.now()
        });

        const participantsRef = ref(rtdb, `rooms/${this.meetingId}/participants`);

        onChildAdded(participantsRef, (snapshot) => {
            const peerUid = snapshot.key;
            const peerData = snapshot.val();

            if (peerUid !== this.userId) {
                this.remoteUserNames[peerUid] = peerData.name || "User";
                // Collision handling: Lexicographically smaller UID initiates.
                if (this.userId < peerUid) {
                    console.log(`Initiating connection to ${peerUid}`);
                    this.createPeerConnection(peerUid, true);
                }
            }
        });

        onChildRemoved(participantsRef, (snapshot) => {
            const peerUid = snapshot.key;
            this.closeConnection(peerUid);
            if (this.onUserLeftCallback) this.onUserLeftCallback(peerUid);
        });
    }

    listenForSignals() {
        const q = query(
            collection(db, "rooms", this.meetingId, "signals"),
            where("to", "==", this.userId)
        );

        this.unsubSignals = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    const signal = change.doc.data();
                    const fromUid = signal.from;

                    // Delete processed signal
                    await deleteDoc(change.doc.ref);

                    await this.handleSignal(fromUid, signal);
                }
            });
        });
    }

    async handleSignal(fromUid, signal) {
        if (signal.type === 'offer') {
            await this.createPeerConnection(fromUid, false);
            const pc = this.peerConnections[fromUid];
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await this.sendSignal('answer', answer, fromUid);

        } else if (signal.type === 'answer') {
            const pc = this.peerConnections[fromUid];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            }
        } else if (signal.type === 'candidate') {
            const pc = this.peerConnections[fromUid];
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
                } catch (e) {
                    console.error("Error adding candidate", e);
                }
            }
        }
    }

    async createPeerConnection(peerUid, isInitiator) {
        if (this.peerConnections[peerUid]) return;

        const pc = new RTCPeerConnection(servers);
        this.peerConnections[peerUid] = pc;

        this.localStream.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal('candidate', event.candidate.toJSON(), peerUid);
            }
        };

        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            this.remoteStreams[peerUid] = remoteStream;
            if (this.onRemoteStreamCallback) {
                this.onRemoteStreamCallback(peerUid, remoteStream, this.remoteUserNames[peerUid]);
            }
        };

        if (isInitiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await this.sendSignal('offer', offer, peerUid);
        }

        return pc;
    }

    async sendSignal(type, payload, toUid) {
        await addDoc(collection(db, "rooms", this.meetingId, "signals"), {
            type,
            payload,
            from: this.userId,
            to: toUid,
            createdAt: serverTimestamp()
        });
    }

    toggleAudio(enabled) {
        this.localStream.getAudioTracks().forEach(track => track.enabled = enabled);
        if (this.micGainNode) {
            this.micGainNode.gain.value = enabled ? 1 : 0;
        }
    }

    toggleVideo(enabled) {
        this.localStream.getVideoTracks().forEach(track => track.enabled = enabled);
    }

    async shareScreen() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0];

            // Replace Video Track
            Object.values(this.peerConnections).forEach(pc => {
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(screenTrack);
                }
            });

            // Mix Audio Tracks if system audio is available
            if (screenAudioTrack) {
                const micTrack = this.localStream.getAudioTracks()[0];
                let mixedStream;

                if (micTrack) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const micSource = this.audioContext.createMediaStreamSource(new MediaStream([micTrack]));
                    const screenSource = this.audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));

                    this.micGainNode = this.audioContext.createGain();
                    this.micGainNode.gain.value = micTrack.enabled ? 1 : 0;

                    const destination = this.audioContext.createMediaStreamDestination();

                    micSource.connect(this.micGainNode).connect(destination);
                    screenSource.connect(destination);
                    mixedStream = destination.stream;
                } else {
                    mixedStream = new MediaStream([screenAudioTrack]);
                }

                const mixedTrack = mixedStream.getAudioTracks()[0];
                this.mixedAudioTrack = mixedTrack;

                Object.values(this.peerConnections).forEach(pc => {
                    const senders = pc.getSenders();
                    const audioSender = senders.find(s => s.track.kind === 'audio');
                    if (audioSender) {
                        audioSender.replaceTrack(mixedTrack);
                    }
                });
            }

            screenTrack.onended = () => {
                this.stopScreenShare();
            };

            return screenStream;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    stopScreenShare() {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const micTrack = this.localStream.getAudioTracks()[0];

        Object.values(this.peerConnections).forEach(pc => {
            const senders = pc.getSenders();

            // Restore Video
            const videoSender = senders.find(s => s.track.kind === 'video');
            if (videoSender && videoTrack) {
                videoSender.replaceTrack(videoTrack);
            }

            // Restore Audio if mixed
            if (this.mixedAudioTrack) {
                const audioSender = senders.find(s => s.track.kind === 'audio');
                if (audioSender && micTrack) {
                    audioSender.replaceTrack(micTrack);
                }
            }
        });

        // Cleanup mixed audio
        if (this.mixedAudioTrack) {
            this.mixedAudioTrack.stop();
            this.mixedAudioTrack = null;
        }
        if (this.micGainNode) {
            this.micGainNode = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    closeConnection(peerUid) {
        if (this.peerConnections[peerUid]) {
            this.peerConnections[peerUid].close();
            delete this.peerConnections[peerUid];
        }
        if (this.remoteStreams[peerUid]) {
            delete this.remoteStreams[peerUid];
        }
    }

    cleanup() {
        Object.keys(this.peerConnections).forEach(uid => this.closeConnection(uid));
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
        }
        if (this.unsubSignals) this.unsubSignals();

        const userRef = ref(rtdb, `rooms/${this.meetingId}/participants/${this.userId}`);
        remove(userRef);
    }
}
