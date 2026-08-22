import {sendJoystick} from "./commands.js";

/* ==========================================
   Left Joystick Controller
   Part 1
========================================== */

/* ==========================================
   Elements
========================================== */

const joystick = document.querySelector("#left-joystick");
const joystickBase = document.querySelector(".joystick-base");
const stick = document.querySelector(".stick");

const telemetryX = document.querySelector("#telemetry-x");
const telemetryY = document.querySelector("#telemetry-y");

/* ==========================================
   Configuration
========================================== */

const MAX_DISTANCE = 45;
const DEAD_ZONE = 5;
const SPRING_SPEED = 0.18;

/* ==========================================
   Variables
========================================== */

let dragging = false;

let centerX = 0;
let centerY = 0;

let currentX = 0;
let currentY = 0;

let joystickX = 0;
let joystickY = 0;

/* ==========================================
   Initialize
========================================== */

function initializeJoystick(){

    updateCenter();

}

window.addEventListener("load", initializeJoystick);
window.addEventListener("resize", updateCenter);
window.addEventListener("orientationchange", updateCenter);

/* ==========================================
   Update Center
========================================== */

function updateCenter(){

    const rect = joystickBase.getBoundingClientRect();

    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;

}

/* ==========================================
   Update Stick Position
========================================== */

function updateStick(){

    stick.style.transform =
        `translate(${currentX}px, ${currentY}px)`;

}

/* ==========================================
   Update Telemetry
========================================== */

function updateTelemetry(){

    telemetryX.textContent = joystickX;
    telemetryY.textContent = joystickY;

}

/* ==========================================
   Calculate Output
========================================== */

function calculateOutput(){

    joystickX =
        Math.round((currentX / MAX_DISTANCE) * 100);

    joystickY =
        Math.round((-currentY / MAX_DISTANCE) * 100);

    if(Math.abs(joystickX) < DEAD_ZONE){

        joystickX = 0;

    }

    if(Math.abs(joystickY) < DEAD_ZONE){

        joystickY = 0;

    }

}

/* ==========================================
   Pointer Events
========================================== */

joystick.addEventListener("pointerdown", startDrag);

window.addEventListener("pointermove", dragJoystick);

window.addEventListener("pointerup", stopDrag);

window.addEventListener("pointercancel", stopDrag);

/* ==========================================
   Start Drag
========================================== */

function startDrag(event){

    event.preventDefault();

    updateCenter();

    dragging = true;

    stick.style.transition = "none";

}


/* ==========================================
   Drag Joystick
========================================== */

function dragJoystick(event){

    if(!dragging) return;

    event.preventDefault();

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if(distance > MAX_DISTANCE){

        const angle = Math.atan2(dy, dx);

        dx = Math.cos(angle) * MAX_DISTANCE;
        dy = Math.sin(angle) * MAX_DISTANCE;

    }

    currentX = dx;
    currentY = dy;

    updateStick();

    calculateOutput();

    updateTelemetry();

    sendJoystick(joystickX, joystickY);
}

/* ==========================================
   Stop Drag
========================================== */

function stopDrag(){

    if(!dragging) return;

    dragging = false;

    currentX = 0;
    currentY = 0;

    joystickX = 0;
    joystickY = 0;

    stick.style.transition =
        `transform ${SPRING_SPEED}s ease-out`;

    updateStick();

    updateTelemetry();

    sendJoystick(0, 0);

    setTimeout(()=>{

        stick.style.transition = "";

    }, SPRING_SPEED * 1000);

}