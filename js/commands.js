/* ==========================================
   Imports
========================================== */

import {send} from "./websocket.js";

/* ==========================================
   Joystick
========================================== */

export function sendJoystick(x, y){

    send({
        type: "joystick",
        x,
        y
    });

}

/* ==========================================
   Altitude
========================================== */

export function sendAltitudeUp(){

    send({
        type: "altitude_up"
    });

}

export function sendAltitudeDown(){

    send({
        type: "altitude_down"
    });

}

/* ==========================================
   Yaw
========================================== */

export function sendYawLeft(){

    send({
        type: "yaw_left"
    });

}

export function sendYawRight(){

    send({
        type: "yaw_right"
    });

}

/* ==========================================
   Land
========================================== */

export function sendLand(){

    send({
        type: "land"
    });

}

/* ==========================================
   Emergency Stop
========================================== */

export function sendEmergencyStop(){

    send({
        type: "emergency_stop"
    });

}

/* ==========================================
   Arm / Disarm
========================================== */

export function sendArm(){

    send({
        type: "flight",
        action: "arm"
    });

}

export function sendDisarm(){

    send({
        type: "flight",
        action: "disarm"
    });

}