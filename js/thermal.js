/* ==========================================
   Thermal Camera Overlay
   MLX90640 frame: 32x24, int16 (°C x 100),
   little-endian, 1536 bytes, no header
========================================== */
const THERMAL_W=32;
const THERMAL_H=24;
const THERMAL_BYTES=THERMAL_W*THERMAL_H*2;
const THERMAL_PORT=82;
const MIN_SPAN_C=2;          // never stretch less than 2°C across the palette
const MIRROR_X=false;        // flip if the image is mirrored for your mounting
const FLIP_Y=false;
const POSITION_KEY="thermal-overlay-position";

const overlay=document.querySelector("#thermal-overlay");
const header=document.querySelector("#thermal-header");
const canvas=document.querySelector("#thermal-canvas");
const closeButton=document.querySelector("#thermal-close");
const menuButton=document.querySelector("#menu-thermal");
const statusEl=document.querySelector("#thermal-status");
const rangeEl=document.querySelector("#thermal-range");
const spotEl=document.querySelector("#thermal-spot");
const cameraIpInput=document.querySelector("#camera-ip");

const resizeHandle=document.querySelector("#thermal-resize");
const MIN_WIDTH=160;

/* ==========================================
   Palette (inferno-style)
========================================== */
const PALETTES={
    rainbow:[
        [0.0,30,30,140],
        [0.25,20,150,230],
        [0.5,60,210,120],
        [0.75,250,220,40],
        [1.0,240,60,30]
    ],
    iron:[
        [0.0,0,0,4],
        [0.2,40,11,84],
        [0.4,101,21,110],
        [0.6,187,55,84],
        [0.8,249,142,9],
        [1.0,252,255,164]
    ]
};

const PALETTE_NAMES=Object.keys(PALETTES);
let paletteIndex=0;

function buildPalette(stops){
    const lut=new Uint8ClampedArray(256*3);

    for(let i=0;i<256;i++){
        const t=i/255;
        let k=0;

        while(k<stops.length-2&&t>stops[k+1][0])k++;

        const [t0,r0,g0,b0]=stops[k];
        const [t1,r1,g1,b1]=stops[k+1];
        const f=(t-t0)/(t1-t0);

        lut[i*3]=r0+(r1-r0)*f;
        lut[i*3+1]=g0+(g1-g0)*f;
        lut[i*3+2]=b0+(b1-b0)*f;
    }

    return lut;
}

let palette=buildPalette(PALETTES[PALETTE_NAMES[paletteIndex]]);

// Tap the image to switch palettes
canvas.addEventListener("click",()=>{
    paletteIndex=(paletteIndex+1)%PALETTE_NAMES.length;
    palette=buildPalette(PALETTES[PALETTE_NAMES[paletteIndex]]);
});

/* ==========================================
   Drawing surfaces
========================================== */
const frameCanvas=document.createElement("canvas");
frameCanvas.width=THERMAL_W;
frameCanvas.height=THERMAL_H;

const frameCtx=frameCanvas.getContext("2d");
const frameImage=frameCtx.createImageData(THERMAL_W,THERMAL_H);
const ctx=canvas.getContext("2d");

ctx.imageSmoothingEnabled=true;
ctx.imageSmoothingQuality="high";

/* ==========================================
   State
========================================== */
let socket=null;
let enabled=false;
let reconnectTimer=null;
let lastFrameTime=0;
let smoothMin=null;
let smoothMax=null;

function setStatus(text,state="off"){
    if(!statusEl)return;
    statusEl.textContent=text;
    statusEl.dataset.state=state;
}

