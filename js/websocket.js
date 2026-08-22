/* ==========================================
WebSocket Manager
========================================== */

let droneSocket = null;
let socketConnected = false;

let reconnectTimer = null;

let lastIP = "";
let lastPort = "";

const RECONNECT_DELAY = 2000;
let manualDisconnect = false;
let scanMode = false;

/* ==========================================
Connect
========================================== */

export function connectWebSocket(ip, port, scanning = false){

    scanMode = scanning;

    if(!scanMode){

        lastIP = ip;
        lastPort = port;

        manualDisconnect = false;
    }

    const url = `ws://${ip}:${port}`;

    console.log("Connecting:", url);

    if(droneSocket)
        droneSocket.close();

    droneSocket = new WebSocket(url);

    droneSocket.onopen = onConnected;
    droneSocket.onclose = onDisconnected;
    droneSocket.onerror = onError;
    droneSocket.onmessage = onMessage;
}

/* ==========================================
Connected
========================================== */

function onConnected(){

    console.log("WebSocket Connected");

    socketConnected = true;
    scanMode = false;

    if(reconnectTimer){

        clearInterval(reconnectTimer);
        reconnectTimer = null;
    }

    send({
        type:"identify"
    });
}

/* ==========================================
Disconnected
========================================== */

function onDisconnected(){

    console.log("WebSocket Closed");

    socketConnected = false;

    if(scanMode)
        return;

    window.dispatchEvent(
        new Event("drone-disconnected")
    );

    if(manualDisconnect)
        return;

    startReconnect();
}

/* ==========================================
Error
========================================== */

function onError(error){

    console.error(
        "WebSocket Error:",
        error
    );
}

/* ==========================================
Receive
========================================== */

function onMessage(event){

    console.log(
        "Received:",
        event.data
    );

    try{

        const message =
            JSON.parse(event.data);

        console.log(message);

        switch(message.type){

            case "identify":

                window.dispatchEvent(
                    new CustomEvent(
                        "drone-connected",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "telemetry":

                window.dispatchEvent(
                    new CustomEvent(
                        "telemetry-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "battery":

                window.dispatchEvent(
                    new CustomEvent(
                        "battery-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "imu":

                window.dispatchEvent(
                    new CustomEvent(
                        "imu-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "gps":

                window.dispatchEvent(
                    new CustomEvent(
                        "gps-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "distance":

                window.dispatchEvent(
                    new CustomEvent(
                        "distance-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "wifi":

                window.dispatchEvent(
                    new CustomEvent(
                        "wifi-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "camera":

                window.dispatchEvent(
                    new CustomEvent(
                        "camera-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "status":

                window.dispatchEvent(
                    new CustomEvent(
                        "status-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "mag":

                window.dispatchEvent(
                    new CustomEvent(
                        "magnetometer-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "calibration":

                window.dispatchEvent(
                    new CustomEvent(
                        "calibration-update",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "ack":

                window.dispatchEvent(
                    new CustomEvent(
                        "ack",
                        {
                            detail: message
                        }
                    )
                );

                break;


            case "pid":
    window.dispatchEvent(
        new CustomEvent(
            "pid-update",
            {
                detail: message
            }
        )
    );
    break;


            case "warning":

                window.dispatchEvent(
                    new CustomEvent(
                        "warning",
                        {
                            detail: message
                        }
                    )
                );

                break;

            case "log":

                window.dispatchEvent(
                    new CustomEvent(
                        "log",
                        {
                            detail: message
                        }
                    )
                );

                break;

            default:

                console.log(
                    "Unknown Message:",
                    message.type
                );

                break;
        }
    }

    catch(error){

        console.error(
            "Invalid JSON:",
            error
        );
    }
}

/* ==========================================
Auto Reconnect
========================================== */

function startReconnect(){

    if(reconnectTimer)
        return;

    console.log(
        "Starting Auto Reconnect..."
    );

    window.dispatchEvent(
        new Event("drone-reconnecting")
    );

    reconnectTimer = setInterval(()=>{

        if(socketConnected){

            clearInterval(reconnectTimer);
            reconnectTimer = null;

            return;
        }

        console.log(
            "Reconnect Attempt..."
        );

        connectWebSocket(
            lastIP,
            lastPort
        );

    },RECONNECT_DELAY);
}

/* ==========================================
Send
========================================== */

export function send(data){

    if(!socketConnected)
        return;

    droneSocket.send(
        JSON.stringify(data)
    );
}

/* ==========================================
Disconnect
========================================== */

export function disconnect(){

    manualDisconnect = true;

    if(reconnectTimer){

        clearInterval(reconnectTimer);
        reconnectTimer = null;
    }

    if(droneSocket)
        droneSocket.close();
}

/* ==========================================
Connection Status
========================================== */

export function isConnected(){

    return socketConnected;
}

/* ==========================================
Magnetometer Calibration Listener
========================================== */

window.addEventListener(
    "magnetometer-calibration-command",
    event => {

        send({
            type: "calibration",
            action: event.detail.action,
            sensor: "magnetometer"
        });
    }
);