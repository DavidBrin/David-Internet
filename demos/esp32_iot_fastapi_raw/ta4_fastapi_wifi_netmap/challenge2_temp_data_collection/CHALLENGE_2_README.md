# Challenge 2: Thermal Camera Data Collection with AMG8833

## Overview
This challenge involves creating a thermal imaging system using an AMG8833 8x8 thermal camera sensor connected to an ESP32. A FastAPI web server triggers readings and provides various endpoints to access and visualize the thermal data via MQTT communication.

## Architecture
- **ESP32 + AMG8833**: Reads thermal data from the 8x8 pixel sensor and publishes via MQTT
- **FastAPI Server**: Sends commands to ESP32 and receives thermal data
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
   - Make sure `MQTT_TOPIC` and `MQTT_CLIENT_ID` are all filled out
   - These are critical for ESP32 and Python server communication
   - Your Python server will read from this same `.env` file

3. **Only after completing the above**, proceed to the coding tasks below.

**Note:** The `.env` file is gitignored for security. Never commit credentials to git!

---

## ESP32 Tasks (`esp32/src/main.cpp`)

### Task 1: Implement Thermal Data Publishing Helper Function
Create a helper function named `sendThermalData()` to publish temperature data to the MQTT broker.

**Requirements:**
- Function should return `void` and take no arguments
- Read temperature data from the AMG8833 sensor using `amg.readPixels(pixels)`
- Publish data to the `thermal_data` topic
- Format the data as JSON with the following structure:
  ```json
  {
    "client_id": "YOUR_CLIENT_ID",
    "pixels": [float, float, float, ...]
  }
  ```
- The `pixels` array should contain 64 float values (8x8 grid) representing temperatures in Celsius
- Use the global `pixels` array that's already declared for you

### Task 2: Implement MQTT Callback Function
Create a callback function to handle incoming MQTT messages from the server.

**Requirements:**
- Function signature should be: `void mqttCallback(char* topic, uint8_t* payload, unsigned int length)`
- Parse the incoming message from the `payload` parameter
- Convert the payload bytes to a String for easier processing
- Listen for the "read" command
- When "read" is received, call your `sendThermalData()` helper function
- Handle unknown commands gracefully (optional: publish an error message)
- Use `Serial.println()` to log received messages for debugging

**Example structure:**
```cpp
void mqttCallback(char* topic, uint8_t* payload, unsigned int length) {
    // 1. Convert payload to String
    // 2. Print received message to Serial
    // 3. Check if message contains "read" or whatever you decide to use to trigger the ESP to send thermal data
    // 4. If yes, call sendThermalData()
    // 5. If no, handle unknown command
}
```

### Task 3: Setup Function Configuration
In the `setup()` function, you need to:
- **Connect to MQTT broker**: Establish connection with appropriate parameters
- **Subscribe to your topic**: Listen for commands on the `command` topic
- **Set up the callback function**: Register your callback function to handle incoming messages

---

## Python Server Tasks (`python/temperature_websersver.py`)

### Task 1: Environment Variables
Fill out the environment variables from the `.env` file inside the `esp32` folder. This ensures consistency between ESP32 and Python code.

**Important:** The Python server reads from `../esp32/.env` (the `.env` file located in the `esp32/` folder). Both the ESP32 and Python server share the same `.env` file to ensure they use the same MQTT topics and credentials.

**Variables to configure:**
- `MQTT_BROKER`: MQTT broker address
- `MQTT_TOPIC`: Base topic for your device

### Task 2: Implement `on_connect` Function
Same as Challenge 1 - create the MQTT connection callback function.

**Requirements:**
- Subscribe to the `MQTT_MESSAGE_TOPIC` when connected
- Print a confirmation message
- Handle connection errors appropriately

### Task 3: Implement `/read` Endpoint (POST)
Request a single thermal reading from the ESP32.