/* ==========================================
   Render one frame
========================================== */
function renderFrame(buffer){
    if(buffer.byteLength!==THERMAL_BYTES)return;

    const view=new DataView(buffer);
    const temps=new Float32Array(THERMAL_W*THERMAL_H);
    let min=Infinity;
    let max=-Infinity;

    for(let i=0;i<temps.length;i++){
        const t=view.getInt16(i*2,true)/100;
        temps[i]=t;
        if(t<min)min=t;
        if(t>max)max=t;
    }

    // Smooth the auto-range so the colors don't flicker frame to frame
    smoothMin=smoothMin===null?min:smoothMin+(min-smoothMin)*0.3;
    smoothMax=smoothMax===null?max:smoothMax+(max-smoothMax)*0.3;

    const span=Math.max(smoothMax-smoothMin,MIN_SPAN_C);
    const pixels=frameImage.data;

    for(let y=0;y<THERMAL_H;y++){
        for(let x=0;x<THERMAL_W;x++){
            const sx=MIRROR_X?THERMAL_W-1-x:x;
            const sy=FLIP_Y?THERMAL_H-1-y:y;
            const t=temps[sy*THERMAL_W+sx];

            const norm=Math.min(Math.max((t-smoothMin)/span,0),1);
            const p=Math.round(norm*255)*3;
            const o=(y*THERMAL_W+x)*4;

            pixels[o]=palette[p];
            pixels[o+1]=palette[p+1];
            pixels[o+2]=palette[p+2];
            pixels[o+3]=255;
        }
    }

    frameCtx.putImageData(frameImage,0,0);
    ctx.drawImage(frameCanvas,0,0,canvas.width,canvas.height);

    // Center spot temperature (average of the 4 middle pixels) + crosshair
    const cx=THERMAL_W/2;
    const cy=THERMAL_H/2;
    const center=(
        temps[(cy-1)*THERMAL_W+cx-1]+
        temps[(cy-1)*THERMAL_W+cx]+
        temps[cy*THERMAL_W+cx-1]+
        temps[cy*THERMAL_W+cx]
    )/4;

    ctx.strokeStyle="rgba(255,255,255,0.8)";
    ctx.lineWidth=1;
    const arm=canvas.width*0.03;
    ctx.beginPath();
    ctx.moveTo(canvas.width/2-arm,canvas.height/2);
    ctx.lineTo(canvas.width/2+arm,canvas.height/2);
    ctx.moveTo(canvas.width/2,canvas.height/2-arm);
    ctx.lineTo(canvas.width/2,canvas.height/2+arm);
    ctx.stroke();

    rangeEl.textContent=`${min.toFixed(1)}° – ${max.toFixed(1)}°C`;
    spotEl.textContent=`Center ${center.toFixed(1)}°C`;
}

/* ==========================================
   Connection
========================================== */
function connect(){
    const ip=(cameraIpInput?.value||"").trim();

    if(!ip){
        setStatus("No camera IP","error");
        return;
    }

    setStatus("Connecting...","warn");

    const ws=new WebSocket(`ws://${ip}:${THERMAL_PORT}`);
    ws.binaryType="arraybuffer";
    socket=ws;

    ws.onopen=()=>{
        if(socket!==ws)return;
        lastFrameTime=Date.now();
        setStatus("Waiting...","warn");
    };

    ws.onmessage=event=>{
        if(socket!==ws)return;
        if(!(event.data instanceof ArrayBuffer))return;

        lastFrameTime=Date.now();
        renderFrame(event.data);
        setStatus("Live","live");
    };

    ws.onerror=()=>{
        ws.close();
    };

    ws.onclose=()=>{
        if(socket!==ws)return;   // closed on purpose, or replaced by a newer socket
        socket=null;

        if(!enabled)return;

        setStatus("Reconnecting...","warn");
        reconnectTimer=setTimeout(connect,2000);
    };
}

function disconnect(){
    clearTimeout(reconnectTimer);
    const ws=socket;
    socket=null;
    if(ws)ws.close();
    smoothMin=null;
    smoothMax=null;
    setStatus("Off","off");
}

