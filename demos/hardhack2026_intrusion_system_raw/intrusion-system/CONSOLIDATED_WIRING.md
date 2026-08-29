# ESP32-S3-Mini Consolidated Wiring Diagram

## Overview
Single ESP32-S3-Mini board consolidates:
- Ultrasonic distance sensor (HC-SR04)
- Proximity sensor (VCNL4040 via I2C)
- Servo motor (door lock)
- Buzzer/alarm
- LED indicators
- WiFi & MQTT connectivity

---

## GPIO Pin Assignments

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESP32-S3-Mini GPIO Map                       │
│                   (Your Actual Board Pinout)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SENSOR/HARDWARE PINS:                                          │
│  ├─ GPIO2:  HC-SR04 TRIG (Ultrasonic Trigger)                 │
│  ├─ GPIO3:  HC-SR04 ECHO (Ultrasonic Echo)                    │
│  ├─ GPIO6:  Servo Motor Signal (PWM)                          │
│  ├─ GPIO7:  Buzzer/Alarm                                       │
│  ├─ GPIO8:  LED Green (Normal state)                           │
│  ├─ GPIO9:  LED Red (Alert state)                              │
│  │                                                              │
│  I2C PINS (VCNL4040 Proximity Sensor):                         │
│  ├─ GPIO21: I2C SDA (Data) - Near 5V on right side            │
│  ├─ GPIO26: I2C SCL (Clock) - Above GPIO21 on right side      │
│  │                                                              │
│  POWER PINS:                                                    │
│  ├─ 5V:    Power input (right side, near GPIO21/GPIO26)       │
│  ├─ 3.3V:  For VCNL4040, pull-up resistors (left side)       │
│  ├─ GND:   Common ground for all components (bottom)           │
│  │                                                              │
│  USB:                                                           │
│  └─ USB-C:  Programming, debugging, power                      │
│                                                                 │
│  BOARD PINOUT REFERENCE:                                       │
│  Left side (top to bottom):  1-18, 3.3V, GND                  │
│  Right side (top to bottom): 46,45,44,43,42,41,40,39,38,37,   │
│                              36,35,34,33,47,26,21,5V,GND       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Wiring Diagrams

### 1. HC-SR04 Ultrasonic Sensor Wiring

```
┌──────────────────────────────────────────────────────────┐
│           HC-SR04 → ESP32-S3-Mini                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   HC-SR04        Wire        ESP32              Level   │
│  ┌──────┐                    ┌────┐                    │
│  │ TRIG ├─────────────────→ GPIO2 │   3.3V logic ✓     │
│  │ ECHO ├─────────────────← GPIO3 │   3.3V logic ✓     │
│  │ VCC  ├─────────────────→ 5V    │   Powered by USB  │
│  │ GND  ├─────────────────→ GND   │   Common ref      │
│  └──────┘                    └────┘                    │
│                                                          │
│  Distance Calculation:                                  │
│  - TRIG: Send 10µs pulse to start measurement          │
│  - ECHO: Measure pulse duration (HIGH time)            │
│  - Distance = (duration × 0.0343) / 2 cm              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2. VCNL4040 Proximity Sensor Wiring (I2C)

```
┌──────────────────────────────────────────────────────────┐
│         VCNL4040 → ESP32-S3-Mini (I2C)                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   VCNL4040       Wire        ESP32              Notes   │
│  ┌──────┐                    ┌────┐                    │
│  │ VDD  ├─────────────────→ 3.3V │   ⚠ NOT 5V!       │
│  │ GND  ├─────────────────→ GND  │   Common ref      │
│  │ SDA  ├─────────────────↔ GPIO21  I2C Data       │
│  │ SCL  ├─────────────────↔ GPIO26  I2C Clock      │
│  └──────┘                    └────┘                    │
│                                                          │
│  I2C Configuration:                                    │
│  - Address: 0x60 (fixed)                               │
│  - Clock: 100kHz                                        │
│  - SDA=GPIO21, SCL=GPIO26 (with internal pull-ups)    │
│                                                          │
│  ⚠ CRITICAL: VCNL4040 is 3.3V ONLY!                   │
│     Connecting to 5V will damage the sensor!           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3. Servo Motor (Door Lock) Wiring

