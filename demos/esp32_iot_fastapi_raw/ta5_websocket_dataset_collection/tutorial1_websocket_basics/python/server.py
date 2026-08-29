from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import json

clients: list[WebSocket] = []
counter = 0


async def broadcast_counter():
    global counter
    while True:
        counter += 1
        message = json.dumps({"type": "counter", "value": counter})
        for client in clients:
            try:
                await client.send_text(message)
            except Exception:
                pass
        await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app):
    asyncio.create_task(broadcast_counter())
    yield


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
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        clients.remove(websocket)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
