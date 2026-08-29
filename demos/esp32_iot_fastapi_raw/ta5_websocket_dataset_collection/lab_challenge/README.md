# Lab Challenge: Thermal Frame Labeler

## Description

Build a web-based labeling interface that receives thermal frames from your ESP32 via MQTT and uploads labeled frames to the Sophos API.

## Video Checkoff

**Show the TA during lab:**
1. Your web labeler receiving live thermal data from the sensor
2. The heatmap updating in real-time
3. Labeling frames as "empty" and "present"
4. Successful upload confirmations

Record a short video if you can't show the TA live.

## Setup

```bash
cd python
cp env.example .env
# Edit .env with your student ID and MQTT topic
uv run server.py
```

Open http://localhost:8000 in your browser.

Make sure your ESP32 is running and publishing thermal data to MQTT.

## Requirements

1. **MQTT Connection** - Subscribe to thermal data from your ESP32
2. **WebSocket Broadcast** - Push frames to connected browsers
3. **Heatmap Display** - Canvas-based 8x8 thermal visualization
4. **Labeling Buttons** - Click or use keyboard (0/1) to label frames
5. **API Upload** - POST labeled frames to Sophos API

## Starter Code

The `server.py` file has TODOs for you to complete in the `/api/label` endpoint:
1. Build the payload with `label` and `pixels`
2. POST to the Sophos API with Bearer token
3. Update counters on success
4. Return success/error response

## Frame Payload

Your POST to `/frames` needs:
```json
{
  "label": "empty",
  "pixels": [64 float values]
}
```

- `label`: Either `"empty"` or `"present"`
- `pixels`: Array of exactly 64 float values from the AMG8833

## Tips

- Test the API with Tutorial 2 first
- Use keyboard shortcuts (0 and 1) for faster labeling
- You need 5 empty + 5 present frames (10 total) for the lab checkoff