```
┌──────────────────────────────────────────────────────────┐
│          Servo Motor → ESP32-S3-Mini                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Servo Motor    Wire        ESP32        Notes         │
│  ┌────────┐                  ┌────┐                    │
│  │ Signal ├─────────────────→ GPIO6  PWM control      │
│  │ VCC    ├─────────────┐    5V     EXTERNAL power!   │
│  │ GND    ├─────────────┴─→ GND    Common ref         │
│  └────────┘            │           (back to ESP32)    │
│                        │                               │
│              [5V External Power Supply]                │
│                        │                               │
│                        ↓                               │
│                     Servo +5V                          │
│                                                          │
│  Signal Levels:                                         │
│  - GPIO6 output: 3.3V PWM (servo tolerates this)      │
│  - Duty cycle: ~5% (1000µs) ← unlock                 │
│  - Duty cycle: ~10% (2000µs) ← lock                  │
│                                                          │
│  ⚠ IMPORTANT:                                          │
│  - Servo MUST use external power supply (5-6V)        │
│  - Don't power servo from ESP32's 3.3V rail!         │
│  - Connect GND back to ESP32 for common reference     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4. Buzzer/Alarm Wiring

```
┌──────────────────────────────────────────────────────────┐
│           Buzzer → ESP32-S3-Mini                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Buzzer         Wire        ESP32        Notes         │
│  ┌────────┐                  ┌────┐                    │
│  │ Positive─────────────────→ GPIO7  Digital GPIO    │
│  │ Negative──────────────────→ GND    Common ref     │
│  └────────┘                  └────┘                    │
│                                                          │
│  Operation:                                             │
│  - GPIO7 HIGH (3.3V):  Buzzer ON                       │
│  - GPIO7 LOW (0V):     Buzzer OFF                      │
│                                                          │
│  Power:                                                 │
│  - 3.3V from ESP32 can power small buzzer (<100mA)    │
│  - If buzzer draws >100mA, use transistor/relay       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5. LED Indicators Wiring

```
┌──────────────────────────────────────────────────────────┐
│      Green & Red LEDs → ESP32-S3-Mini                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   LED Green          Wire         ESP32        Notes    │
│  ┌──────┐                         ┌────┐              │
│  │ Anode ├──[220Ω]───────────────→ GPIO8  Digital    │
│  │Cathode├──────────────────────→ GND    Common      │
│  └──────┘                         └────┘              │
│                                                          │
│   LED Red            Wire         ESP32        Notes    │
│  ┌──────┐                         ┌────┐              │
│  │ Anode ├──[220Ω]───────────────→ GPIO9  Digital    │
│  │Cathode├──────────────────────→ GND    Common      │
│  └──────┘                         └────┘              │
│                                                          │
│  Operation:                                             │
│  - GPIO HIGH (3.3V):  LED ON (220Ω limits current)    │
│  - GPIO LOW (0V):     LED OFF                          │
│                                                          │
│  States:                                                │
│  - GREEN ON, RED OFF:   System NORMAL (armed)         │
│  - RED ON, GREEN OFF:   System ALERT (intrusion)      │
│  - Both OFF:            System OFF (disarmed)         │
│                                                          │
│  Resistor Sizing:                                       │
│  - LED forward voltage: ~2V @ 20mA                     │
│  - Resistor value: (3.3V - 2V) / 0.020A ≈ 65Ω        │
│  - Using 220Ω is safe (limits to ~6mA, very bright)  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Complete System Block Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        ESP32-S3-Mini                               │
│                    (All-in-One Controller)                         │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │                     GPIO Pins                             │    │
│  │  ┌────────────────────────────────────────────────────┐   │    │
│  │  │ SENSORS:          SECURITY HARDWARE:              │   │    │
│  │  │ ├─ GPIO2: TRIG   ├─ GPIO6: Servo (PWM)         │   │    │
│  │  │ ├─ GPIO3: ECHO   ├─ GPIO7: Buzzer              │   │    │
│  │  │ ├─ GPIO21: SDA   ├─ GPIO8: LED Green           │   │    │
│  │  │ └─ GPIO22: SCL   └─ GPIO9: LED Red             │   │    │
│  │  └────────────────────────────────────────────────────┘   │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │              WiFi & MQTT Networking                       │    │
│  │  ├─ WiFi: UCSD-PROTECTED or personal hotspot            │    │
│  │  ├─ MQTT: broker.hivemq.com:1883                        │    │
│  │  ├─ Pub: ucsd/hardhack/brent/status                     │    │
│  │  └─ Sub: ucsd/hardhack/brent/command                    │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
         ↓                          ↓                    ↓
      ┌─────────┐            ┌──────────────┐      ┌─────────┐
      │HC-SR04  │            │VCNL4040      │      │ Servo,  │
      │Distance │            │Proximity     │      │ Buzzer, │
      │Sensor   │            │(I2C)         │      │ LEDs    │
      └─────────┘            └──────────────┘      └─────────┘
```

---

## Power Distribution

