import paho.mqtt.client as mqtt
import json
import time
import threading

MQTT_BROKER = "broker.emqx.io"
TOPIC_PREFIX = "ece140a/thermal2"
REQUEST_TOPIC = f"{TOPIC_PREFIX}/request"
RESPONSE_TOPIC = f"{TOPIC_PREFIX}/response"

request_count = 0
response_count = 0
auto_mode = False
quit_flag = False

def on_connect(client, userdata, flags, reason_code, properties):
    print(f"Connected to MQTT broker with result code {reason_code}")
    client.subscribe(RESPONSE_TOPIC)
    print(f"Subscribed to response topic: {RESPONSE_TOPIC}")
    print(f"Will send requests to: {REQUEST_TOPIC}")
    print("Commands:  r - Request thermal data  a - Start auto-request (every 1 second)  s - Stop auto-request  q - Quit")

def on_message(client, userdata, msg):
    global response_count
    try:
        data = json.loads(msg.payload.decode())
        response_count += 1
        therm = data["thermistor"]
        pixels = data["pixels"]
        max_t = max(pixels)
        min_t = min(pixels)
        print(f"[Response #{response_count}] Ambient={therm:.1f}\u00b0C | Max={max_t:.1f}\u00b0C | Min={min_t:.1f}\u00b0C")
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing response: {e}")

def auto_request_thread(client):
    global request_count, auto_mode, quit_flag
    while not quit_flag:
        if auto_mode:
            request_count += 1
            client.publish(REQUEST_TOPIC, "")
            print(f"[Request #{request_count}] Sent request for thermal data")
            time.sleep(1)
        else:
            time.sleep(0.2)

def main():
    global request_count, auto_mode, quit_flag
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    print(f"Connecting to {MQTT_BROKER}...")
    client.connect(MQTT_BROKER, 1883, 60)
    client.loop_start()
    time.sleep(1)
    auto_thread = threading.Thread(target=auto_request_thread, args=(client,), daemon=True)
    auto_thread.start()
    try:
        while True:
            cmd = input("> ").strip().lower()
            if cmd == "q":
                quit_flag = True
                print("Exiting...")
                break
            elif cmd == "r":
                request_count += 1
                client.publish(REQUEST_TOPIC, "")
                print(f"[Request #{request_count}] Sent request for thermal data")
            elif cmd == "a":
                auto_mode = True
                print("[Auto] Started automatic requests (every 1 second)")
            elif cmd == "s":
                auto_mode = False
                print("[Auto] Stopped automatic requests")
    except KeyboardInterrupt:
        quit_flag = True
        print("\nExiting...")
    finally:
        quit_flag = True
        client.loop_stop()
        client.disconnect()
        print("Disconnected")

if __name__ == "__main__":
    main()
