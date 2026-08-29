from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import requests
import asyncio
import json
import os
from pathlib import Path
from dotenv import load_dotenv

_env_dir = Path(__file__).resolve().parent.parent
load_dotenv(_env_dir / ".env")
load_dotenv()

SOPHOS_API_URL = "https://sophos.ece140.site"
STUDENT_ID = os.getenv("STUDENT_ID")

app = FastAPI(title="Dataset Explorer")
templates = Jinja2Templates(directory="explorer/templates")
app.mount("/static", StaticFiles(directory="explorer/static"), name="static")

connected_clients: list[WebSocket] = []


@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


def _sophos_get(path, params=None):
    if not STUDENT_ID or STUDENT_ID.strip() == "" or STUDENT_ID == "AXXXXXXXX":
        raise ValueError("Set STUDENT_ID in python/.env (see env.example)")
    headers = {"Authorization": "Bearer {}".format(STUDENT_ID.strip())}
    url = SOPHOS_API_URL.rstrip("/") + "/" + path.lstrip("/")
    r = requests.get(url, headers=headers, params=params, timeout=10)
    r.raise_for_status()
    return r.json()


def _normalize_stats(raw):
    if isinstance(raw, dict) and "error" in raw:
        return raw
    data = (raw.get("result") or raw.get("data") or raw) if isinstance(raw, dict) else raw
    if not isinstance(data, dict):
        return raw
    total = data.get("total_frames") or data.get("total") or 0
    by_label = data.get("by_label") or {}
    empty = by_label.get("empty") or data.get("empty_count") or data.get("empty") or 0
    present = by_label.get("present") or data.get("present_count") or data.get("present") or 0
    contributors = data.get("by_student") or data.get("contributors") or data.get("top_contributors") or raw.get("by_student") or []
    return {"total_frames": total, "empty_count": empty, "present_count": present, "contributors": contributors}


@app.get("/api/raw-stats")
async def get_raw_stats():
    try:
        return await asyncio.to_thread(_sophos_get, "/dataset/stats")
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/stats")
async def get_stats():
    # TODO: Fetch from Sophos /dataset/stats
    try:
        data = await asyncio.to_thread(_sophos_get, "/dataset/stats")
        return _normalize_stats(data)
    except Exception as e:
        return {"error": str(e)}


def _normalize_frame(f):
    if not isinstance(f, dict):
        return None
    pixels = f.get("pixels") or f.get("pixel_values")
    if not isinstance(pixels, list) or len(pixels) != 64:
        return None
    label = f.get("label") or f.get("label_type") or ""
    return {"label": label, "pixels": [float(x) for x in pixels]}


def _normalize_sample(raw):
    if isinstance(raw, list):
        out = []
        for f in raw:
            n = _normalize_frame(f) if isinstance(f, dict) else None
            if n is not None:
                out.append(n)
        return out
    if isinstance(raw, dict) and "error" in raw:
        return raw
    if isinstance(raw, dict):
        data = raw.get("result") or raw.get("frames") or raw.get("samples") or raw.get("data") or []
        if isinstance(data, list):
            return [_normalize_frame(f) for f in data if isinstance(f, dict) and _normalize_frame(f)]
        if isinstance(data, dict):
            out = data.get("frames") or data.get("samples") or []
            if isinstance(out, list):
                return [_normalize_frame(f) for f in out if isinstance(f, dict) and _normalize_frame(f)]
    return []


@app.get("/api/sample")
async def get_sample(label: str = None, n: int = 6):
    # TODO: Fetch from Sophos /dataset/sample
    try:
        params = {}
        if label is not None:
            params["label"] = label
        if n is not None:
            params["n"] = n
        data = await asyncio.to_thread(_sophos_get, "/dataset/sample", params=params or None)
        if isinstance(data, dict) and "error" in data:
            return data
        return _normalize_sample(data)
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/upload")
async def upload_frame(request: Request):
    # TODO: Forward frame to Sophos POST /frames with Bearer auth
    try:
        if not STUDENT_ID or STUDENT_ID.strip() == "" or STUDENT_ID == "AXXXXXXXX":
            return {"error": "Set STUDENT_ID in python/.env (see env.example)"}
        body = await request.json()
        headers = {"Authorization": "Bearer {}".format(STUDENT_ID.strip()), "Content-Type": "application/json"}
        url = SOPHOS_API_URL.rstrip("/") + "/frames"
        r = await asyncio.to_thread(
            lambda: requests.post(url, headers=headers, json=body, timeout=10)
        )
        if r.status_code in (200, 201):
            return r.json() if r.text else {"success": True}
        return {"error": "API returned {}".format(r.status_code)}
    except Exception as e:
        return {"error": str(e)}


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)

    try:
        while True:
            # TODO: Fetch stats and send to client
            try:
                raw = await asyncio.to_thread(_sophos_get, "/dataset/stats")
                stats = _normalize_stats(raw)
                msg = json.dumps(stats)
            except Exception as e:
                msg = json.dumps({"error": str(e)})
            for client in list(connected_clients):
                try:
                    await client.send_text(msg)
                except Exception:
                    pass
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
