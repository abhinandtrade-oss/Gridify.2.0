/**
 * Camera Logic (Simplified - No Face Detection)
 */

const CameraManager = {
    videoElement: null,
    canvasElement: null,
    canvasCtx: null,
    stream: null,
    isCameraActive: false,

    async init(videoSelector, canvasSelector) {
        console.log("CameraManager.init (Simplified) started...");
        this.videoElement = document.querySelector(videoSelector);
        this.canvasElement = document.querySelector(canvasSelector);

        if (!this.videoElement || !this.canvasElement) {
            console.error("Camera or Canvas elements not found");
            return false;
        }

        this.canvasCtx = this.canvasElement.getContext('2d');

        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });

            this.videoElement.srcObject = this.stream;
            this.isCameraActive = true;

            // Trigger metadata check to ensure videoWidth is available early
            await new Promise((resolve) => {
                if (this.videoElement.readyState >= 2) resolve();
                else this.videoElement.onloadedmetadata = () => resolve();
            });

            console.log("Camera stream started successfully.");
            return true;
        } catch (err) {
            console.error("Camera Access Error:", err);
            return false;
        }
    },

    capture() {
        if (!this.isCameraActive) {
            console.error("Capture failed: Camera not active");
            return null;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.videoElement.videoWidth || 640;
        tempCanvas.height = this.videoElement.videoHeight || 480;
        const ctx = tempCanvas.getContext('2d');

        // Mirror the image for capture as well to match user view
        ctx.translate(tempCanvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

        return tempCanvas.toDataURL('image/jpeg', 0.8);
    },

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.isCameraActive = false;
            console.log("Camera stopped.");
        }
    }
};

window.CameraManager = CameraManager;
