# Intrusion Detection System - Wiring Diagram

## Overview
This system uses two microcontrollers:
- **Arduino Uno**: Sensor reading and security control
- **ESP32-S3-Mini**: WiFi gateway and MQTT communication

---

## Arduino Uno Pins

### Sensor/Security Hardware
```
HC-SR04 Ultrasonic Sensor:
  - TRIG (Trigger)  → Arduino Pin 9
  - ECHO (Echo)     → Arduino Pin 10
  - VCC             → Arduino 5V
  - GND             → Arduino GND

VCNL4040 Proximity Sensor (I2C):
  - VDD             → Arduino 3.3V (NOT 5V!)
  - GND             → Arduino GND
  - SDA             → Arduino A4 (Analog 4)
  - SCL             → Arduino A5 (Analog 5)
  - Pull-ups        → 4.7kΩ from SDA to 3.3V, SCL to 3.3V

Servo Motor (Door Lock):
  - Signal          → Arduino Pin 6
  - VCC             → Arduino 5V (via external power supply)
  - GND             → Arduino GND

Buzzer/Alarm:
  - Positive        → Arduino Pin 7
  - Negative        → Arduino GND

LED - Green (Normal):
  - Anode (+)       → Arduino Pin 3 (via 220Ω resistor)
  - Cathode (-)     → Arduino GND

LED - Red (Alert):
  - Anode (+)       → Arduino Pin 4 (via 220Ω resistor)
  - Cathode (-)     → Arduino GND
```

### UART Communication with ESP32
```
Arduino to ESP32 (SoftwareSerial with Voltage Divider):
  - Pin 2 (TX, 5V) → [VOLTAGE DIVIDER] → ESP32 GPIO17 (RX, 3.3V)
  - Pin 5 (RX, 5V) ← ESP32 GPIO18 (TX, 3.3V) [SAFE - no divider needed]
  - GND             → ESP32 GND (COMMON GROUND!)
  - Baud Rate: 9600

VOLTAGE DIVIDER (Required for Pin 2 → GPIO17):
  - Arduino Pin 2 → 1kΩ resistor → [Junction]
  - [Junction] → 2kΩ resistor → GND
  - [Junction] → ESP32 GPIO17
  
  This creates a voltage divider: Vout = 5V × (2kΩ / (1kΩ + 2kΩ)) ≈ 3.33V
```

---

## ESP32-S3-Mini Pins

### UART Communication with Arduino
```
UART1 on ESP32-S3-Mini:
  - GPIO17 (TX)     ← Arduino Pin 2 (TX)
  - GPIO18 (RX)     ← Arduino Pin 5 (RX)
  - GND             ← Arduino GND
```

### Power/Programming
```
  - USB-C           → Computer (for programming/debugging)
  - 3.3V            → Power supply (if needed)
  - GND             → Common ground with Arduino
```

---

## Complete Wiring Checklist

### Critical UART Connections (for Arduino ↔ ESP32 communication):
- [ ] Arduino Pin 2 → 1kΩ resistor → Junction point
- [ ] Junction point → 2kΩ resistor → GND
- [ ] Junction point → ESP32 GPIO17
- [ ] Arduino Pin 5 connected to ESP32 GPIO18 (direct, no resistor)
- [ ] Arduino GND connected to ESP32 GND (MUST BE COMMON!)
- [ ] Both boards share the same ground reference

### Arduino Sensors:
- [ ] HC-SR04 TRIG to Pin 9, ECHO to Pin 10
- [ ] VCNL4040 SDA to A4, SCL to A5 (with 4.7kΩ pull-ups)
- [ ] Both sensors powered correctly (5V/3.3V)

### Arduino Security Hardware:
- [ ] Servo signal to Pin 6
- [ ] Buzzer to Pin 7
- [ ] Green LED to Pin 3 (with resistor)
- [ ] Red LED to Pin 4 (with resistor)

### ESP32 WiFi:
- [ ] Connected via USB-C for programming
- [ ] Can also be powered via external USB power bank

---

## Wiring Visual (Text Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMMON GROUND (CRITICAL!)                               │
│          (MUST CONNECT ARDUINO GND TO ESP32 GND)                            │
│                                                                              │
│                    ════════════════════════════════════                      │
│                                                                              │
│                                                                              │
│   ARDUINO UNO                          VOLTAGE DIVIDER    ESP32-S3-Mini    │
│  ┌──────────────┐                                       ┌────────────────┐ │
│  │              │                                       │                │ │
│  │ Pin 2 (TX)   ├──[1kΩ]──┬─────────────────────────────┤ GPIO17 (RX)    │ │
│  │              │         │                             │                │ │
│  │              │         ├──[2kΩ]──┐                   │                │ │
│  │              │         │         │                   │                │ │
│  │ Pin 5 (RX)   ├─────────┼─────────┼───────────────────┤ GPIO18 (TX)    │ │
│  │              │         │         │                   │                │ │
│  │    GND       ├─────────┴─────────┴───────────────────┤ GND            │ │
│  │              │      (COMMON REFERENCE - CRITICAL!)    │                │ │
│  │              │                                        │                │ │
│  └──────────────┘                                        └────────────────┘ │
│                                                                              │
│  Signal Levels:                                                             │
│  ├─ Arduino TX (5V) → Divider → GPIO17 RX (3.3V) ✓ Protected               │
│  └─ Arduino RX (5V tolerant) ← GPIO18 TX (3.3V) ✓ Safe                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Symptoms: ESP32 not receiving data (all zeros/empty)
**Possible causes:**
1. **Missing voltage divider on Arduino TX → ESP32 RX** (5V can damage ESP32 input)
2. GND connection is loose or missing
3. Pin connections are swapped or not fully inserted
4. Baud rate mismatch (should both be 9600)
5. GPIO17 damaged from 5V signal without protection

**To fix:**
1. Add voltage divider: 1kΩ (Arduino Pin 2 → Junction) + 2kΩ (Junction → GND)
2. Connect Junction to ESP32 GPIO17
3. Verify GND is common between both boards

### Symptoms: Garbled data
**Check:**
1. Baud rate mismatch (should both be 9600)
2. Loose connections causing bit shifts
3. Power supply issues (use stable 5V/3.3V)

### Symptoms: Arduino not receiving commands from ESP32
**Check:**
1. GPIO18 (TX) on ESP32 is actually outputting data
2. Arduino Pin 5 is properly configured as RX
3. No serial conflicts on Arduino side

---

## Power Considerations

- **Arduino Uno**: 5V from USB or external power supply
- **ESP32-S3-Mini**: 3.3V from USB-C or external power supply
- **Servo Motor**: Requires external 5-6V power supply (don't power from Arduino!)
- **VCNL4040**: MUST use 3.3V, not 5V (it will be damaged!)
- **All GNDs must be connected together**

---

## Current Configuration

```cpp
// Arduino comm_protocol.h
#define ARDUINO_RX_PIN 5    // Receives from ESP32
#define ARDUINO_TX_PIN 2    // Transmits to ESP32

// ESP32 intrusion_esp32.ino
#define UART_RX_PIN 18      // Receives from Arduino
#define UART_TX_PIN 17      // Transmits to Arduino
#define UART_BAUD 9600
```
