from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .magnetometer_calibration import MagnetometerCalibration

# ==========================================
# Paths
# ==========================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

# ==========================================
# FastAPI Application
# ==========================================

app = FastAPI(title="Drone Controller Backend")

# ==========================================
# Frontend Static Files
# ==========================================

app.mount(
    "/css",
    StaticFiles(directory=PROJECT_DIR / "css"),
    name="css"
)

app.mount(
    "/js",
    StaticFiles(directory=PROJECT_DIR / "js"),
    name="js"
)


app.mount(
    "/videos",
    StaticFiles(directory=PROJECT_DIR / "videos"),
    name="videos"
)

# ==========================================
# Frontend
# ==========================================

@app.get("/")
async def frontend():
    return FileResponse(PROJECT_DIR / "index.html")

# ==========================================
# Backend Status
# ==========================================

@app.get("/api/status")
async def api_status():
    return {"status": "Backend running"}

# ==========================================
# Calibration WebSocket
# ==========================================

@app.websocket("/ws/calibration")
async def calibration_socket(websocket: WebSocket):
    await websocket.accept()

    calibration = MagnetometerCalibration()

    print("Calibration client connected")

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            print("FastAPI RX:", data)

            # ==================================
            # Start Magnetometer Calibration
            # ==================================

            if message_type == "calibration_start":
                calibration.reset()

                print("Magnetometer processing started")

                await websocket.send_json({
                    "type": "calibration_started",
                    "success": True
                })

            # ==================================
            # Magnetometer Sample
            # ==================================

            elif message_type == "mag_sample":
                try:
                    x = float(data["x"])
                    y = float(data["y"])
                    z = float(data["z"])

                    calibration.add_sample(x, y, z)

                    count = calibration.sample_count()

                    await websocket.send_json({
                        "type": "sample_received",
                        "count": count
                    })

                except (KeyError, TypeError, ValueError) as error:
                    print(
                        "Invalid magnetometer sample:",
                        error
                    )

                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid magnetometer sample"
                    })

            # ==================================
            # Complete Magnetometer Calibration
            # ==================================

            elif message_type == "calibration_complete":
                print("Processing magnetometer calibration...")

                result = calibration.calibrate()

                if result is None:
                    await websocket.send_json({
                        "type": "calibration_result",
                        "success": False,
                        "message": "Not enough samples"
                    })

                    continue

                corrected = calibration.corrected_data()

                print("Magnetometer calibration complete")

                await websocket.send_json({
                    "type": "calibration_result",
                    "success": True,
                    "hardIron": result["hardIron"],
                    "softIron": result["softIron"],
                    "corrected": corrected
                })

            # ==================================
            # Cancel Magnetometer Calibration
            # ==================================

            elif message_type == "calibration_cancel":
                calibration.reset()

                print("Magnetometer calibration cancelled")

                await websocket.send_json({
                    "type": "calibration_cancelled",
                    "success": True
                })

            # ==================================
            # Apply Calibration
            # ==================================

            elif message_type == "apply_calibration":
                result = calibration.get_result()

                if result is None:
                    await websocket.send_json({
                        "type": "error",
                        "message": "No calibration result available"
                    })

                    continue

                print("Magnetometer calibration applied")

                await websocket.send_json({
                    "type": "calibration_applied",
                    "success": True,
                    "hardIron": result["hardIron"],
                    "softIron": result["softIron"]
                })

            # ==================================
            # Unknown Command
            # ==================================

            else:
                print(
                    "Unknown calibration command:",
                    message_type
                )

                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown command: {message_type}"
                })

    except WebSocketDisconnect:
        print("Calibration client disconnected")