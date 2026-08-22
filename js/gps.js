/* ==========================================
   Google Map GPS Manager
========================================== */
let dragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let map = null;
let droneMarker = null;
let resizing = false;
let startWidth = 0;
let startHeight = 0;
let startX = 0;
let startY = 0;

/* ==========================================
   Elements
========================================== */
const gpsScreen = document.querySelector("#gps-screen");
const gpsHeader = document.querySelector("#gps-header");
const resizeHandle = document.querySelector("#gps-resize-handle");

/* ==========================================
   Initialize Map
========================================== */
export function initializeMap(){
    if(typeof google === "undefined"){
        console.log("Google Maps not loaded yet");
        return;
    }

    const mapElement = document.querySelector("#map");

    if(!mapElement){
        console.error("GPS map element not found");
        return;
    }

    map = new google.maps.Map(
        mapElement,
        {
            zoom:15,
            center:{
                lat:6.4589,
                lng:3.6015
            },
            mapTypeId:"satellite"
        }
    );

    droneMarker = new google.maps.Marker({
        position:{
            lat:6.4589,
            lng:3.6015
        },
        map:map,
        title:"CARF-X1"
    });

    console.log("Google Map initialized");
}

/* ==========================================
   Update Drone Position
========================================== */
export function updateDroneMarker(lat,lng){
    if(!droneMarker)
        return;

    const position = {
        lat:Number(lat),
        lng:Number(lng)
    };

    droneMarker.setPosition(position);

    if(map){
        map.panTo(position);
    }
}

/* ==========================================
   Open GPS Screen
========================================== */
export function openGPS(){
    const screen = document.querySelector("#gps-screen");

    if(!screen){
        console.error("GPS screen #gps-screen not found");
        return;
    }

    console.log("Opening GPS screen");

    screen.classList.add("active");

    screen.style.display = "flex";
    screen.style.visibility = "visible";
    screen.style.opacity = "1";
    screen.style.pointerEvents = "auto";

    if(!map){
        initializeMap();
    }else{
        google.maps.event.trigger(map,"resize");
    }

    const sideMenu = document.querySelector("#side-menu");
    const menuOverlay = document.querySelector("#menu-overlay");

    if(sideMenu){
        sideMenu.classList.remove("open");
    }

    if(menuOverlay){
        menuOverlay.classList.remove("open");
    }
}

/* ==========================================
   Close GPS Screen
========================================== */
export function closeGPS(){
    const screen = document.querySelector("#gps-screen");

    if(!screen){
        console.error("GPS screen #gps-screen not found");
        return;
    }

    console.log("🔥 CLOSE GPS TRIGGERED");

    screen.classList.remove("active");

    screen.style.display = "none";
    screen.style.visibility = "hidden";
    screen.style.opacity = "0";
    screen.style.pointerEvents = "none";

    screen.removeAttribute("open");

    console.log(
        "GPS screen after close:",
        {
            classList:screen.className,
            display:screen.style.display,
            visibility:screen.style.visibility,
            opacity:screen.style.opacity
        }
    );
}

/* ==========================================
   CLOSE BUTTON
   Event Delegation
========================================== */
document.addEventListener("click",(event)=>{
    const closeButton = event.target.closest("#close-map");

    if(!closeButton)
        return;

    console.log("🔥 CLOSE MAP BUTTON CLICKED");

    event.preventDefault();
    event.stopPropagation();

    closeGPS();
},true);

/* ==========================================
   Drag GPS Window
========================================== */
if(gpsHeader && gpsScreen){
    gpsHeader.addEventListener("pointerdown",(event)=>{
        if(event.target.closest("#close-map"))
            return;

        dragging = true;

        const rect =
            gpsScreen.getBoundingClientRect();

        dragOffsetX =
            event.clientX - rect.left;

        dragOffsetY =
            event.clientY - rect.top;

        gpsScreen.classList.add("dragging");

        gpsHeader.setPointerCapture(
            event.pointerId
        );
    });

    gpsHeader.addEventListener("pointermove",(event)=>{
        if(!dragging)
            return;

        gpsScreen.style.left =
            `${event.clientX - dragOffsetX}px`;

        gpsScreen.style.top =
            `${event.clientY - dragOffsetY}px`;

        gpsScreen.style.right = "auto";
        gpsScreen.style.bottom = "auto";
    });

    gpsHeader.addEventListener("pointerup",()=>{
        dragging = false;
        gpsScreen.classList.remove("dragging");
    });

    gpsHeader.addEventListener("pointercancel",()=>{
        dragging = false;
        gpsScreen.classList.remove("dragging");
    });
}

/* ==========================================
   Resize GPS Window
========================================== */
if(resizeHandle && gpsScreen){
    resizeHandle.addEventListener("pointerdown",(event)=>{
        event.preventDefault();
        event.stopPropagation();

        resizing = true;

        const rect =
            gpsScreen.getBoundingClientRect();

        startWidth = rect.width;
        startHeight = rect.height;

        startX = event.clientX;
        startY = event.clientY;

        resizeHandle.setPointerCapture(
            event.pointerId
        );
    });

    resizeHandle.addEventListener("pointermove",(event)=>{
        if(!resizing)
            return;

        const newWidth =
            startWidth +
            (event.clientX - startX);

        const newHeight =
            startHeight +
            (event.clientY - startY);

        gpsScreen.style.width =
            `${Math.max(250,newWidth)}px`;

        gpsScreen.style.height =
            `${Math.max(200,newHeight)}px`;
    });

    resizeHandle.addEventListener("pointerup",()=>{
        resizing = false;
    });

    resizeHandle.addEventListener("pointercancel",()=>{
        resizing = false;
    });
}

console.log("📍 GPS module loaded");