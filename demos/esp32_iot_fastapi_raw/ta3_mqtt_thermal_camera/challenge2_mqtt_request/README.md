# Challenge 2: MQTT Request-Response Thermal Camera

Python asks for thermal data, ESP32 responds immediately. NO DELAYS allowed in the ESP32 loop - it has to stay responsive.

## Setup

### ESP32
1. Copy `esp32/env.example` to `esp32/.env` and fill in WiFi credentials
2. Set your `CLIENT_ID` and `TOPIC_PREFIX` in `main.cpp`
3. Upload with PlatformIO

### Python
```bash
cd python
uv run thermal_controller.py
```

Make sure `TOPIC_PREFIX` in `thermal_controller.py` matches the ESP32 one.

## Commands

Once Python is running, you can type:
- `r` - Request one thermal reading
- `a` - Start auto mode (requests every 1 second)
- `s` - Stop auto mode
- `q` - Quit

## Delayless Pattern

The ESP32 can't use `delay()` in the loop because it needs to respond to requests immediately. Instead:

1. MQTT callback sets a flag when a request comes in
2. Loop checks the flag, reads sensor data, publishes response, clears flag
3. Loop keeps running without blocking

So basically the callback does `dataRequested = true`, then loop does:
```cpp
if (dataRequested) {
    dataRequested = false;
    // read sensor and publish
}
```

 ESP32 stays responsive and can handle requests as soon as they arrive.

## MQTT Topics

- `{TOPIC_PREFIX}/request` - Python sends requests here
- `{TOPIC_PREFIX}/response` - ESP32 publishes responses here

## Example

```
> r
[Request #1] Sent request for thermal data
[Response #1] Ambient=25.5°C | Max=32.1°C | Min=24.2°C
> a
[Auto] Started automatic requests (every 1 second)
[Request #2] Sent request for thermal data
[Response #2] Ambient=25.5°C | Max=33.0°C | Min=24.1°C
> s
[Auto] Stopped automatic requests
> q
```

## Video

https://youtube.com/shorts/hxsEgzr16Ys?feature=share 
