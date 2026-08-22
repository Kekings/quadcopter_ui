/* ==========================================
   Imports
========================================== */

import{
    sendAltitudeUp,
    sendAltitudeDown,
    sendYawLeft,
    sendYawRight,
    sendLand,
    sendEmergencyStop
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