# Challenge 1: WiFi Network Scanner with FastAPI and MQTT

## Overview
This challenge involves creating a WiFi network scanner that uses an ESP32 to scan for nearby networks and a FastAPI web server to trigger scans and visualize results. The ESP32 and Python server communicate via MQTT.

## Architecture
- **ESP32**: Scans for WiFi networks and publishes results via MQTT
- **FastAPI Server**: Sends commands to ESP32 and receives scan data
- **MQTT Broker**: Facilitates communication between ESP32 and server

---

## ⚠️ IMPORTANT: Setup Before You Start Coding

**Before you write any code, you MUST complete these setup steps:**

1. **Create your `.env` file:**
   - Navigate to the `esp32/` folder
   - Copy `env.example` to create a new file named `.env`
   - **The `.env` file MUST remain in the `esp32/` folder (same location as `env.example`)**
   - **Do NOT put your credentials into `env.example` directly!**

2. **Fill out ALL credentials in your `.env` file:**
   - UCSD credentials
   - WiFi credentials if using non UCSD wifi (SSID and password)
   - **MQTT Topic** (use a unique identifier, e.g., `ece140a/yourname/netscanner`)
   - **MQTT Client ID** something unique (e.g., `esp32-yourname-001`)

3. **Double-check your MQTT fields:**
   - Make sure `MQTT_TOPIC` and `MQTT_CLIENT_ID` are all filled out
   - These are critical for ESP32 and Python server communication
   - Your Python server will read from this same `.env` file

4. **Only after completing the above**, proceed to the coding tasks below.

**Note:** The `.env` file is gitignored for security. Never commit credentials to git!

---

## ESP32 Tasks (`esp32/src/main.cpp`)

### Task 1: Implement WiFi Scan Helper Function
Create a function that performs a WiFi network scan and publishes the results to the MQTT broker.

**Requirements:**
- The function should scan for available WiFi networks (use `WiFi.scanNetworks()`)
- Collect information about the currently connected network (SSID and RSSI)
- Format the scan data as a JSON object following the Pydantic model structure (see below)
- Publish the JSON string to the `scan` topic
- The JSON must include:
  - `device_id`: Your ESP32 client ID
  - `connected_ssid`: The SSID you're currently connected to
  - `connected_rssi`: The RSSI of your current connection
  - `networks`: An array of detected networks, each with `ssid` and `rssi`

### Task 2: Implement MQTT Callback Function
Create a callback function that listens for commands from the Python server.

**Requirements:**
- Listen for messages on the `command` topic
- When a command is received (e.g., "scan"), call your helper function to execute a WiFi scan
- The scan results should be published to the `scan` topic

### Task 3: Setup Function Configuration
In the `setup()` function, you need to:
- **Connect to MQTT broker**: Use `mqtt.connect()` with appropriate parameters
- **Set up the callback function**: Use `mqtt.setCallback()` to register your callback
- **Subscribe to the "command" topic**: Use `mqtt.subscribe()` to listen for commands

---

## Python Server Tasks (`python/wifiscrape_webserver.py`)

### Task 1: Environment Variables
Fill out the environment variables from the `.env` file inside the `esp32` folder. This ensures consistency between ESP32 and Python code.

**Important:** The Python server reads from `../esp32/.env` (the `.env` file located in the `esp32/` folder). Both the ESP32 and Python server share the same `.env` file to ensure they use the same MQTT topics and credentials.

**Variables to configure:**
- `MQTT_BROKER`: MQTT broker address
- `MQTT_TOPIC`: Base topic for your device

### Task 2: Implement `on_connect` Function
Create the MQTT connection callback function. Feel free to reuse this from previous assignments.

**Requirements:**
- Subscribe to the `MQTT_SCAN_TOPIC` when connected
- Print a confirmation message
- Handle connection errors appropriately

### Task 3: Implement `/get_netscan` Endpoint
This endpoint triggers a WiFi network scan and returns the results.

**Requirements:**
- Send a command message to `MQTT_COMMAND_TOPIC` to trigger a scan on the ESP32
- Wait for and return the latest scan result from the `scan_result` global variable
- Consider that `scan_result` is `None` before the first scan completes
- Return `JSONResponse` with appropriate HTTP status codes:
  - `200 OK` with JSON data if scan result is available
  - `204 No Content` if no scan data is available yet
- Optional: Use `previous_scan_result` to track whether the data is fresh

### Task 4: Implement `/netmap_graph` Endpoint
This endpoint provides a graphical visualization of WiFi networks.

**Requirements:**
- Trigger a new WiFi scan on the ESP32
- The rest of the code we give to you below!
  - **You can copy and paste this into your endpoint function!**

#### How to implement the image `StreamingResponse`:
```python
    # Assuming you just sent the MQTT message to request a new scan.
    # You can copy and paste this into your endpoint function!
    if scan_result:
        fresh_scan = previous_scan_result != scan_result
        previous_scan_result = scan_result
        try:
            fig = generate_netmap_plot(json.loads(scan_result))
            buf = io.BytesIO()
            fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
            buf.seek(0)
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to generate network map plot: {str(e)}"}
            )
        return StreamingResponse(
            status_code=200,
            content=buf, 
            media_type="image/png",
            headers={"New-Message": f"{fresh_scan}"}
        )
    else:
        return JSONResponse(
            status_code=504,
            content={"error": "Waiting for ESP32 response", "message": "ESP32 has not responded yet! Please wait a moment and try again."}
        )
```


---

## Data Format: Pydantic Model

Please make sure that the MQTT message you send from your ESP32 is formatted exactly like this! You **will** get an error otherwise. To debug, use `Serial.println()` statements in your ESP32 code.

**Note:** Whitespace does not matter in JSON.

### Sample format (readable):
```json
{
  "device_id": "esp32-001",
  "connected_ssid": "__SSID__",
  "connected_rssi": -42,
  "networks": [
    {
      "ssid": "SSID",
      "rssi": -42
    },
    {
      "ssid": "eduroam",
      "rssi": -54
    },
    {
      "ssid": "UCSD-PROTECTED",
      "rssi": -54
    },
    {
      "ssid": "UCSD-GUEST",
      "rssi": -55
    }
  ]
}
```

### Condensed format:
```json
{"device_id":"esp32-001","timestamp":271831,"connected_ssid":"Alexey","connected_rssi":-42,"networks":[{"ssid":"Alexey","rssi":-42},{"ssid":"eduroam","rssi":-54},{"ssid":"UCSD-PROTECTED","rssi":-54},{"ssid":"UCSD-GUEST","rssi":-55}]}
```

Both formats work perfectly!

---

## Testing

1. Start your MQTT broker
2. Upload the ESP32 code and monitor serial output
3. Run the FastAPI server:
   ```bash
   cd challenge1_fastapi_netmap/python/
   uv run wifiscrape_webserver.py
   ```
4. Open your browser and navigate to [localhost:8000/docs](http://localhost:8000/docs) to interact with the API
5. Test endpoints through the interactive documentation or directly:
   - Health check: `GET localhost:8000/`
   - Trigger scan: `POST localhost:8000/get_netscan`
   - Get visualization: `GET localhost:8000/netmap_graph` (bonus)

---

## Tips

- Use `Serial.println()` liberally for debugging
- Test JSON formatting before sending via MQTT
- Remember that MQTT callbacks are asynchronous - data won't be available immediately
- The `global` keyword is required to modify global variables in Python functions
- Check that your `.env` file has all required variables configured