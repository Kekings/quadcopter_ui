import { send } from "./websocket.js";

/* ==========================================
Calibration Manager
========================================== */

const startButton = document.querySelector("#start-calibration-button");
const applyButton = document.querySelector("#apply-calibration-button");
const cancelButton = document.querySelector("#cancel-calibration-button");
const calibrateAgainButton = document.querySelector("#calibrate-again-button");

const progressFill = document.querySelector("#calibration-progress-fill");
const progressText = document.querySelector("#calibration-progress-text");
const statusText = document.querySelector("#calibration-status");
const instructionText = document.querySelector("#calibration-instruction-text");
const savedStatus = document.querySelector("#calibration-saved-status");

/* ==========================================
Calibration Result Elements
========================================== */

// Gyroscope
const gyroX = document.querySelector("#gyro-x");
const gyroY = document.querySelector("#gyro-y");
const gyroZ = document.querySelector("#gyro-z");

// Accelerometer
const accelX = document.querySelector("#accel-x");
const accelY = document.querySelector("#accel-y");
const accelZ = document.querySelector("#accel-z");

// Magnetometer Hard Iron
const hardIronX = document.querySelector("#hardiron-x");
const hardIronY = document.querySelector("#hardiron-y");
const hardIronZ = document.querySelector("#hardiron-z");

// Magnetometer Soft Iron
const softIron00 = document.querySelector("#softiron-00");
const softIron01 = document.querySelector("#softiron-01");
const softIron02 = document.querySelector("#softiron-02");
const softIron10 = document.querySelector("#softiron-10");
const softIron11 = document.querySelector("#softiron-11");
const softIron12 = document.querySelector("#softiron-12");
const softIron20 = document.querySelector("#softiron-20");
const softIron21 = document.querySelector("#softiron-21");
const softIron22 = document.querySelector("#softiron-22");

// Sensor status circles
const gyroStatus = document.querySelector("#gyroscope-status");
const accelStatus = document.querySelector("#accelerometer-status");
const magStatus = document.querySelector("#magnetometer-status");

/* ==========================================
State
========================================== */

let calibrationRunning = false;
let calibrationComplete = false;
let calibrationApplied = false;
let currentStage = null;
let calibrationSampleCount = 0;

let gyroCalibrationResult = null;
let accelCalibrationResult = null;
let magCalibrationResult = null;

/*
   Latest complete calibration package.
   This is kept so it can be resent to the
   ESP32 if the WebSocket reconnects.
*/
let pendingCalibrationPackage = null;
let calibrationPackageSent = false;

/* ==========================================
FastAPI WebSocket
========================================== */

let fastApiSocket = null;
let fastApiReconnectTimer = null;

function connectFastAPI() {
    if (fastApiSocket &&
        (fastApiSocket.readyState === WebSocket.OPEN ||
         fastApiSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }


    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;

    fastApiSocket = new WebSocket(
        `${protocol}//${host}/ws/calibration`
    );

    fastApiSocket.onopen = () => {
        console.log("FastAPI calibration connected");

        if (fastApiReconnectTimer) {
            clearTimeout(fastApiReconnectTimer);
            fastApiReconnectTimer = null;
        }
    };

    fastApiSocket.onclose = () => {
        console.log("FastAPI calibration disconnected");
        fastApiSocket = null;

        if (!fastApiReconnectTimer) {
            fastApiReconnectTimer = setTimeout(() => {
                fastApiReconnectTimer = null;
                connectFastAPI();
            }, 2000);
        }
    };

    fastApiSocket.onerror = error => {
        console.error("FastAPI WebSocket error:", error);
    };

    fastApiSocket.onmessage = event => {
        try {
            const data = JSON.parse(event.data);
            console.log("FastAPI RX:", data);
            handleFastAPIMessage(data);
        } catch (error) {
            console.error("Invalid FastAPI JSON:", error);
        }
    };
}

/* ==========================================
Send To FastAPI
========================================== */

function sendToFastAPI(data) {
    if (fastApiSocket &&
        fastApiSocket.readyState === WebSocket.OPEN) {
        fastApiSocket.send(JSON.stringify(data));
        console.log("FastAPI TX:", data);
    } else {
        console.warn("FastAPI socket not connected:", data);
    }
}

/* ==========================================
Send To ESP32
========================================== */

function sendToESP32(data) {
    console.log("ESP32 TX:", data);
    send(data);
}

/* ==========================================
Send Latest Calibration To ESP32
========================================== */

function sendCalibrationPackageToESP32() {
    if (!pendingCalibrationPackage) {
        console.warn("No calibration package available");
        return;
    }

    sendToESP32(pendingCalibrationPackage);

    console.log("📤 Calibration package sent to ESP32:", pendingCalibrationPackage);

    calibrationPackageSent = true;
}

/* ==========================================
Progress
========================================== */

function updateProgress(percent) {
    percent = Math.max(0, Math.min(100, percent));

    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }

    if (progressText) {
        progressText.textContent = `${percent}%`;
    }
}

