/* ==========================================
   Camera Manager
========================================== */

let cameraEnabled = false;
let cameraMode = "live";
// live | placeholder

const DEFAULT_CAMERA_IP = "10.76.74.101";
const DEFAULT_CAMERA_PORT = 81;
const DEFAULT_CAMERA_STREAM = "/stream";

/* ==========================================
   Elements
========================================== */

const cameraImage = document.querySelector("#camera-stream");
const placeholderVideo = document.querySelector("#placeholder-video");
const cameraStatus = document.querySelector("#camera-status");
const cameraPlaceholder = document.querySelector("#camera-placeholder");

const cameraIpInput = document.querySelector("#camera-ip");
const cameraStreamInput = document.querySelector("#camera-stream-path");
const cameraDefaultCheckbox = document.querySelector("#camera-default");

/* ==========================================
   Camera Settings
========================================== */

function getCameraSettings() {
    let cameraIp = DEFAULT_CAMERA_IP;
    let cameraPort = DEFAULT_CAMERA_PORT;
    let cameraStream = DEFAULT_CAMERA_STREAM;

    if (cameraDefaultCheckbox && !cameraDefaultCheckbox.checked) {
        cameraIp = cameraIpInput?.value.trim() || DEFAULT_CAMERA_IP;
        cameraStream = cameraStreamInput?.value.trim() || DEFAULT_CAMERA_STREAM;
    } else {
        cameraIp = cameraIpInput?.value.trim() || DEFAULT_CAMERA_IP;
        cameraStream = cameraStreamInput?.value.trim() || DEFAULT_CAMERA_STREAM;
    }

    if (!cameraStream.startsWith("/")) {
        cameraStream = `/${cameraStream}`;
    }

    return {
        cameraIp,
        cameraPort,
        cameraStream
    };
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

    placeholderVideo.pause();
    placeholderVideo.removeAttribute("src");
    placeholderVideo.load();
    placeholderVideo.style.display = "none";

    cameraImage.onload = null;
    cameraImage.onerror = null;
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

    cameraImage.onload = null;
    cameraImage.onerror = null;
    cameraImage.src = "";
    cameraImage.style.display = "none";

    placeholderVideo.style.display = "block";
    placeholderVideo.src = "videos/test.mp4";

    placeholderVideo.play().catch(error => {
        console.error("Unable to play placeholder video:", error);
    });

    placeholderVideo.onloadeddata = () => {
        console.log("Placeholder video loaded.");
    };

    placeholderVideo.onerror = () => {
        console.error("Unable to load placeholder video.");
    };

    cameraStatus.textContent = "📷 Test Video";
}

/* ==========================================
   ESP32-CAM
========================================== */

function playLiveCamera() {
    const {
        cameraIp,
        cameraPort,
        cameraStream
    } = getCameraSettings();

    const cameraUrl =
        cameraIp.startsWith("http://") ||
        cameraIp.startsWith("https://")
            ? `${cameraIp}:${cameraPort}${cameraStream}`
            : `http://${cameraIp}:${cameraPort}${cameraStream}`;

    cameraPlaceholder.style.display = "none";

    placeholderVideo.pause();
    placeholderVideo.removeAttribute("src");
    placeholderVideo.load();
    placeholderVideo.style.display = "none";

    cameraImage.onload = () => {
        console.log(
            "ESP32-CAM stream connected:",
            cameraUrl
        );

        cameraStatus.textContent = "📷 Live";
    };

    cameraImage.onerror = () => {
        console.error(
            "ESP32-CAM stream unavailable:",
            cameraUrl
        );

        cameraImage.onload = null;
        cameraImage.onerror = null;
        cameraImage.src = "";
        cameraImage.style.display = "none";

        cameraStatus.textContent = "📷 Camera Error";
        cameraPlaceholder.style.display = "flex";
    };

    cameraImage.style.display = "block";
    cameraImage.src = cameraUrl;

    console.log(
        "Connecting to ESP32-CAM:",
        cameraUrl
    );
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