**Requirements:**
- Send a "read" command to `MQTT_COMMAND_TOPIC` to trigger a reading
- Wait for the ESP32 to respond with thermal data
- Return a `JSONResponse` object with the thermal data
- The data is already validated against the Pydantic model in the `on_message` callback
- Check if `thermal_data` is `None` - if so, return a `204 No Content` response
- If data exists, return `200 OK` with the thermal data JSON

### Task 4: Implement `/pixel` Endpoint (GET)
Get a specific pixel temperature value from the latest reading.

**Requirements:**
- Accept a query parameter `index` (0-63) representing a pixel in the 8x8 array
- Validate that the index is within the valid range (0-63)
- Check if `thermal_data` is not `None`
- Check if `thermal_data` contains the `pixels` array
- Return the temperature value for the specified pixel
- Return appropriate error responses:
  - `400 Bad Request` for invalid index
  - `204 No Content` if no thermal data available
- Return format: `{"index": N, "temperature": float_value}`

### Task 5 (BONUS): Implement `/thermal_graph` Endpoint
Get a thermal heatmap visualization with fresh thermal data.

**Requirements:**
- Trigger a new reading from the ESP32 by sending "read" command
- Wait for fresh `thermal_data`
- Parse `thermal_data` if needed
- Generate a thermal visualization plot with the pixel data
- Return the plot as a PNG image
- Set appropriate content type: `image/png`
- Handle cases where no data is available
- Return a `StreamingResponse` object with the image

---

## Data Format

The thermal data should be published from the ESP32 in the following JSON format:

```json
{
  "client_id": "esp32-thermal-001",
  "pixels": [
    23.5, 23.7, 24.1, 24.3, 24.0, 23.9, 23.8, 23.6,
    23.8, 24.2, 24.5, 24.8, 24.6, 24.3, 24.0, 23.7,
    24.1, 24.6, 25.0, 25.5, 25.2, 24.8, 24.4, 24.0,
    24.3, 25.1, 25.8, 26.5, 26.2, 25.6, 24.9, 24.2,
    24.2, 25.0, 25.7, 26.3, 26.0, 25.4, 24.7, 24.1,
    24.0, 24.5, 25.1, 25.6, 25.3, 24.9, 24.4, 23.9,
    23.7, 24.1, 24.5, 24.9, 24.6, 24.3, 24.0, 23.6,
    23.5, 23.8, 24.0, 24.2, 24.0, 23.8, 23.7, 23.5
  ]
}
```

**Notes:**
- The `pixels` array contains exactly 64 values (8x8 grid)
- Values represent temperatures in degrees Celsius
- Pixels are ordered row by row (indices 0-7 = row 1, 8-15 = row 2, etc.)

---

## Testing

1. **Hardware Setup:**
   - Connect AMG8833 sensor to ESP32 via I2C (SDA/SCL pins)
   - Ensure proper power connections

2. **Software Setup:**
   - Start your MQTT broker
   - Upload the ESP32 code and monitor serial output
   - Run the FastAPI server:
     ```bash
     cd challenge2_temp_data_collection/python/
     uv run temperature_webserver.py
     ```

3. **Test Endpoints:**
   - Open your browser and navigate to [localhost:8000/docs](http://localhost:8000/docs) to interact with the API
   - Test endpoints through the interactive documentation or directly:
     - Health check: `GET localhost:8000/`
     - Single reading: `POST localhost:8000/read`
     - Specific pixel: `GET localhost:8000/pixel?index=32`
     - Thermal graph: `GET localhost:8000/thermal_graph` (bonus)

---

## Tips

- Use `Serial.println()` to debug JSON formatting before publishing
- The AMG8833 sensor takes a moment to initialize - wait for "AMG8833 and MQTT ready!" message
- Remember to use the `global` keyword in Python when accessing global variables
- Test with your hand in front of the sensor to see temperature changes
- Pixel indices: top-left is 0, top-right is 7, bottom-left is 56, bottom-right is 63
- The thermal graph visualization helps verify that your data is being transmitted correctly