/* ==========================================
Sensor Status
========================================== */

function setSensorStatus(sensor, state) {
    const element =
        sensor === "gyro" ? gyroStatus :
        sensor === "accel" ? accelStatus :
        sensor === "mag" ? magStatus :
        null;

    if (!element) return;

    element.classList.remove(
        "calibration-active",
        "calibration-complete"
    );

    if (state === "active") {
        element.textContent = "🟡 Calibrating";
        element.classList.add("calibration-active");
    }

    if (state === "complete") {
        element.textContent = "🟢 Complete";
        element.classList.add("calibration-complete");
    }

    if (state === "ready") {
        element.textContent = "⚪ Ready";
    }
}

/* ==========================================
Reset Sensor Status
========================================== */

function resetSensorStatus() {
    setSensorStatus("gyro", "ready");
    setSensorStatus("accel", "ready");
    setSensorStatus("mag", "ready");
}

/* ==========================================
Start Calibration
========================================== */

function startCalibration() {
    calibrationRunning = true;
    calibrationComplete = false;
    calibrationApplied = false;
    calibrationPackageSent = false;
    pendingCalibrationPackage = null;

    currentStage = null;
    calibrationSampleCount = 0;

    gyroCalibrationResult = null;
    accelCalibrationResult = null;
    magCalibrationResult = null;

    if (applyButton) {
        applyButton.disabled = true;
    }

    updateProgress(0);
    resetSensorStatus();

    if (statusText) {
        statusText.textContent = "🟡 Calibration starting...";
    }

    if (instructionText) {
        instructionText.textContent =
            "Keep the drone still and level.";
    }

    if (savedStatus) {
        savedStatus.textContent =
            "💾 Calibration not yet saved";
    }

    sendToESP32({
        type: "calibration",
        action: "start"
    });
}

/* ==========================================
ESP32 Calibration Messages
========================================== */

function handleESP32CalibrationMessage(data) {
    console.log("ESP32 Calibration:", data);

    if (data.type === "mag") {
        handleMagnetometerSample(data);
        return;
    }

    if (data.type !== "calibration") {
        return;
    }

    /* ======================================
    Stage Started
    ====================================== */

    if (data.state === "started") {
        currentStage = data.stage;
        calibrationSampleCount = 0;

        if (data.stage === "gyro") {
            updateProgress(0);
            setSensorStatus("gyro", "active");

            if (statusText) {
                statusText.textContent =
                    "🟡 Gyroscope calibration...";
            }

            if (instructionText) {
                instructionText.textContent =
                    "Keep the drone completely still.";
            }
        }

        else if (data.stage === "accel") {
            updateProgress(25);
            setSensorStatus("gyro", "complete");
            setSensorStatus("accel", "active");

            if (statusText) {
                statusText.textContent =
                    "🟡 Accelerometer calibration...";
            }

            if (instructionText) {
                instructionText.textContent =
                    "Keep the drone completely still and level.";
            }
        }

        else if (data.stage === "mag") {
            updateProgress(50);
            setSensorStatus("gyro", "complete");
            setSensorStatus("accel", "complete");
            setSensorStatus("mag", "active");

            if (statusText) {
                statusText.textContent =
                    "🟡 Magnetometer calibration...";
            }

            if (instructionText) {
                instructionText.textContent =
                    "Rotate the drone slowly through different orientations.";
            }

            window.dispatchEvent(
                new Event("magnetometerCalibrationStarted")
            );

            sendToFastAPI({
                type: "calibration_start"
            });
        }

        return;
    }

    /* ======================================
    Stage Complete
    ====================================== */

    if (data.state === "complete") {
        if (data.stage === "gyro") {
            currentStage = "gyro";
            updateProgress(25);

            gyroCalibrationResult = data;

            showCalibrationResult(
                "Gyroscope",
                data
            );

            return;
        }

        if (data.stage === "accel") {
            currentStage = "accel";
            updateProgress(50);

            accelCalibrationResult = data;

            showCalibrationResult(
                "Accelerometer",
                data
            );

            return;
        }

        if (data.stage === "mag") {
            currentStage = "mag";
            updateProgress(75);

            if (statusText) {
                statusText.textContent =
                    "🔵 Processing magnetometer...";
            }

            if (instructionText) {
                instructionText.textContent =
                    "Magnetometer sampling is complete. FastAPI is calculating the calibration values.";
            }

            sendToFastAPI({
                type: "calibration_complete"
            });

            return;
        }
    }

    /* ======================================
    Calibration Cancelled
    ====================================== */

    if (data.state === "cancelled") {
        calibrationRunning = false;
        calibrationComplete = false;
        currentStage = null;

        updateProgress(0);
        resetSensorStatus();

        if (statusText) {
            statusText.textContent =
                "⚪ Calibration cancelled";
        }

        if (instructionText) {
            instructionText.textContent =
                "Calibration process was interrupted.";
        }

        return;
    }
}

