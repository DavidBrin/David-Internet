from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import json
import os
import csv
from datetime import datetime
from pathlib import Path
import paho.mqtt.client as mqtt
import requests
from dotenv import load_dotenv

load_dotenv()

STUDENT_ID = os.getenv("STUDENT_ID")
MQTT_TOPIC = os.getenv("MQTT_TOPIC")
MQTT_BROKER = "broker.emqx.io"
API_URL = "https://sophos.ece140.site"
_csv_path = Path(__file__).resolve().parent / "my_collection.csv"

clients: list[WebSocket] = []
current_frame = None
frame_count = 0
empty_count = 0
present_count = 0

TARGET_EMPTY = 50
TARGET_PRESENT = 50


def on_message(client, userdata, msg):
    global current_frame
    try:
        data = json.loads(msg.payload.decode())
        if "pixels" in data and len(data["pixels"]) == 64:
            current_frame = data["pixels"]
    except Exception:
        pass


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_message = on_message


async def broadcast_frames():
    global current_frame
    while True:
        if current_frame and clients:
            msg = json.dumps({
                "type": "frame",
                "pixels": current_frame,
                "stats": {
                    "total": frame_count,
                    "empty": empty_count,
                    "present": present_count,
                    "target_empty": TARGET_EMPTY,
                    "target_present": TARGET_PRESENT
                }
            })
            for client in clients:
                try:
                    await client.send_text(msg)
                except Exception:
                    pass
            current_frame = None
        await asyncio.sleep(0.1)


@asynccontextmanager
async def lifespan(app):
    mqtt_client.connect(MQTT_BROKER, 1883, 60)
    mqtt_client.subscribe(MQTT_TOPIC)
    mqtt_client.loop_start()
    asyncio.create_task(broadcast_frames())
    yield
    mqtt_client.loop_stop()


app = FastAPI(lifespan=lifespan)
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        clients.remove(websocket)


@app.post("/api/collect")
async def collect_frame(request: Request):
    global frame_count, empty_count, present_count

    data = await request.json()
    # TODO: Validate that the frame has "label" and "pixels" with 64 values
    # TODO: Build the payload and POST to API_URL/frames with Bearer token
    # TODO: Update counters (frame_count, empty_count, present_count) on success
    # TODO: Return {"success": True/False} with appropriate status
    label = data.get("label")
    pixels = data.get("pixels")
    if label not in ("empty", "present"):
        return {"success": False, "error": "Invalid or missing label"}
    if not isinstance(pixels, list) or len(pixels) != 64:
        return {"success": False, "error": "pixels must be an array of 64 values"}
    try:
        payload = {"label": label, "pixels": [float(p) for p in pixels]}
    except (TypeError, ValueError):
        return {"success": False, "error": "Invalid pixel values"}
    headers = {"Authorization": "Bearer {}".format(STUDENT_ID), "Content-Type": "application/json"}
    try:
        response = requests.post("{}/frames".format(API_URL), headers=headers, json=payload, timeout=10)
    except Exception as e:
        return {"success": False, "error": str(e)}
    if response.status_code != 201:
        return {"success": False, "error": "API returned {}".format(response.status_code)}
    frame_count += 1
    if label == "empty":
        empty_count += 1
    else:
        present_count += 1
    columns = ["timestamp", "label"] + ["p{}".format(i) for i in range(64)]
    row = {"timestamp": datetime.utcnow().isoformat() + "Z", "label": label}
    for i, v in enumerate(payload["pixels"]):
        row["p{}".format(i)] = v
    file_exists = _csv_path.exists()
    with open(_csv_path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns)
        if not file_exists:
            w.writeheader()
        w.writerow(row)
    return {"success": True}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
