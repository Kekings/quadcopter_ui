/* ==========================================
   Imports
========================================== */

import {updateDroneMarker} from "./gps.js";


/* ==========================================
   Elements
========================================== */

const batteryStatus = document.querySelector("#battery-status");

const telemetryX = document.querySelector("#telemetry-x");
const telemetryY = document.querySelector("#telemetry-y");

const connectionStatus = document.querySelector("#connection-status");
const flightMode = document.querySelector("#flight-mode");

const wifiStatus = document.querySelector("#wifi-status");
const cameraStatus = document.querySelector("#camera-status");


/* ==========================================
   Telemetry
========================================== */

window.addEventListener("telemetry-update", (event)=>{

    const data = event.detail;

    console.log("Telemetry:", data);

});


/* ==========================================
   Battery
========================================== */

window.addEventListener("battery-update", (event)=>{

    const data = event.detail;

    batteryStatus.textContent =
        `🔋 ${data.percent}%`;

});


/* ==========================================
   WiFi
========================================== */

window.addEventListener("wifi-update", (event)=>{

    const data = event.detail;

    wifiStatus.textContent =
        `📶 ${data.quality}`;

});


/* ==========================================
   Camera
========================================== */

window.addEventListener("camera-update", (event)=>{

    const data = event.detail;

    cameraStatus.textContent =
        `📷 ${data.status}`;

});


/* ==========================================
   Heartbeat
========================================== */

window.addEventListener("heartbeat", ()=>{

    connectionStatus.textContent =
        "🟢 Connected";

});


/* ==========================================
   GPS
========================================== */

window.addEventListener("gps-update", (event)=>{

    const data = event.detail;

    console.log("GPS:", data);

    updateDroneMarker(
        data.lat,
        data.lng
    );

});


/* ==========================================
   Distance
========================================== */

window.addEventListener("distance-update", (event)=>{

    const data = event.detail;

    console.log("Distance:", data);

});


/* ==========================================
   IMU
========================================== */

window.addEventListener("imu-update", (event)=>{

    const data = event.detail;

    telemetryX.textContent =
        data.roll.toFixed(1);

    telemetryY.textContent =
        data.pitch.toFixed(1);

});


/* ==========================================
   Status
========================================== */

window.addEventListener("status-update", (event)=>{

    const data = event.detail;

    connectionStatus.textContent =
        "🟢 Connected";

    flightMode.textContent =
        `🧭 ${data.state}`;

});


/* ==========================================
   Warning
========================================== */

window.addEventListener("warning", (event)=>{

    console.warn(
        event.detail.message
    );

});


/* ==========================================
   ACK
========================================== */

window.addEventListener("ack", (event)=>{

    console.log(
        "ACK:",
        event.detail.command
    );

});


/* ==========================================
   Log
========================================== */

window.addEventListener("log", (event)=>{

    console.log(
        "Drone:",
        event.detail.message
    );

});