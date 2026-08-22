import {send,isConnected} from "./websocket.js";

/* ==========================================
   PID Tuning Manager
========================================== */
const pidScreen=document.querySelector("#pid-screen");
const pidLockStatus=document.querySelector("#pid-lock-status");
const pidApplyButton=document.querySelector("#pid-apply-button");
const pidResetButton=document.querySelector("#pid-reset-button");
const pidStatus=document.querySelector("#pid-status");

/* ==========================================
   PID Input Elements
========================================== */
const pidInputs={
    roll:{
        outer:{
            p:document.querySelector("#roll-outer-p"),
            i:document.querySelector("#roll-outer-i"),
            d:document.querySelector("#roll-outer-d")
        },
        inner:{
            p:document.querySelector("#roll-inner-p"),
            i:document.querySelector("#roll-inner-i"),
            d:document.querySelector("#roll-inner-d")
        }
    },
    pitch:{
        outer:{
            p:document.querySelector("#pitch-outer-p"),
            i:document.querySelector("#pitch-outer-i"),
            d:document.querySelector("#pitch-outer-d")
        },
        inner:{
            p:document.querySelector("#pitch-inner-p"),
            i:document.querySelector("#pitch-inner-i"),
            d:document.querySelector("#pitch-inner-d")
        }
    },
    yaw:{
        outer:{
            p:document.querySelector("#yaw-outer-p"),
            i:document.querySelector("#yaw-outer-i"),
            d:document.querySelector("#yaw-outer-d")
        },
        inner:{
            p:document.querySelector("#yaw-inner-p"),
            i:document.querySelector("#yaw-inner-i"),
            d:document.querySelector("#yaw-inner-d")
        }
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
   ARM / LOCK STATE
========================================== */
function updateLockState(){
    if(!pidLockStatus)return;
    if(droneArmed){
        pidLockStatus.textContent="🔒 PID tuning locked • Drone ARMED";
        pidLockStatus.dataset.locked="true";
        if(pidApplyButton)pidApplyButton.disabled=true;
        setStatus("🔴 Disarm the drone before changing PID gains.","error");
        return;
    }
    pidLockStatus.textContent="🔓 PID tuning unlocked • Drone DISARMED";
    pidLockStatus.dataset.locked="false";
    if(pidApplyButton)pidApplyButton.disabled=!isConnected()||!pidDirty;
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
function readGain(axis,loop,gain){
    const input=pidInputs[axis]?.[loop]?.[gain];
    if(!input)return null;
    const value=Number(input.value);
    if(!Number.isFinite(value)){
        throw new Error(`Invalid ${axis} ${loop} ${gain} gain`);
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
        for(const loop of ["outer","inner"]){
            result[axis][loop]={};
            for(const gain of ["p","i","d"]){
                const value=readGain(axis,loop,gain);
                if(value!==null)result[axis][loop][gain]=value;
            }
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
        for(const loop of ["outer","inner"]){
            for(const gain of ["p","i","d"]){
                const input=pidInputs[axis]?.[loop]?.[gain];
                if(!input)continue;
                const current=Number(input.value);
                if(!Number.isFinite(current)){
                    throw new Error(`Invalid ${axis} ${loop} ${gain} gain`);
                }
                const previous=Number(lastPidValues?.[axis]?.[loop]?.[gain]);
                if(!Number.isFinite(previous)||current!==previous){
                    if(!changes[axis])changes[axis]={};
                    if(!changes[axis][loop])changes[axis][loop]={};
                    changes[axis][loop][gain]=current;
                }
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
        for(const loop of Object.keys(changes[axis]||{})){
            count+=Object.keys(changes[axis][loop]||{}).length;
        }
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
        for(const loop of ["outer","inner"]){
            if(!data[axis][loop])continue;
            for(const gain of ["p","i","d"]){
                const input=pidInputs[axis]?.[loop]?.[gain];
                if(!input)continue;
                const value=data[axis][loop][gain];
                if(value===undefined||value===null)continue;
                input.value=Number(value);
            }
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
   Input Change Detection
========================================== */
function attachInputListeners(){
    for(const axis of ["roll","pitch","yaw"]){
        for(const loop of ["outer","inner"]){
            for(const gain of ["p","i","d"]){
                const input=pidInputs[axis]?.[loop]?.[gain];
                if(!input)continue;
                input.addEventListener("input",()=>{
                    if(droneArmed){
                        setStatus("🔒 PID tuning is locked while the drone is armed.","error");
                        return;
                    }
                    let changed=false;
                    try{
                        const current=Number(input.value);
                        const previous=Number(lastPidValues?.[axis]?.[loop]?.[gain]);
                        changed=Number.isFinite(current)&&current!==previous;
                    }catch(error){
                        changed=false;
                    }
                    if(changed){
                        pidDirty=true;
                        if(!pendingPIDChanges[axis])pendingPIDChanges[axis]={};
                        if(!pendingPIDChanges[axis][loop])pendingPIDChanges[axis][loop]={};
                        pendingPIDChanges[axis][loop][gain]=Number(input.value);
                    }else if(pendingPIDChanges[axis]?.[loop]?.[gain]!==undefined){
                        delete pendingPIDChanges[axis][loop][gain];
                        if(Object.keys(pendingPIDChanges[axis][loop]).length===0)delete pendingPIDChanges[axis][loop];
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
            for(const loop of Object.keys(applied[axis])){
                if(!lastPidValues[axis][loop])lastPidValues[axis][loop]={};
                for(const gain of Object.keys(applied[axis][loop])){
                    lastPidValues[axis][loop][gain]=applied[axis][loop][gain];
                }
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
    if(pidScreen?.classList.contains("active"))requestPIDValues();
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

/* ==========================================
   Initialize
========================================== */
attachInputListeners();
updateLockState();

console.log("🔥 PID TUNING MODULE LOADED");