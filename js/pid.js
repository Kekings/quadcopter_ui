import {send,isConnected} from "./websocket.js";
import {sendDisarm} from "./commands.js";

/* ==========================================
   PID Tuning Manager
========================================== */
const pidScreen=document.querySelector("#pid-screen");
const pidLockStatus=document.querySelector("#pid-lock-status");
const pidApplyButton=document.querySelector("#pid-apply-button");
const pidResetButton=document.querySelector("#pid-reset-button");
const pidDisarmButton=document.querySelector("#pid-disarm-button");
const pidStatus=document.querySelector("#pid-status");

/* ==========================================
   PID Input Elements
========================================== */
const pidInputs={
    roll:{
        p:document.querySelector("#roll-p"),
        i:document.querySelector("#roll-i"),
        d:document.querySelector("#roll-d")
    },
    pitch:{
        p:document.querySelector("#pitch-p"),
        i:document.querySelector("#pitch-i"),
        d:document.querySelector("#pitch-d")
    },
    yaw:{
        p:document.querySelector("#yaw-p"),
        i:document.querySelector("#yaw-i"),
        d:document.querySelector("#yaw-d")
    }
};

/* ==========================================
   State
========================================== */
let pidDirty=false;
let droneArmed=false;
let lastPidValues=null;
let pendingPIDChanges={};

/* ==========================================
   Status
========================================== */
function setStatus(message,type="normal"){
    if(!pidStatus)return;
    pidStatus.textContent=message;
    pidStatus.dataset.status=type;
}

/* ==========================================
   Lock / Unlock Input Fields
========================================== */
function setInputsDisabled(disabled){
    for(const axis of ["roll","pitch","yaw"]){
        for(const gain of ["p","i","d"]){
            const input=pidInputs[axis]?.[gain];
            if(input)input.disabled=disabled;
        }
    }
}

/* ==========================================
   ARM / LOCK STATE
========================================== */
function updateLockState(){
    if(!pidLockStatus)return;

    if(droneArmed){
        pidLockStatus.textContent="🔒 PID tuning locked • Drone ARMED";
        pidLockStatus.dataset.locked="true";
        setInputsDisabled(true);
        if(pidApplyButton)pidApplyButton.disabled=true;
        if(pidDisarmButton)pidDisarmButton.disabled=false;
        setStatus("🔴 Disarm the drone before changing PID gains.","error");
        return;
    }

    pidLockStatus.textContent="🔓 PID tuning unlocked • Drone DISARMED";
    pidLockStatus.dataset.locked="false";
    setInputsDisabled(false);
    if(pidApplyButton)pidApplyButton.disabled=!isConnected()||!pidDirty;
    if(pidDisarmButton)pidDisarmButton.disabled=true;
    if(!pidDirty)setStatus("🟡 Ready for PID tuning");
}

/* ==========================================
   ARM STATE
========================================== */
function setArmedState(armed){
    droneArmed=Boolean(armed);
    updateLockState();
}

/* ==========================================
   Read One PID Gain
========================================== */
function readGain(axis,gain){
    const input=pidInputs[axis]?.[gain];
    if(!input)return null;
    const value=Number(input.value);
    if(!Number.isFinite(value)){
        throw new Error(`Invalid ${axis} ${gain} gain`);
    }
    return value;
}

/* ==========================================
   Read All PID Values
========================================== */
function readPIDValues(){
    const result={};
    for(const axis of ["roll","pitch","yaw"]){
        result[axis]={};
        for(const gain of ["p","i","d"]){
            const value=readGain(axis,gain);
            if(value!==null)result[axis][gain]=value;
        }
    }
    return result;
}

