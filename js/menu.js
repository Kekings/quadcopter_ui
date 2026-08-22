
import {isConnected} from "./websocket.js";
import {toggleCamera} from "./camera.js";
import {openGPS} from "./gps.js";

/* ==========================================
   Elements
========================================== */

const menuButton = document.querySelector("#menu-button");

const sideMenu = document.querySelector("#side-menu");

const menuOverlay = document.querySelector("#menu-overlay");

const fullscreenButton = document.querySelector("#menu-fullscreen");
const connectionButton = document.querySelector("#menu-connection");
const cameraButton = document.querySelector("#menu-camera");

const connectionScreen = document.querySelector("#connection-screen");
const flightScreen = document.querySelector("#flight-screen");

const statusText = document.querySelector("#connection-status-text");
const gpsButton = document.querySelector("#menu-gps");
const calibrationScreen = document.querySelector("#calibration-screen");

const calibrationMenuButton = document.querySelector("#menu-calibration");

const pidMenuButton = document.querySelector("#menu-pid");
const pidScreen = document.querySelector("#pid-screen");

console.log("PID MENU BUTTON:", pidMenuButton);
console.log("PID SCREEN:", pidScreen);


const pidBackButton = document.querySelector("#pid-back-button");

const calibrationBackButton = document.querySelector("#calibration-back-button");


function returnToFlight(){

    calibrationScreen.classList.remove("active");

    if(pidScreen){
        pidScreen.classList.remove("active");
    }

    flightScreen.classList.add("active");

}

/* ==========================================
   Open Menu
========================================== */

function openMenu(){

    sideMenu.classList.add("open");

    menuOverlay.classList.add("open");

}

/* ==========================================
   Close Menu
========================================== */

function closeMenu(){

    sideMenu.classList.remove("open");

    menuOverlay.classList.remove("open");

}

/* ==========================================
   Toggle Menu
========================================== */

function toggleMenu(){

    if(sideMenu.classList.contains("open")){

        closeMenu();

    }

    else{

        openMenu();

    }

}

/* ==========================================
   Update Fullscreen Button
========================================== */

function updateFullscreenButton(){

    if(document.fullscreenElement){

        fullscreenButton.textContent = "🗗 Exit Fullscreen";

    }

    else{

        fullscreenButton.textContent = "🖥 Fullscreen";

    }

}

/* ==========================================
   Toggle Fullscreen
========================================== */

async function toggleFullscreen(){

    try{

        if(document.fullscreenElement){

            await document.exitFullscreen();

        }

        else{

            await document.documentElement.requestFullscreen();

        }

    }

    catch(error){

        console.error("Fullscreen Error :", error);

    }

    updateFullscreenButton();

    closeMenu();

}


/* ==========================================
   Open Connection Screen
========================================== */

function openConnectionScreen(){

    closeMenu();

    connectionScreen.classList.add("active");

    flightScreen.classList.remove("active");


    if(statusText){

        if(isConnected()){

            statusText.textContent = "🟢 Connected";

        }

        else{

            statusText.textContent = "🔴 Disconnected";

        }

    }

}


/* ==========================================
   Open Calibration Screen
========================================== */
function openCalibration(){

    closeMenu();

    calibrationScreen.classList.add("active");

    flightScreen.classList.remove("active");

}


/* ==========================================
   Open PID Tuning Screen
========================================== */

function openPIDTuning(){

    console.log("PID BUTTON CLICKED");
    console.log("PID SCREEN:", pidScreen);
    
    closeMenu();

    pidScreen.classList.add("active");

    flightScreen.classList.remove("active");
}

/* ==========================================
   Events
========================================== */

menuButton.addEventListener("click", toggleMenu);

menuOverlay.addEventListener("click", closeMenu);

fullscreenButton.addEventListener("click", toggleFullscreen);

connectionButton.addEventListener("click", openConnectionScreen);
cameraButton.addEventListener("click", ()=>{
    toggleCamera();
    closeMenu();
});

gpsButton.addEventListener("click", openGPS);

calibrationMenuButton.addEventListener(
    "click",
    openCalibration
);

calibrationBackButton.addEventListener(
    "click",
    returnToFlight
);


pidMenuButton.addEventListener(
    "click",
    openPIDTuning
);

pidBackButton.addEventListener(
    "click",
    returnToFlight
);

/* ==========================================
   Fullscreen Events
========================================== */

document.addEventListener("fullscreenchange", updateFullscreenButton);

/* ==========================================
   Close With ESC
========================================== */

window.addEventListener("keydown", function(event){

    if(event.key === "Escape"){

        closeMenu();

    }

});

/* ==========================================
   Initialize
========================================== */

updateFullscreenButton();