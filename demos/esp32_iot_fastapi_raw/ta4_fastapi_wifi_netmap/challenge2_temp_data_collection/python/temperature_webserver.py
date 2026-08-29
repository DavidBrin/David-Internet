import os
import io
import json
import uvicorn
from fastapi import FastAPI
from dotenv import load_dotenv
import paho.mqtt.client as mqtt
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field, ValidationError
from fastapi.responses import JSONResponse, StreamingResponse

from visualize_temp import generate_temp_plot

load_dotenv("../esp32/.env")

# TODO: Fill out the environment variables from the .env file
MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_BROKER_PORT = 1883
MQTT_TOPIC = os.getenv("MQTT_TOPIC")
MQTT_COMMAND_TOPIC = f"{MQTT_TOPIC}/command" # Remember, we need to subscribe to this topic on the ESP32 side!
MQTT_MESSAGE_TOPIC = f"{MQTT_TOPIC}/thermal_data" # Remember, we need to publish to this topic on the ESP32 side!



###################################################################################
########   DO NOT CHANGE THE CODE BETWEEN THESE LINES #############################
###################################################################################
# Pydantic validation models
# The thermal data is a list of 64 pixel values
class ThermalImage(BaseModel):
    """Model for complete thermal image from ESP32"""
    device_id: str = Field(..., description="ESP32 device identifier")
    pixels: list[float] = Field(..., description="List of 64 pixel values")

###################################################################################
########   DO NOT CHANGE THE CODE BETWEEN THESE LINES #############################
###################################################################################


# Global variables for storing thermal data and synchronization
# Reference challenge 1 if you are confused about the global variables.
global thermal_data
thermal_data = None

global latest_thermal_data
latest_thermal_data = None


def on_connect(client, userdata, flags, rc):
    """Callback when MQTT client connects to broker"""
    if rc == 0:
        print(f"[MQTT] Connected successfully to broker")
        # Subscribe to thermal_data topic to receive thermal readings
        client.subscribe(MQTT_MESSAGE_TOPIC)
        print(f"[MQTT] Subscribed to topic: {MQTT_MESSAGE_TOPIC}")
    else:
        print(f"[MQTT] Connection failed with code {rc}")


def on_message(client, userdata, msg):
    global thermal_data
    data = msg.payload.decode()
    print(f"[Received MQTT message] {data}")
    
    try:
        # Parse JSON data
        json_data = json.loads(data)
        
        # Validate against Pydantic model
        validated_data = ThermalImage(**json_data)
        
        # Store validated data as JSON string
        thermal_data = validated_data.model_dump_json()
        print(f"[Validation Success] Data validated and stored in `thermal_data` global variable")
        
    except json.JSONDecodeError as e:
        print(f"[Validation Error] Invalid JSON format: {e}")
    except ValidationError as e:
        print(f"[Validation Error] Data does not match required format:")
        print(e)

# Initialize MQTT client
mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_connect # <- Don't forget to implement the on_connect function!
mqtt_client.on_message = on_message


@asynccontextmanager
async def lifespan(app: FastAPI):
    if MQTT_BROKER:
        mqtt_client.connect(MQTT_BROKER, MQTT_BROKER_PORT, 60)
        mqtt_client.loop_start()
        print(f"MQTT client started, connecting to {MQTT_BROKER}")
    else:
        print("Warning: MQTT_BROKER not configured")

    yield 
    
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

app = FastAPI(lifespan=lifespan)