/* ==========================================
Magnetometer Sample
========================================== */

function handleMagnetometerSample(data) {
    if (!calibrationRunning || currentStage !== "mag") {
        return;
    }

    calibrationSampleCount++;

    sendToFastAPI({
        type: "mag_sample",
        x: data.x,
        y: data.y,
        z: data.z
    });

    window.dispatchEvent(
        new CustomEvent(
            "magnetometerRawSample",
            {
                detail: {
                    x: data.x,
                    y: data.y,
                    z: data.z
                }
            }
        )
    );
}

/* ==========================================
FastAPI Messages
========================================== */

function handleFastAPIMessage(data) {
    /* ======================================
    Calibration Started
    ====================================== */

    if (data.type === "calibration_started") {
        console.log(
            "FastAPI magnetometer calibration started"
        );
        return;
    }

    /* ======================================
    Sample Received
    ====================================== */

    if (data.type === "sample_received") {
        calibrationSampleCount =
            data.count || calibrationSampleCount;

        return;
    }

    /* ======================================
    Calibration Result
    ====================================== */

    if (data.type === "calibration_result" && data.success === true) {
        calibrationRunning = false;
        calibrationComplete = true;
        calibrationApplied = false;
        currentStage = "mag";

        updateProgress(100);
        setSensorStatus("gyro", "complete");
        setSensorStatus("accel", "complete");
        setSensorStatus("mag", "complete");

        magCalibrationResult = {
            hardIron: data.hardIron,
            softIron: data.softIron,
            corrected: data.corrected
        };

        /* ==================================
        Validate Result
        ================================== */

        if (!Array.isArray(data.hardIron) ||
            data.hardIron.length !== 3) {
            console.error(
                "Invalid hardIron result:",
                data.hardIron
            );
            return;
        }

        if (!Array.isArray(data.softIron) ||
            data.softIron.length !== 3 ||
            !Array.isArray(data.softIron[0]) ||
            !Array.isArray(data.softIron[1]) ||
            !Array.isArray(data.softIron[2])) {
            console.error(
                "Invalid softIron matrix:",
                data.softIron
            );
            return;
        }

        /* ==================================
        Display Hard Iron
        ================================== */

        if (hardIronX) {
            hardIronX.textContent =
                Number(data.hardIron[0]).toFixed(4);
        }

        if (hardIronY) {
            hardIronY.textContent =
                Number(data.hardIron[1]).toFixed(4);
        }

        if (hardIronZ) {
            hardIronZ.textContent =
                Number(data.hardIron[2]).toFixed(4);
        }

        /* ==================================
        Display Soft Iron Matrix
        ================================== */

        const matrix = data.softIron;

        if (softIron00) {
            softIron00.textContent =
                Number(matrix[0][0]).toFixed(4);
        }

        if (softIron01) {
            softIron01.textContent =
                Number(matrix[0][1]).toFixed(4);
        }

        if (softIron02) {
            softIron02.textContent =
                Number(matrix[0][2]).toFixed(4);
        }

        if (softIron10) {
            softIron10.textContent =
                Number(matrix[1][0]).toFixed(4);
        }

        if (softIron11) {
            softIron11.textContent =
                Number(matrix[1][1]).toFixed(4);
        }

        if (softIron12) {
            softIron12.textContent =
                Number(matrix[1][2]).toFixed(4);
        }

        if (softIron20) {
            softIron20.textContent =
                Number(matrix[2][0]).toFixed(4);
        }

        if (softIron21) {
            softIron21.textContent =
                Number(matrix[2][1]).toFixed(4);
        }

        if (softIron22) {
            softIron22.textContent =
                Number(matrix[2][2]).toFixed(4);
        }

        /* ==================================
        Build Complete Calibration Package
        ================================== */

        pendingCalibrationPackage = {
            type: "calibration",
            action: "result",
            gyro: gyroCalibrationResult,
            accel: accelCalibrationResult,
            hardIron: data.hardIron,
            softIron: data.softIron
        };

        /* ==================================
        Send Immediately If Connected
        ================================== */

        sendCalibrationPackageToESP32();

        /* ==================================
        Status
        ================================== */

        if (statusText) {
            statusText.textContent =
                "🟢 Calibration complete";
        }

        if (instructionText) {
            instructionText.textContent =
                "All calibration values are ready. Review the values and apply them to save.";
        }

        if (applyButton) {
            applyButton.disabled = false;
        }

        /* ==================================
        Corrected Magnetometer Data
        ================================== */

        window.dispatchEvent(
            new CustomEvent(
                "magnetometerCorrectedData",
                {
                    detail: data.corrected
                }
            )
        );

        /* ==================================
        Calibration Result Event
        ================================== */

        window.dispatchEvent(
            new CustomEvent(
                "magnetometerCalibrationResult",
                {
                    detail: data
                }
            )
        );

        return;
    }

    /* ======================================
    Calibration Failed
    ====================================== */

    if (data.type === "calibration" && data.success === false) {
        calibrationRunning = false;
        calibrationComplete = false;

        if (statusText) {
            statusText.textContent =
                `🔴 ${data.message}`;
        }

        if (instructionText) {
            instructionText.textContent =
                "Please perform the magnetometer calibration again.";
        }

        return;
    }

    /* ======================================
    Calibration Cancelled
    ====================================== */

    if (data.type === "calibration_cancelled") {
        calibrationRunning = false;
        calibrationComplete = false;
        currentStage = null;

        updateProgress(0);
        resetSensorStatus();

        if (statusText) {
            statusText.textContent =
                "⚪ Calibration cancelled";
        }

        if (instructionText) {
            instructionText.textContent =
                "Calibration process was interrupted.";
        }

        return;
    }

    /* ======================================
    Calibration Applied
    ====================================== */

    if (data.type === "calibration_applied") {
        calibrationApplied = true;

        if (savedStatus) {
            savedStatus.textContent =
                "💾 Calibration saved to flight controller";
        }

        if (statusText) {
            statusText.textContent =
                "🟢 Calibration applied";
        }

        return;
    }

    /* ======================================
    Error
    ====================================== */

    if (data.type === "error") {
        console.error(
            "FastAPI calibration error:",
            data.message
        );

        if (statusText) {
            statusText.textContent =
                `🔴 ${data.message}`;
        }

        return;
    }
}

