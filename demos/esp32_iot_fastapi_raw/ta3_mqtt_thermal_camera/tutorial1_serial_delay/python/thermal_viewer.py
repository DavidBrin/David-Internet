import serial
import serial.tools.list_ports
import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation

def find_esp32_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "usb" in port.description.lower() or "ESP32" in port.description or "Feather" in port.description:
            return port.device
    return None

port = find_esp32_port()
if not port:
    print("No ESP32 found. Available ports:")
    for p in serial.tools.list_ports.comports():
        print(f"  {p.device} - {p.description}")
    exit(1)

print(f"Connecting to {port}...")
ser = serial.Serial(port, 115200, timeout=1)

# Initialize the heatmap data
thermal_data = np.zeros((8, 8))
thermistor_temp = 0.0

fig, ax = plt.subplots()
im = ax.imshow(thermal_data, cmap='inferno', vmin=15, vmax=40)
cbar = plt.colorbar(im, ax=ax, label='Temperature (C)')
ax.set_title('AMG8833 Thermal Camera')

def animate(frame):
    global thermal_data, thermistor_temp

    if ser.in_waiting > 0:
        try:
            line = ser.readline().decode('utf-8').strip()
            if line and line.startswith('{'):
                data = json.loads(line)

                if 'pixels' in data:
                    # Reshape 64 pixels into 8x8 array and rotate 90° clockwise
                    # to match physical sensor orientation
                    raw_data = np.array(data['pixels']).reshape(8, 8)
                    thermal_data = np.rot90(raw_data, k=-1)  # 90° clockwise
                    thermistor_temp = data.get('thermistor', 0)

                    # Update the heatmap
                    im.set_array(thermal_data)

                    # Auto-adjust color scale based on data
                    vmin = thermal_data.min() - 2
                    vmax = thermal_data.max() + 2
                    im.set_clim(vmin, vmax)

                    ax.set_title(f'AMG8833 Thermal Camera | Ambient: {thermistor_temp:.1f}C | Max: {thermal_data.max():.1f}C')

        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            pass

    return [im]

ani = animation.FuncAnimation(fig, animate, interval=100, blit=True)
plt.tight_layout()
plt.show()

ser.close()