/* ==========================================
   Find ONLY Changed PID Values
========================================== */
function getChangedPIDValues(){
    if(!lastPidValues)return readPIDValues();
    const changes={};
    for(const axis of ["roll","pitch","yaw"]){
        for(const gain of ["p","i","d"]){
            const input=pidInputs[axis]?.[gain];
            if(!input)continue;
            const current=Number(input.value);
            if(!Number.isFinite(current)){
                throw new Error(`Invalid ${axis} ${gain} gain`);
            }
            const previous=Number(lastPidValues?.[axis]?.[gain]);
            if(!Number.isFinite(previous)||current!==previous){
                if(!changes[axis])changes[axis]={};
                changes[axis][gain]=current;
            }
        }
    }
    return changes;
}

/* ==========================================
   Count Changed Gains
========================================== */
function countChangedGains(changes){
    let count=0;
    for(const axis of Object.keys(changes||{})){
        count+=Object.keys(changes[axis]||{}).length;
    }
    return count;
}

/* ==========================================
   Display PID Values
========================================== */
function displayPIDValues(data){
    if(!data)return;
    for(const axis of ["roll","pitch","yaw"]){
        if(!data[axis])continue;
        for(const gain of ["p","i","d"]){
            const input=pidInputs[axis]?.[gain];
            if(!input)continue;
            const value=data[axis][gain];
            if(value===undefined||value===null)continue;
            input.value=Number(value);
        }
    }
    lastPidValues=structuredClone(data);
    pendingPIDChanges={};
    pidDirty=false;
    updateLockState();
    setStatus("🟢 Current PID gains loaded","success");
}

/* ==========================================
   Request PID Gains
========================================== */
function requestPIDValues(){
    if(!isConnected()){
        setStatus("🔴 Flight controller is not connected.","error");
        return;
    }
    setStatus("🟡 Requesting PID gains from flight controller...","loading");
    send({
        type:"pid",
        action:"get"
    });
}

/* ==========================================
   Apply ONLY Changed PID Gains
========================================== */
function applyPIDValues(){
    if(droneArmed){
        setStatus("🔒 PID tuning is locked while the drone is armed.","error");
        return;
    }
    if(!isConnected()){
        setStatus("🔴 Flight controller is not connected.","error");
        return;
    }
    let changes;
    try{
        changes=getChangedPIDValues();
    }catch(error){
        console.error("PID validation error:",error);
        setStatus(`🔴 ${error.message}`,"error");
        return;
    }
    const changedCount=countChangedGains(changes);
    if(changedCount===0){
        pidDirty=false;
        updateLockState();
        setStatus("🟡 No PID values were changed.");
        return;
    }
    pendingPIDChanges=structuredClone(changes);
    if(pidApplyButton)pidApplyButton.disabled=true;
    setStatus(`🟡 Sending ${changedCount} changed PID gain${changedCount>1?"s":""}...`,"loading");
    send({
        type:"pid",
        action:"set",
        gains:changes
    });
    console.log("📤 Changed PID gains sent:",changes);
}

/* ==========================================
   Reset / Discard Changes
========================================== */
function resetPIDValues(){
    if(!lastPidValues){
        requestPIDValues();
        return;
    }
    displayPIDValues(lastPidValues);
    setStatus("🟢 PID changes discarded","success");
}

/* ==========================================
   Disarm From PID Screen
========================================== */
function handlePidScreenDisarm(){
    if(!droneArmed){
        setStatus("🟡 Drone is already disarmed.");
        return;
    }
    sendDisarm();
    setStatus("🟡 Sending disarm command...","loading");
}

/* ==========================================
   Input Change Detection
========================================== */
function attachInputListeners(){
    for(const axis of ["roll","pitch","yaw"]){
        for(const gain of ["p","i","d"]){
            const input=pidInputs[axis]?.[gain];
            if(!input)continue;
            input.addEventListener("input",()=>{
                if(droneArmed){
                    setStatus("🔒 PID tuning is locked while the drone is armed.","error");
                    return;
                }
                let changed=false;
                try{
                    const current=Number(input.value);
                    const previous=Number(lastPidValues?.[axis]?.[gain]);
                    changed=Number.isFinite(current)&&current!==previous;
                }catch(error){
                    changed=false;
                }
                if(changed){
                    pidDirty=true;
                    if(!pendingPIDChanges[axis])pendingPIDChanges[axis]={};
                    pendingPIDChanges[axis][gain]=Number(input.value);
                }else if(pendingPIDChanges[axis]?.[gain]!==undefined){
                    delete pendingPIDChanges[axis][gain];
                    if(Object.keys(pendingPIDChanges[axis]).length===0)delete pendingPIDChanges[axis];
                }
                if(!countChangedGains(pendingPIDChanges)){
                    pidDirty=false;
                    updateLockState();
                    return;
                }
                if(pidApplyButton)pidApplyButton.disabled=false;
                setStatus("🟡 PID values modified. Press APPLY to send them.","modified");
            });
        }
    }
}

