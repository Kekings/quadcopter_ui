/* ==========================================
   Camera Manager
========================================== */

let cameraEnabled = false;
let cameraMode = "live";
// live | placeholder

let camSocket = null;
let currentFrameUrl = null;

const DEFAULT_CAMERA_IP = "10.76.74.101";
const DEFAULT_CAMERA_PORT = 83; // was 81/MJPEG, now the WS port

/* ==========================================
   Elements
========================================== */

const cameraImage = document.querySelector("#camera-stream");
const placeholderVideo = document.querySelector("#placeholder-video");
const cameraStatus = document.querySelector("#camera-status");
const cameraPlaceholder = document.querySelector("#camera-placeholder");

const cameraIpInput = document.querySelector("#camera-ip");
const cameraDefaultCheckbox = document.querySelector("#camera-default");

/* ==========================================
   Camera Settings
========================================== */

function getCameraSettings() {
    const cameraIp = cameraIpInput?.value.trim() || DEFAULT_CAMERA_IP;
    return { cameraIp, cameraPort: DEFAULT_CAMERA_PORT };
}

/* ==========================================
   Camera ON
========================================== */

export function startCamera() {
    cameraEnabled = true;

    if (cameraMode === "live") {
        playLiveCamera();
    } else {
        playPlaceholder();
    }
}

/* ==========================================
   Camera OFF
========================================== */

export function stopCamera() {
    cameraEnabled = false;

    if (camSocket) {
        camSocket.onclose = null; // prevent auto-reconnect firing after intentional close
        camSocket.close();
        camSocket = null;
    }

    if (currentFrameUrl) {
        URL.revokeObjectURL(currentFrameUrl);
        currentFrameUrl = null;
    }

    placeholderVideo.pause();
    placeholderVideo.removeAttribute("src");
    placeholderVideo.load();
    placeholderVideo.style.display = "none";

    cameraImage.src = "";
    cameraImage.style.display = "none";

    cameraPlaceholder.style.display = "flex";

    cameraStatus.textContent = "📷 Off";
}

/* ==========================================
   Placeholder
========================================== */

function playPlaceholder() {
    cameraPlaceholder.style.display = "none";

    cameraImage.src = "";
    cameraImage.style.display = "none";

    placeholderVideo.style.display = "block";
    placeholderVideo.src = "videos/test.mp4";

    placeholderVideo.play().catch(error => {
        console.error("Unable to play placeholder video:", error);
    });

    placeholderVideo.onerror = () => {
        console.error("Unable to load placeholder video.");
    };

    cameraStatus.textContent = "📷 Test Video";
}

/* ==========================================
   ESP32-CAM (WebSocket)
========================================== */

function playLiveCamera() {
    const { cameraIp, cameraPort } = getCameraSettings();

    cameraPlaceholder.style.display = "none";

    placeholderVideo.pause();
    placeholderVideo.removeAttribute("src");
    placeholderVideo.load();
    placeholderVideo.style.display = "none";

    if (camSocket) {
        camSocket.onclose = null;
        camSocket.close();
    }

    cameraStatus.textContent = "📷 Connecting...";

    camSocket = new WebSocket(`ws://${cameraIp}:${cameraPort}/`);
    camSocket.binaryType = "arraybuffer";

    camSocket.onopen = () => {
        console.log("ESP32-CAM WS connected:", cameraIp, cameraPort);
        cameraStatus.textContent = "📷 Live";
        cameraImage.style.display = "block";
    };

    camSocket.onmessage = (event) => {
        const blob = new Blob([event.data], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);

        cameraImage.src = url;

        if (currentFrameUrl) {
            URL.revokeObjectURL(currentFrameUrl);
        }
        currentFrameUrl = url;
    };

    camSocket.onerror = (e) => {
        console.error("ESP32-CAM WS error:", e);
        cameraStatus.textContent = "📷 Camera Error";
    };

    camSocket.onclose = () => {
        console.warn("ESP32-CAM WS closed");

        if (cameraEnabled && cameraMode === "live") {
            cameraStatus.textContent = "📷 Reconnecting...";
            setTimeout(playLiveCamera, 2000);
        }
    };
}

/* ==========================================
   Toggle
========================================== */

export function toggleCamera() {
    if (cameraEnabled) {
        stopCamera();
    } else {
        startCamera();
    }
}

/* ==========================================
   Camera Mode
========================================== */

export function setCameraMode(mode) {
    if (mode !== "live" && mode !== "placeholder") {
        console.warn("Invalid camera mode:", mode);
        return;
    }

    cameraMode = mode;

    if (!cameraEnabled) {
        return;
    }

    if (cameraMode === "live") {
        playLiveCamera();
    } else {
        playPlaceholder();
    }
}

/* ==========================================
   Refresh Live Camera
========================================== */

export function refreshCamera() {
    if (!cameraEnabled) {
        return;
    }

    if (cameraMode === "live") {
        playLiveCamera();
    } else {
        playPlaceholder();
    }
}