# Tutorial 1: WebSocket Basics

Learn bidirectional real-time communication with WebSockets.

## Setup

```bash
cd python
uv run server.py
```

Then open http://localhost:8000 in your browser.

## What This Demonstrates

- WebSocket connection from browser to server
- Bidirectional messaging (send and receive)
- Broadcasting to multiple clients
- Connection status handling

## How It Works

1. Browser connects to WebSocket at `/ws`
2. Server accepts connection and adds client to list
3. Messages sent from browser are echoed back
4. Server broadcasts a counter to all connected clients every second

## Try It

1. Open the page in multiple browser tabs
2. Send messages from each tab
3. Watch the shared counter update in all tabs simultaneously

## Next Steps

Proceed to **Tutorial 2** to learn how to interact with the Sophos API.