/* ==========================================
Show Sensor Calibration Result
========================================== */

function showCalibrationResult(sensor, data) {
    window.dispatchEvent(
        new CustomEvent(
            "sensorCalibrationResult",
            {
                detail: {
                    sensor: sensor,
                    data: data
                }
            }
        )
    );

    if (sensor === "Gyroscope") {
        const offset = data.offset;

        if (offset) {
            if (gyroX) {
                gyroX.textContent =
                    Number(offset.x).toFixed(4);
            }

            if (gyroY) {
                gyroY.textContent =
                    Number(offset.y).toFixed(4);
            }

            if (gyroZ) {
                gyroZ.textContent =
                    Number(offset.z).toFixed(4);
            }
        }

        gyroCalibrationResult = {
            offset: offset
        };

        setSensorStatus("gyro", "complete");

        if (statusText) {
            statusText.textContent =
                "🟢 Gyroscope calibration complete";
        }

        if (instructionText) {
            instructionText.textContent =
                "Gyroscope offsets recorded. Accelerometer calibration is starting...";
        }

        return;
    }

    if (sensor === "Accelerometer") {
        const offset = data.offset;

        if (offset) {
            if (accelX) {
                accelX.textContent =
                    Number(offset.x).toFixed(4);
            }

            if (accelY) {
                accelY.textContent =
                    Number(offset.y).toFixed(4);
            }

            if (accelZ) {
                accelZ.textContent =
                    Number(offset.z).toFixed(4);
            }
        }

        accelCalibrationResult = {
            offset: offset
        };

        setSensorStatus("accel", "complete");

        if (statusText) {
            statusText.textContent =
                "🟢 Accelerometer calibration complete";
        }

        if (instructionText) {
            instructionText.textContent =
                "Accelerometer offsets recorded. Magnetometer calibration is starting...";
        }

        return;
    }
}

/* ==========================================
Apply Calibration
========================================== */

