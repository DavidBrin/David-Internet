import paho.mqtt.client as mqtt
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
import json
import csv
from datetime import datetime

MQTT_BROKER = "broker.emqx.io"
MQTT_TOPIC = "ece140a/thermal"  # match TOPIC_PREFIX + "/thermal"
CSV_FILE = "thermal_data.csv"

# Initialize thermal data storage
thermal_data = np.zeros((8, 8))
thermistor_temp = 0.0

fig, ax = plt.subplots()
im = ax.imshow(thermal_data, cmap='inferno', vmin=15, vmax=40)
cbar = plt.colorbar(im, ax=ax, label='Temperature (C)')
ax.set_title('AMG8833 Thermal Camera (MQTT)')

# Initialize CSV file
with open(CSV_FILE, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["timestamp", "thermistor", "max_temp", "min_temp"])

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker with result code {rc}")
    client.subscribe(f"{MQTT_TOPIC}/thermal")
    print(f"Subscribed to topic: {MQTT_TOPIC}")

def on_message(client, userdata, msg):
    global thermal_data, thermistor_temp
    data = json.loads(msg.payload.decode())
    thermistor_temp = data["thermistor"]
    thermal_data = np.array(data["pixels"]).reshape(8, 8)
    max_t = thermal_data.max()
    min_t = thermal_data.min()
    print(f"thermistor: {thermistor_temp:.1f}C  max: {max_t:.1f}C  min: {min_t:.1f}C")
    with open(CSV_FILE, "a", newline="") as f:
        csv.writer(f).writerow([datetime.now().isoformat(), thermistor_temp, max_t, min_t])

def animate(frame):
    global thermal_data, thermistor_temp

    if thermal_data.max() > 0:
        im.set_array(thermal_data)

        # Auto-adjust color scale
        vmin = thermal_data.min() - 2
        vmax = thermal_data.max() + 2
        im.set_clim(vmin, vmax)

        ax.set_title(f'AMG8833 Thermal Camera | Ambient: {thermistor_temp:.1f}C | Max: {thermal_data.max():.1f}C | Min: {thermal_data.min():.1f}C')

    return [im]

# Setup MQTT client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(MQTT_BROKER, 1883, 60)
client.loop_start()

# Run animation
ani = animation.FuncAnimation(fig, animate, interval=100, blit=True)
plt.tight_layout()
plt.show()

client.loop_stop()
