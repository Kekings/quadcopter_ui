/* ==========================================
   Camera Manager
========================================== */

let cameraEnabled = false;

let cameraMode = "placeholder";
// placeholder | live

const DEFAULT_CAMERA_IP = "10.76.74.101";
const DEFAULT_CAMERA_STREAM = "/stream";

/* ==========================================
   Elements
========================================== */

const cameraImage = document.querySelector("#camera-stream");
const placeholderVideo = document.querySelector("#placeholder-video");

const cameraStatus = document.querySelector("#camera-status");
const cameraPlaceholder = document.querySelector("#camera-placeholder");

/* ==========================================
   Camera ON
========================================== */

export function startCamera(){

    cameraEnabled = true;

    if(cameraMode === "placeholder"){

        playPlaceholder();

    }

    else{

        playLiveCamera();

    }

}

/* ==========================================
   Camera OFF
========================================== */

export function stopCamera(){

    cameraEnabled = false;

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

function playPlaceholder(){

    cameraPlaceholder.style.display = "none";

    cameraImage.style.display = "none";

    placeholderVideo.style.display = "block";

    placeholderVideo.src = "videos/test.mp4";

    placeholderVideo.play();

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

function playLiveCamera(){

    cameraPlaceholder.style.display = "none";

    placeholderVideo.pause();

    placeholderVideo.style.display = "none";

    cameraImage.style.display = "block";

    cameraImage.src =
        `http://${DEFAULT_CAMERA_IP}${DEFAULT_CAMERA_STREAM}`;

    cameraStatus.textContent = "📷 Live";

}

/* ==========================================
   Toggle
========================================== */

export function toggleCamera(){

    if(cameraEnabled){

        stopCamera();

    }

    else{

        startCamera();

    }

}

/* ==========================================
   Camera Mode
========================================== */

export function setCameraMode(mode){

    cameraMode = mode;

}