function applyCalibration() {
    if (!calibrationComplete) {
        console.warn("Calibration is not complete");
        return;
    }

    if (!magCalibrationResult) {
        console.warn("Magnetometer calibration result missing");
        return;
    }

    if (!gyroCalibrationResult) {
        console.warn("Gyroscope calibration result missing");
        return;
    }

    if (!accelCalibrationResult) {
        console.warn("Accelerometer calibration result missing");
        return;
    }

    calibrationApplied = true;

    if (applyButton) {
        applyButton.disabled = true;
    }

    if (savedStatus) {
        savedStatus.textContent =
            "💾 Sending complete calibration to flight controller...";
    }

    if (statusText) {
        statusText.textContent =
            "🟡 Applying calibration...";
    }

    if (instructionText) {
        instructionText.textContent =
            "Sending gyro, accelerometer and magnetometer calibration values to the flight controller.";
    }

    /* ==================================
    Build Final Calibration Package
    ================================== */

    pendingCalibrationPackage = {
        type: "calibration",
        action: "save",
        gyro: gyroCalibrationResult,
        accel: accelCalibrationResult,
        hardIron: magCalibrationResult.hardIron,
        softIron: magCalibrationResult.softIron
    };

    calibrationPackageSent = false;

    /* ==================================
    Send Complete Package
    ================================== */

    sendCalibrationPackageToESP32();

    console.log(
        "📤 FINAL CALIBRATION PACKAGE:",
        pendingCalibrationPackage
    );
}

/* ==========================================
Cancel Calibration
========================================== */

function cancelCalibration(confirmUser = true) {
    if (calibrationRunning) {
        calibrationRunning = false;
        currentStage = null;

        updateProgress(0);
        resetSensorStatus();

        if (statusText) {
            statusText.textContent =
                "⚪ Calibration cancelled";
        }

        if (instructionText) {
            instructionText.textContent =
                "Calibration process was interrupted.";
        }

        sendToESP32({
            type: "calibration",
            action: "cancel"
        });

        sendToFastAPI({
            type: "calibration_cancel"
        });
    }

    else if (calibrationComplete) {
        calibrationComplete = false;
        calibrationApplied = false;
        pendingCalibrationPackage = null;
        calibrationPackageSent = false;

        updateProgress(0);
        resetSensorStatus();

        if (statusText) {
            statusText.textContent =
                "⚪ Calibration discarded";
        }

        if (instructionText) {
            instructionText.textContent =
                "The calibration values were not saved.";
        }

        sendToESP32({
            type: "calibration",
            action: "discard"
        });
    }

    if (!confirmUser) {
        return;
    }

    const calibrateAgain = confirm(
        "Calibration was cancelled.\n\n" +
        "Would you like to calibrate again?"
    );

    if (calibrateAgain) {
        startCalibration();
    }
}

/* ==========================================
Calibrate Again
========================================== */

function calibrateAgain() {
    const confirmAgain = confirm(
        "Start a new calibration?\n\n" +
        "Current unsaved calibration values " +
        "will be discarded."
    );

    if (!confirmAgain) {
        return;
    }

    sendToESP32({
        type: "calibration",
        action: "discard"
    });

    startCalibration();
}

/* ==========================================
Button Events
========================================== */

if (startButton) {
    startButton.addEventListener(
        "click",
        startCalibration
    );
}

if (applyButton) {
    applyButton.addEventListener(
        "click",
        applyCalibration
    );
}

if (cancelButton) {
    cancelButton.addEventListener(
        "click",
        cancelCalibration
    );
}

if (calibrateAgainButton) {
    calibrateAgainButton.addEventListener(
        "click",
        calibrateAgain
    );
}

/* ==========================================
Listen To ESP32 WebSocket
========================================== */

window.addEventListener(
    "magnetometer-update",
    event => {
        handleESP32CalibrationMessage(
            event.detail
        );
    }
);

window.addEventListener(
    "calibration-update",
    event => {
        handleESP32CalibrationMessage(
            event.detail
        );
    }
);

/* ==========================================
ESP32 Reconnection
========================================== */

window.addEventListener(
    "drone-connected",
    event => {
        console.log(
            "🚁 ESP32 connected again"
        );

        /*
           If calibration values were already
           calculated, resend them now.
        */

        if (pendingCalibrationPackage) {
            console.log(
                "🔄 Resending calibration package after ESP32 connection"
            );

            setTimeout(() => {
                sendCalibrationPackageToESP32();
            }, 300);
        }
    }
);

/* ==========================================
Start FastAPI Connection
========================================== */

connectFastAPI();