// Show "No signal" if frames stop arriving while connected
setInterval(()=>{
    if(!enabled||!socket||socket.readyState!==WebSocket.OPEN)return;
    if(Date.now()-lastFrameTime>3000)setStatus("No signal","error");
},1000);

/* ==========================================
   Enable / disable overlay
========================================== */
function setEnabled(value){
    enabled=value;
    overlay.classList.toggle("visible",value);

    if(value){
        restorePosition();
        connect();
    }else{
        disconnect();
    }
}

/* ==========================================
   Dragging (mouse + touch)
========================================== */
let drag=null;

function moveTo(left,top){
    const maxLeft=Math.max(0,window.innerWidth-overlay.offsetWidth);
    const maxTop=Math.max(0,window.innerHeight-overlay.offsetHeight);

    overlay.style.left=`${Math.min(Math.max(0,left),maxLeft)}px`;
    overlay.style.top=`${Math.min(Math.max(0,top),maxTop)}px`;
    overlay.style.right="auto";
    overlay.style.bottom="auto";
}

   /* ==========================================
      Resizing (keeps the 4:3 shape)
   ========================================== */
   let resize=null;

   function setWidth(width){
       const max=Math.min(window.innerWidth-8,960);
       overlay.style.width=`${Math.min(Math.max(MIN_WIDTH,width),max)}px`;
   }

   resizeHandle.addEventListener("pointerdown",event=>{
       resize={
           startX:event.clientX,
           startY:event.clientY,
           startWidth:overlay.offsetWidth
       };
       resizeHandle.setPointerCapture(event.pointerId);
   });

   resizeHandle.addEventListener("pointermove",event=>{
       if(!resize)return;

       const dx=event.clientX-resize.startX;
       const dy=(event.clientY-resize.startY)*(4/3);   // height change converted to width

       setWidth(resize.startWidth+Math.max(dx,dy));

       const rect=overlay.getBoundingClientRect();
       moveTo(rect.left,rect.top);   // keep it on screen
   });

   function endResize(){
       if(!resize)return;
       resize=null;
       savePosition();
   }

   resizeHandle.addEventListener("pointerup",endResize);
   resizeHandle.addEventListener("pointercancel",endResize);

function savePosition(){
    try{
        const rect=overlay.getBoundingClientRect();
        localStorage.setItem(
            POSITION_KEY,
            JSON.stringify({left:rect.left,top:rect.top,width:rect.width})
        );
    }catch(error){}
}

function restorePosition(){
    try{
        const saved=JSON.parse(localStorage.getItem(POSITION_KEY));
        if(!saved)return;
        if(saved.width)setWidth(saved.width);
        moveTo(saved.left,saved.top);
    }catch(error){}
}

// function restorePosition(){
//     try{
//         const saved=JSON.parse(localStorage.getItem(POSITION_KEY));
//         if(saved)moveTo(saved.left,saved.top);
//     }catch(error){}
// }

header.addEventListener("pointerdown",event=>{
    if(event.target.closest("button"))return;

    const rect=overlay.getBoundingClientRect();
    drag={dx:event.clientX-rect.left,dy:event.clientY-rect.top};
    header.setPointerCapture(event.pointerId);
});

header.addEventListener("pointermove",event=>{
    if(!drag)return;
    moveTo(event.clientX-drag.dx,event.clientY-drag.dy);
});

function endDrag(){
    if(!drag)return;
    drag=null;
    savePosition();
}

header.addEventListener("pointerup",endDrag);
header.addEventListener("pointercancel",endDrag);

window.addEventListener("resize",()=>{
    if(!enabled)return;
    const rect=overlay.getBoundingClientRect();
    moveTo(rect.left,rect.top);
});

/* ==========================================
   Buttons
========================================== */
if(menuButton)menuButton.addEventListener("click",()=>setEnabled(!enabled));
if(closeButton)closeButton.addEventListener("click",()=>setEnabled(false));

console.log("🌡 THERMAL OVERLAY MODULE LOADED");