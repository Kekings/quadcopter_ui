/* ==========================================
   Magnetometer 3D Calibration Plot
========================================== */
console.log("🔥 calibration-plot.js LOADED");

let rawMagData = {
    x: [],
    y: [],
    z: []
};

let correctedMagData = {
    x: [],
    y: [],
    z: []
};

let magnetometerPlot = null;

/* ==========================================
   Initialize Plot
========================================== */

function initializeMagnetometer3DPlot() {

    const plotElement =
        document.querySelector("#magnetometer-3d-plot");

    if (!plotElement) {
        console.error(
            "❌ Magnetometer 3D plot element not found"
        );
        return;
    }

    if (typeof Plotly === "undefined") {
        console.error(
            "❌ Plotly is not loaded"
        );
        return;
    }

    console.log(
        "✅ Initializing magnetometer 3D plot"
    );

    const rawTrace = {
        x: [],
        y: [],
        z: [],
        mode: "markers",
        type: "scatter3d",
        name: "Raw",
        marker: {
            size: 3,
            opacity: 0.7
        }
    };

    const correctedTrace = {
        x: [],
        y: [],
        z: [],
        mode: "markers",
        type: "scatter3d",
        name: "Corrected",
        marker: {
            size: 3,
            opacity: 0.7
        }
    };

    const layout = {
        title: {
            text: "Magnetometer Calibration"
        },
        scene: {
            xaxis: {
                title: "X"
            },
            yaxis: {
                title: "Y"
            },
            zaxis: {
                title: "Z"
            },
            aspectmode: "data"
        },
        margin: {
            l: 0,
            r: 0,
            t: 45,
            b: 0
        },
        legend: {
            orientation: "h"
        }
    };

    const config = {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        doubleClick: "reset",
        modeBarButtonsToRemove: [
            "toImage"
        ]
    };

    Plotly.newPlot(
        plotElement,
        [rawTrace, correctedTrace],
        layout,
        config
    ).then(() => {

        magnetometerPlot = plotElement;

        console.log(
            "✅ Magnetometer 3D plot initialized"
        );

        window.dispatchEvent(
            new Event("magnetometerPlotReady")
        );

    }).catch(error => {

        console.error(
            "❌ Plotly initialization failed:",
            error
        );

    });
}

/* ==========================================
   Add Raw Magnetometer Sample
========================================== */

function addRawMagSample(x, y, z) {

    x = Number(x);
    y = Number(y);
    z = Number(z);

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
    ) {
        return;
    }

    rawMagData.x.push(x);
    rawMagData.y.push(y);
    rawMagData.z.push(z);

    if (!magnetometerPlot) {
        return;
    }

    Plotly.extendTraces(
        magnetometerPlot,
        {
            x: [[x]],
            y: [[y]],
            z: [[z]]
        },
        [0]
    );
}

/* ==========================================
   Display Corrected Magnetometer Data
========================================== */

function setCorrectedMagData(data) {

    if (!data) {
        return;
    }

    correctedMagData.x =
        Array.isArray(data.x)
            ? data.x.map(Number)
            : [];

    correctedMagData.y =
        Array.isArray(data.y)
            ? data.y.map(Number)
            : [];

    correctedMagData.z =
        Array.isArray(data.z)
            ? data.z.map(Number)
            : [];

    if (!magnetometerPlot) {
        console.warn(
            "Plot not ready for corrected data"
        );
        return;
    }

    Plotly.restyle(
        magnetometerPlot,
        {
            x: [correctedMagData.x],
            y: [correctedMagData.y],
            z: [correctedMagData.z]
        },
        [1]
    );
}

/* ==========================================
   Clear Raw Data
========================================== */

function clearRawMagData() {

    rawMagData.x = [];
    rawMagData.y = [];
    rawMagData.z = [];

    if (!magnetometerPlot) {
        return;
    }

    Plotly.restyle(
        magnetometerPlot,
        {
            x: [[]],
            y: [[]],
            z: [[]]
        },
        [0]
    );
}

/* ==========================================
   Clear Corrected Data
========================================== */

function clearCorrectedMagData() {

    correctedMagData.x = [];
    correctedMagData.y = [];
    correctedMagData.z = [];

    if (!magnetometerPlot) {
        return;
    }

    Plotly.restyle(
        magnetometerPlot,
        {
            x: [[]],
            y: [[]],
            z: [[]]
        },
        [1]
    );
}

/* ==========================================
   Clear Entire Plot
========================================== */

function clearMagnetometerPlot() {

    clearRawMagData();
    clearCorrectedMagData();
}

/* ==========================================
   Raw Magnetometer Event
========================================== */

window.addEventListener(
    "magnetometerRawSample",
    event => {

        const data = event.detail;

        if (!data) {
            return;
        }

        addRawMagSample(
            data.x,
            data.y,
            data.z
        );
    }
);

/* ==========================================
   Corrected Magnetometer Event
========================================== */

window.addEventListener(
    "magnetometerCorrectedData",
    event => {

        setCorrectedMagData(
            event.detail
        );
    }
);

/* ==========================================
   Calibration Started
========================================== */

window.addEventListener(
    "magnetometerCalibrationStarted",
    () => {

        clearMagnetometerPlot();

    }
);

/* ==========================================
   Plot Ready
========================================== */

window.addEventListener(
    "magnetometerPlotReady",
    () => {

        console.log(
            "📊 Magnetometer plot is ready"
        );

    }
);

/* ==========================================
   Initialize After Page Load
========================================== */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMagnetometer3DPlot
    );

} else {

    initializeMagnetometer3DPlot();

}