@app.post("/read")
def get_single_reading():
    """
    Request a single thermal reading from the ESP32.
    
    Sends "read" command via MQTT and waits for the ESP32 to respond
    with thermal data in JSON format.
    """
    global thermal_data
    
    # Clear current result to wait for new reading
    thermal_data = None
    
    # Send "read" command to ESP32
    if MQTT_BROKER:
        mqtt_client.publish(MQTT_COMMAND_TOPIC, "read")
        print(f"[MQTT] Sent read command to {MQTT_COMMAND_TOPIC}")
        
        # Wait a bit for the reading to complete and result to arrive
        import time
        for _ in range(10):  # Wait up to 2 seconds (10 * 0.2s)
            time.sleep(0.2)
            if thermal_data is not None:
                break
        
        if thermal_data is not None:
            return JSONResponse(
                status_code=200,
                content=json.loads(thermal_data)
            )
        else:
            return JSONResponse(
                status_code=204,
                content={"error": "No thermal data received"}
            )
    else:
        return JSONResponse(
            status_code=500,
            content={"error": "MQTT broker not configured"}
        )

@app.get("/pixel")
def get_pixel_value(index: int):
    """
    Get a specific pixel temperature value from a fresh reading.
    
    Query parameter:
    - index (0-63): Pixel index in the 8x8 thermal array
    
    """
    global thermal_data
    
    # Validate index range
    if index < 0 or index > 63:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid index. Must be between 0 and 63"}
        )
    
    # Check if thermal data exists
    if thermal_data is None:
        return JSONResponse(
            status_code=204,
            content={"error": "No thermal data available"}
        )
    
    # Parse thermal data
    try:
        data = json.loads(thermal_data)
        pixels = data.get("pixels", [])
        
        if not pixels or len(pixels) != 64:
            return JSONResponse(
                status_code=204,
                content={"error": "Invalid thermal data format"}
            )
        
        temperature = pixels[index]
        return JSONResponse(
            status_code=200,
            content={"index": index, "temperature": temperature}
        )
    except json.JSONDecodeError:
        return JSONResponse(
            status_code=204,
            content={"error": "Failed to parse thermal data"}
        )

@app.get("/thermal_graph")
def get_thermal_graph():
    """
    Get a thermal heatmap visualization with fresh thermal data.
    
    Triggers a new reading from the ESP32 and returns a PNG image 
    showing the 8x8 thermal grid as a heatmap.
    Refer to README.md for more details. 
    Use generate_temp_plot from visualize_temp.py to generate the thermal graph.
    Remember to return the StreamingResponse object.
    Remember to use the global variable `thermal_data` to generate the thermal graph.
    The data should is already validated correctly against the Pydantic model.
    """
    global thermal_data
    
    # Clear current result to wait for new reading
    thermal_data = None
    
    # Send "read" command to ESP32
    if MQTT_BROKER:
        mqtt_client.publish(MQTT_COMMAND_TOPIC, "read")
        print(f"[MQTT] Sent read command to {MQTT_COMMAND_TOPIC}")
        
        # Wait a bit for the reading to complete and result to arrive
        import time
        for _ in range(10):  # Wait up to 2 seconds (10 * 0.2s)
            time.sleep(0.2)
            if thermal_data is not None:
                break
        
        if thermal_data is None:
            return JSONResponse(
                status_code=204,
                content={"error": "No thermal data received"}
            )
    else:
        return JSONResponse(
            status_code=500,
            content={"error": "MQTT broker not configured"}
        )
    
    # Generate visualization
    try:
        data = json.loads(thermal_data)
        # Add timestamp for visualization
        import datetime
        data["timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        fig = generate_temp_plot(data)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        buf.seek(0)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to generate thermal plot: {str(e)}"}
        )
    
    return StreamingResponse(
        status_code=200,
        content=buf,
        media_type="image/png"
    )

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "status": "webserver is running",
        "service": "AMG8833 Thermal Camera Server",
        "mqtt_broker": MQTT_BROKER,
        "mqtt_topic": MQTT_TOPIC,
        "endpoints": {
            "POST /read": "Get a single thermal reading (64 pixels)",
            "GET /pixel?index=N": "Get specific pixel temperature by index (0-63)",
            "GET /thermal_graph": "Get thermal heatmap image (PNG)",
        }
    }

if __name__ == "__main__":
    uvicorn.run("temperature_webserver:app", host="127.0.0.1", port=8000, reload=True)