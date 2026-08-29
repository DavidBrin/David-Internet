import paho.mqtt.client as mqtt
import requests
import json
import os
import sys
import csv
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
MQTT_TOPIC = os.getenv("MQTT_TOPIC")
API_BASE_URL = "https://sophos.ece140.site"
STUDENT_ID = os.getenv("STUDENT_ID")
_script_dir = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(_script_dir, "my_collection.csv")

current_frame = None
frame_count = 0
empty_count = 0
present_count = 0

TARGET_EMPTY = 50
TARGET_PRESENT = 50


def validate_frame(pixels, label):
    # TODO: Check that we have exactly 64 pixels
    # TODO: Check all temperatures are in valid range (0-80°C)
    # TODO: Check for sensor errors (all pixels identical = likely error)
    # TODO: Warn about potentially mislabeled frames
    if len(pixels) != 64:
        return (False, "Expected 64 pixels, got {}".format(len(pixels)))
    for i, p in enumerate(pixels):
        try:
            t = float(p)
        except (TypeError, ValueError):
            return (False, "Invalid pixel value at index {}".format(i))
        if t < 0 or t > 80:
            return (False, "Temperature {} out of range (0-80°C) at index {}".format(t, i))
    if all(float(p) == float(pixels[0]) for p in pixels):
        return (False, "Sensor error: all pixels identical")
    max_t = max(pixels)
    if label == "present" and max_t < 26:
        print("Warning: 'present' frame has max_temp {:.1f}°C < 26°C (possibly mislabeled)".format(max_t))
    return (True, None)


def upload_frame_with_retry(pixels, label, max_retries=3):
    global frame_count, empty_count, present_count

    is_valid, error = validate_frame(pixels, label)
    if not is_valid:
        print(f"Validation failed: {error}")
        return False

    frame_data = {"label": label, "pixels": pixels}
    headers = {"Authorization": f"Bearer {STUDENT_ID}", "Content-Type": "application/json"}

    # TODO: Implement retry with exponential backoff
    delay = 1.0
    for attempt in range(max_retries):
        try:
            response = requests.post(f"{API_BASE_URL}/frames", headers=headers, json=frame_data, timeout=10)
            if response.status_code == 201:
                frame_count += 1
                if label == "empty":
                    empty_count += 1
                else:
                    present_count += 1
                save_to_csv(frame_data)
                print(f"Uploaded #{frame_count} as '{label}' (empty: {empty_count}/{TARGET_EMPTY}, present: {present_count}/{TARGET_PRESENT})")
                return True
            else:
                print(f"Upload failed: {response.status_code}")
        except Exception as e:
            print(f"Error: {e}")
        if attempt < max_retries - 1:
            print("Retrying in {:.1f}s...".format(delay))
            time.sleep(delay)
            delay *= 2
    return False


def save_to_csv(frame_data):
    # TODO: Implement CSV backup
    file_exists = os.path.exists(CSV_FILE)
    with open(CSV_FILE, 'a', newline='') as f:
        columns = ['timestamp', 'label'] + ['p{}'.format(i) for i in range(64)]
        writer = csv.DictWriter(f, fieldnames=columns)
        if not file_exists:
            writer.writeheader()
        row = {'timestamp': datetime.utcnow().isoformat() + 'Z', 'label': frame_data['label']}
        for i, v in enumerate(frame_data['pixels']):
            row['p{}'.format(i)] = v
        writer.writerow(row)


def display_ascii_heatmap(pixels):
    if len(pixels) != 64:
        return

    min_t, max_t = min(pixels), max(pixels)
    range_t = max_t - min_t if max_t != min_t else 1
    chars = " ░▒▓█"

    print("\n" + "=" * 26)
    for row in range(8):
        line = " "
        for col in range(8):
            val = pixels[row * 8 + col]
            normalized = (val - min_t) / range_t
            char_idx = min(int(normalized * len(chars)), len(chars) - 1)
            line += chars[char_idx] * 3
        print(line)
    print(f" Min: {min_t:.1f}°C  Max: {max_t:.1f}°C")
    print("=" * 26)


def on_connect(client, userdata, flags, reason_code, properties):
    print(f"Connected to MQTT: {reason_code}")
    client.subscribe(MQTT_TOPIC)


def on_message(client, userdata, msg):
    global current_frame
    try:
        data = json.loads(msg.payload.decode())
        if 'pixels' in data and len(data['pixels']) == 64:
            current_frame = data['pixels']
    except:
        pass


def print_progress():
    empty_remaining = max(0, TARGET_EMPTY - empty_count)
    present_remaining = max(0, TARGET_PRESENT - present_count)

    print(f"\n{'='*50}")
    print(f"PROGRESS: {frame_count}/100 total")
    print(f"  Empty:   {empty_count}/{TARGET_EMPTY} {'DONE' if empty_remaining == 0 else f'(need {empty_remaining} more)'}")
    print(f"  Present: {present_count}/{TARGET_PRESENT} {'DONE' if present_remaining == 0 else f'(need {present_remaining} more)'}")
    print(f"{'='*50}")


def main():
    global current_frame

    if not STUDENT_ID or STUDENT_ID == "AXXXXXXXX":
        print("ERROR: Set STUDENT_ID in .env!")
        sys.exit(1)

    if not MQTT_TOPIC:
        print("ERROR: Set MQTT_TOPIC in .env!")
        sys.exit(1)

    print("="*50)
    print("Robust Collection Client")
    print(f"Student: {STUDENT_ID}")
    print(f"Target: {TARGET_EMPTY} empty + {TARGET_PRESENT} present = 100 frames")
    print("="*50)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()

    try:
        while True:
            if current_frame is None:
                continue

            pixels = current_frame
            current_frame = None
            display_ascii_heatmap(pixels)

            inp = input("\nLabel (0/1/s/p/q): ").strip().lower()

            if inp == 'q':
                break
            elif inp == 's':
                continue
            elif inp == 'p':
                print_progress()
                continue
            elif inp == '0':
                upload_frame_with_retry(pixels, "empty")
            elif inp == '1':
                upload_frame_with_retry(pixels, "present")

            if empty_count >= TARGET_EMPTY and present_count >= TARGET_PRESENT:
                print("\nGOAL REACHED! 100 balanced frames collected!")

    finally:
        print_progress()
        client.loop_stop()


if __name__ == "__main__":
    main()
