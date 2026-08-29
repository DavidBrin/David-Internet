# Challenge 1: MQTT Thermal Camera

ESP32 sends thermal data over MQTT every second, Python shows a live heatmap. Pretty straightforward.

## Setup

### ESP32
1. Copy `esp32/env.example` to `esp32/.env` and fill in your WiFi stuff
2. Set your `CLIENT_ID` and `TOPIC_PREFIX` in `main.cpp` (make sure it's unique)
3. Upload with PlatformIO

### Python
```bash
cd python
uv run thermal_viewer.py
```


## What it does

- ESP32 reads all 64 pixels from the AMG8833 sensor
- Publishes JSON data every 1 second 
- Python subscribes and shows a real-time heatmap
- Saves data to `thermal_data.csv` with timestamp, thermistor temp, max, and min

The JSON looks like:
```json
{"thermistor": 25.5, "pixels": [24.5, 25.0, 25.5, ...]}
```

## Dependencies

Check `python/pyproject.toml` for Python packages. You'll need paho-mqtt, matplotlib, numpy, etc.

## Video

https://youtube.com/shorts/O7m7zfh6ReQ?feature=share 