/* ==========================================
   Handle PID Messages
========================================== */
function handlePIDMessage(data){
    console.log("PID message:",data);
    if(!data)return;

    if(data.type==="pid"&&data.action==="values"){
        displayPIDValues(data.gains);
        return;
    }

    if(data.type==="pid"&&data.action==="set"&&data.success===true){
        let applied=structuredClone(pendingPIDChanges);
        let changedCount=countChangedGains(applied);

        if(!lastPidValues)lastPidValues=readPIDValues();

        for(const axis of Object.keys(applied)){
            if(!lastPidValues[axis])lastPidValues[axis]={};
            for(const gain of Object.keys(applied[axis])){
                lastPidValues[axis][gain]=applied[axis][gain];
            }
        }

        pendingPIDChanges={};
        pidDirty=false;

        if(pidApplyButton)pidApplyButton.disabled=false;

        setStatus(`🟢 ${changedCount} PID gain${changedCount>1?"s":""} successfully applied.`,"success");
        console.log("✅ PID gains applied:",applied);
        return;
    }

    if(data.type==="pid"&&data.action==="set"&&data.success===false){
        if(pidApplyButton)pidApplyButton.disabled=false;
        setStatus(`🔴 PID update failed: ${data.message||"Unknown error"}`,"error");
        return;
    }

    if(data.type==="ack"&&data.command==="arm"&&data.success===true){
        setArmedState(true);
        return;
    }

    if(data.type==="ack"&&data.command==="disarm"&&data.success===true){
        setArmedState(false);
        setStatus("🟢 Drone disarmed. PID tuning unlocked.","success");
        return;
    }

    if(data.type==="ack"&&data.command==="emergency_stop"&&data.success===true){
        setArmedState(false);
        setStatus("🟢 Emergency stop triggered. PID tuning unlocked.","success");
        return;
    }

    if(data.type==="armed"){
        setArmedState(data.armed);
        return;
    }

    if(data.type==="status"&&data.armed!==undefined){
        setArmedState(data.armed);
    }
}

/* ==========================================
   WebSocket Events
========================================== */
window.addEventListener("status-update",event=>{
    handlePIDMessage(event.detail);
});

window.addEventListener("ack",event=>{
    handlePIDMessage(event.detail);
});

window.addEventListener("pid-update",event=>{
    handlePIDMessage(event.detail);
});

window.addEventListener("drone-connected",()=>{
    updateLockState();
    requestPIDValues();
});

window.addEventListener("drone-disconnected",()=>{
    if(pidApplyButton)pidApplyButton.disabled=true;
    setStatus("🔴 Flight controller disconnected.","error");
});

/* ==========================================
   PID Screen Open
========================================== */
window.addEventListener("pid-screen-opened",()=>{
    requestPIDValues();
    updateLockState();
});

/* ==========================================
   Button Events
========================================== */
if(pidApplyButton)pidApplyButton.addEventListener("click",applyPIDValues);
if(pidResetButton)pidResetButton.addEventListener("click",resetPIDValues);
if(pidDisarmButton)pidDisarmButton.addEventListener("click",handlePidScreenDisarm);

/* ==========================================
   Initialize
========================================== */
attachInputListeners();
updateLockState();

if(isConnected()){
    requestPIDValues();
}

console.log("🔥 PID TUNING MODULE LOADED");