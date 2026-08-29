Read below for instructions on how to run and validate the code.


[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/6m4jcJqk)
# Tech Assignment 4 - ESP32 with FastAPI and MQTT

This tech assignment has two challenges that combine ESP32 embedded programming with Python web servers.

## Project Structure

- `challenge1_fastapi_netmap/` - WiFi network scanning
- `challenge2_temp_data_collection/` - Temperature data collection

```
 .
├── challenge1_fastapi_netmap
│   ├── CHALLENGE_1_README.md
│   ├── esp32
│   │   ├── env.example
│   │   ├── include
│   │   │   ├── ECE140_MQTT.h
│   │   │   └── ECE140_WIFI.h
│   │   ├── platformio.ini
│   │   ├── pre_extra_script.py
│   │   └── src
│   │       ├── ECE140_MQTT.cpp
│   │       ├── ECE140_WIFI.cpp
│   │       └── main.cpp
│   └── python
│       ├── pyproject.toml
│       ├── uv.lock
│       ├── visualize.py
│       └── wifiscrape_webserver.py
├── challenge2_temp_data_collection
│   ├── CHALLENGE_2_README.md
│   ├── esp32
│   │   ├── env.example
│   │   ├── include
│   │   │   ├── ECE140_MQTT.h
│   │   │   └── ECE140_WIFI.h
│   │   ├── platformio.ini
│   │   ├── pre_extra_script.py
│   │   └──  src
│   │       ├── ECE140_MQTT.cpp
│   │       ├── ECE140_WIFI.cpp
│   │       └── main.cpp
│   └── python
│       ├── pyproject.toml
│       ├── temperature_webserver.py
│       ├── uv.lock
│       └── visualize_temp.py
└── README.md
```

Each challenge contains:
- `esp32/` - PlatformIO project for ESP32
- `python/` - FastAPI web server and visualization code

**Detailed instructions for each challenge can be found in:**
- `challenge1_fastapi_netmap/CHALLENGE_1_README.md` - WiFi network scanner instructions
- `challenge2_temp_data_collection/CHALLENGE_2_README.md` - Thermal camera instructions

## Setup Instructions

### ESP32 Configuration

1. Copy `esp32/env.example` to `esp32/.env`
2. Fill in your WiFi credentials and MQTT broker details
3. Build and upload to your ESP32 using PlatformIO

### Python Web Server

1. Navigate to the `python/` directory
2. Run the server: `uv run <server_file>.py` (without the `<>`)

## Important Notes

### Data Validation

**The web servers enforce strict data validation.** Your ESP32 must send data in the exact format expected by the server. Check the Pydantic models in the Python code (marked with "DO NOT CHANGE") to understand the required structure.

If you encounter validation errors:
- Use `Serial.println()` in your ESP32 code to debug the data before sending
- Verify field names match exactly (case-sensitive)
- Ensure data types are correct (strings, integers, arrays, etc.)

### Visualization Endpoints

**The visualization endpoints are optional for this assignment.** You only need to implement the core MQTT communication and data collection endpoints. Implementing the visualization features is extra credit.

### Server Behavior

- The Python web server **automatically restarts** when you modify Python files
- Changes to the `.env` file **require manual server restart** (Ctrl+C, then restart)

## Workflow

1. Make a copy of `env.example` named `.env` **keep it in the same directory** and completely fill out your `.env` file.
2. Implement your ESP32 code in `esp32/src/main.cpp`
3. Implement the Python web server endpoints in the respective Python files
4. Test by uploading to ESP32 and accessing the web interface
5. Use Serial Monitor and `Serial.println()` for debugging MQTT messages and data format issues
