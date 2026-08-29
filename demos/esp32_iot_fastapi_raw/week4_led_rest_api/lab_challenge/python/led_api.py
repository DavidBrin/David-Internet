# uv run led_api.py

from fastapi import FastAPI
import uvicorn
import paho.mqtt.client as mqtt
import os
from pydantic import BaseModel, Field
from enum import Enum
from dotenv import load_dotenv
from contextlib import asynccontextmanager

load_dotenv("../esp32/.env") # Load .env from the ESP32 folder, we are using the same .env file for both the ESP32 code and the python code.

MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_BROKER_PORT = 1883
MQTT_TOPIC = os.getenv("MQTT_TOPIC")


# Feel free to use this Pydantic model for request validation, it is not required, 
# however it is a good practice, and will help you in the future.

# Define valid LED colors as an enum for pydantic model validation
class LEDColor(str, Enum):
    red = "red"
    green = "green"
    blue = "blue"
    off = "off"
# Pydantic model for request validation
class LEDColorRequest(BaseModel):
    color: LEDColor = Field(..., description="LED color: red, green, blue, or off")


# TODO: Define the MQTT callbacks
def on_connect(client, userdata, flags, rc):
    print("Connected to MQTT broker")

def on_disconnect(client, userdata, rc):
    print("Disconnected from MQTT broker")

mqtt_client = mqtt.Client()
# TODO: Initialize MQTT mqtt callbacks
mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect

# We will use the lifespan context manager to connect to the MQTT broker and start the mqtt client loop (consider including some error handling)
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


#TODO: Add the endpoint for setting the LED color
# HINT: use a POST request with a JSON body containing the color
# To use the Pydantic model for request validation use the following syntax: 
# async def set_led_color(request: LEDColorRequest):
@app.post("/led")
async def set_led_color(request: LEDColorRequest):
    """Set the LED color via MQTT"""
    color = request.color.value
    if MQTT_BROKER:
        mqtt_client.publish(f"{MQTT_TOPIC}/led", color)
        return {"message": f"LED color set to {color}"}
    else:
        return {"error": "MQTT_BROKER not configured"}, 500

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "webserver is running",
        "service": "LED Controller",
        "mqtt_broker": MQTT_BROKER,
        "mqtt_topic": MQTT_TOPIC
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)