```
┌──────────────────────────────────────────────────────────┐
│             Power Supply Distribution                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  USB-C Power (5V) from Computer/Power Bank             │
│       ↓                                                  │
│  ┌────────────────────────────────────────────────┐    │
│  │  ESP32-S3-Mini (has built-in 3.3V regulator)  │    │
│  └────────────────────────────────────────────────┘    │
│       ↓                    ↓                    ↓        │
│   [3.3V Rail]         [5V Rail]          [GND Rail]    │
│       ↓                    ↓                    ↓        │
│   VCNL4040          External Power        All Sensors  │
│   Pull-ups          for Servo             & Hardware   │
│   (4.7k Ω)                                             │
│                                                          │
│  ⚠ POWER RECOMMENDATIONS:                              │
│                                                          │
│  1. Servo Power:                                        │
│     - USB power may not be sufficient for servo         │
│     - Use dedicated 5-6V power supply (1A+)             │
│     - Connect GND back to ESP32 GND                     │
│                                                          │
│  2. ESP32 Power:                                        │
│     - USB-C from computer or 5V power bank              │
│     - Adequate for sensors + buzzer + LEDs              │
│                                                          │
│  3. Ground Reference:                                   │
│     - ALL GNDs must be connected together               │
│     - Both internal and external power supplies         │
│     - Missing ground = no communication!                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Full Wiring Checklist

### Sensors
- [ ] HC-SR04 TRIG → GPIO2
- [ ] HC-SR04 ECHO → GPIO3
- [ ] HC-SR04 VCC → 5V
- [ ] HC-SR04 GND → GND
- [ ] VCNL4040 SDA → GPIO21
- [ ] VCNL4040 SCL → GPIO22
- [ ] VCNL4040 VDD → 3.3V (NOT 5V!)
- [ ] VCNL4040 GND → GND
- [ ] I2C pull-ups: 4.7kΩ from SDA→3.3V and SCL→3.3V

### Security Hardware
- [ ] Servo Signal → GPIO6
- [ ] Servo VCC → External 5-6V power
- [ ] Servo GND → ESP32 GND (common reference!)
- [ ] Buzzer Positive → GPIO7
- [ ] Buzzer Negative → GND
- [ ] LED Green Anode → 220Ω resistor → GPIO8
- [ ] LED Green Cathode → GND
- [ ] LED Red Anode → 220Ω resistor → GPIO9
- [ ] LED Red Cathode → GND

### Power & Reference
- [ ] ESP32 USB-C → 5V source
- [ ] External servo power GND → ESP32 GND
- [ ] All component GNDs connected together

### Verification
- [ ] All connections are secure and not loose
- [ ] No 5V connected to VCNL4040 (would damage it)
- [ ] Servo has external power supply
- [ ] LED resistors are in place (220Ω)

---

## Troubleshooting Quick Reference

| Symptom | Cause | Solution |
|---------|-------|----------|
| VCNL4040 not detected on I2C | Wrong pins or damage | Check GPIO21/22, verify 3.3V (not 5V) |
| Servo not responding | No external power | Connect external 5-6V supply with GND link |
| LEDs not lighting | Resistor missing or reversed | Verify 220Ω resistors installed, check polarity |
| Buzzer silent | GPIO7 not toggling | Check pin config, verify 3.3V output works |
| Distance sensor reading 0cm always | TRIG/ECHO wired wrong | Swap GPIO2/GPIO3 test, verify pulse_in timeout |
| WiFi drops constantly | Power supply unstable | Use better USB power source or power bank |
| MQTT won't connect | WiFi down or broker unreachable | Check WiFi first, verify broker IP/port |

---

## Pin Reference Summary

| Purpose | Pin | GPIO | Voltage | Notes |
|---------|-----|------|---------|-------|
| Ultrasonic TRIG | - | 2 | 3.3V out | Trigger pulse |
| Ultrasonic ECHO | - | 3 | 3.3V in | Pulse measurement |
| I2C SDA | Right | 21 | 3.3V | Pull-up required, near 5V |
| I2C SCL | Right | 26 | 3.3V | Pull-up required, above GPIO21 |
| Servo Signal | - | 6 | 3.3V PWM | External power for servo |
| Buzzer | - | 7 | 3.3V | GPIO drives directly |
| LED Green | - | 8 | 3.3V | 220Ω resistor required |
| LED Red | - | 9 | 3.3V | 220Ω resistor required |
| USB-C | Right | - | 5V in | Power & programming |
| 3.3V Rail | Left | - | 3.3V out | Sensors, pull-ups |
| GND | Bottom | - | 0V ref | Common ground |

