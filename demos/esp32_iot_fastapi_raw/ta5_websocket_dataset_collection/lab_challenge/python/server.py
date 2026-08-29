from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import uvicorn
import asyncio
import json
import os
import paho.mqtt.client as mqtt
import requests
from dotenv import load_dotenv

load_dotenv()

STUDENT_ID = os.getenv("STUDENT_ID")
MQTT_TOPIC = os.getenv("MQTT_TOPIC")
MQTT_BROKER = "broker.emqx.io"
API_URL = "https://sophos.ece140.site"

clients: list[WebSocket] = []
current_frame = None
frame_count = 0
empty_count = 0
present_count = 0


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
                "stats": {"total": frame_count, "empty": empty_count, "present": present_count}
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


@app.post("/api/label")
async def label_frame(request: Request):
    global frame_count, empty_count, present_count

    data = await request.json()
    # TODO: Build the payload with "label" and "pixels"
    label = data.get("label")
    pixels = data.get("pixels")

    # Basic validation to ensure correct payload
    if label not in ("empty", "present") or not isinstance(pixels, list) or len(pixels) != 64:
        return {"success": False, "error": "Invalid payload"}

    payload = {
        "label": label,
        "pixels": pixels,
    }

    # TODO: POST to API_URL/frames with Bearer token authorization
    headers = {
        "Authorization": f"Bearer {STUDENT_ID}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(f"{API_URL}/frames", json=payload, headers=headers, timeout=5)
        resp.raise_for_status()
    except Exception as e:
        return {"success": False, "error": str(e)}

    # TODO: Update counters on success
    frame_count += 1
    if label == "empty":
        empty_count += 1
    elif label == "present":
        present_count += 1

    # TODO: Return {"success": True/False}
    return {"success": True}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
