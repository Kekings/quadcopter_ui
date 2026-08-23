/* ==========================================
   Imports
========================================== */

import{
    sendAltitudeUp,
    sendAltitudeDown,
    sendYawLeft,
    sendYawRight,
    sendLand,
    sendEmergencyStop,
    sendArm,
    sendDisarm
} from "./commands.js";

/* ==========================================
   Elements
========================================== */

const upButton = document.querySelector("#btn-up");
const downButton = document.querySelector("#btn-down");

const leftButton = document.querySelector("#btn-left");
const rightButton = document.querySelector("#btn-right");

const landButton = document.querySelector("#btn-land");
const stopButton = document.querySelector("#btn-stop");

const armButton = document.querySelector("#btn-arm");
const armStatusText = document.querySelector("#arm-status-text");

/* ==========================================
   Helpers
========================================== */

/* ==========================================
   Hold Button
========================================== */

function bindHold(button, command){

    let timer = null;

    button.addEventListener("pointerdown", ()=>{

        command();

        timer = setInterval(command, 100);

    });

    function stop(){

        if(timer){

            clearInterval(timer);
            timer = null;

        }

    }

    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);

}

/* ==========================================
   Altitude
========================================== */

bindHold(upButton, sendAltitudeUp);
bindHold(downButton, sendAltitudeDown);

/* ==========================================
   Yaw
========================================== */

bindHold(leftButton, sendYawLeft);
bindHold(rightButton, sendYawRight);

/* ==========================================
   Landing
========================================== */

landButton.addEventListener("click", sendLand);

/* ==========================================
   Emergency Stop
========================================== */

stopButton.addEventListener("click", sendEmergencyStop);


/* ==========================================
   Arm / Disarm (Long Press)
========================================== */

const ARM_HOLD_MS = 1000;
const DISARM_HOLD_MS = 2000;

let isArmed = false;
let pressTimer = null;
let awaitingCommand = null; // "arm" | "disarm" | null

function setArmedVisual(armed){

    isArmed = armed;

    armButton.classList.remove("armed", "disarmed", "holding", "pending");

    armButton.classList.add(armed ? "armed" : "disarmed");

    armStatusText.textContent = armed ? "ARMED" : "DISARMED";

}

function setPendingVisual(command){

    awaitingCommand = command;

    armButton.classList.add("pending");

    armStatusText.textContent =
        command === "arm" ? "ARMING..." : "DISARMING...";

}

function startPress(){

    if(awaitingCommand)
        return; // ignore new presses while waiting on a previous command

    armButton.classList.add("holding");

    const holdDuration = isArmed ? DISARM_HOLD_MS : ARM_HOLD_MS;

    armButton.style.setProperty("--hold-duration", `${holdDuration}ms`);

    pressTimer = setTimeout(()=>{

        if(isArmed){

            sendDisarm();
            setPendingVisual("disarm");

        } else {

            sendArm();
            setPendingVisual("arm");

        }

    }, holdDuration);

}

function cancelPress(){

    if(pressTimer){

        clearTimeout(pressTimer);
        pressTimer = null;

    }

    armButton.classList.remove("holding");

}

armButton.addEventListener("pointerdown", startPress);
armButton.addEventListener("pointerup", cancelPress);
armButton.addEventListener("pointerleave", cancelPress);
armButton.addEventListener("pointercancel", cancelPress);

// Listen for drone confirmation before flipping visual state
window.addEventListener("ack", (event)=>{

    const {command, success} = event.detail;

    if(command !== "arm" && command !== "disarm")
        return;

    if(!success){

        // Command failed — revert to whatever we actually are, no state change
        armButton.classList.remove("pending");
        armStatusText.textContent = isArmed ? "ARMED" : "DISARMED";
        awaitingCommand = null;

        return;
    }

    setArmedVisual(command === "arm");
    awaitingCommand = null;

});

// Initialize visual state
setArmedVisual(false);