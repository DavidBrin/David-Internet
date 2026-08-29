# LED Strip Integration

## LED Strip Pinout

```
WS2812 / NeoPixel LED Strip → ESP32-S3-Mini
┌──────────────────────────────┬──────────────────────┐
│ LED Strip Pin                │ ESP32 GPIO Pin       │
├──────────────────────────────┼──────────────────────┤
│ DIN (Data In)                │ GPIO5                │
│ +5V                          │ 5V (from USB-C)      │
│ GND                          │ GND                  │
└──────────────────────────────┴──────────────────────┘
```

## Wiring Diagram

```
┌─────────────────────────────────────────────────────────┐
│          WS2812 LED Strip → ESP32-S3-Mini              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   LED Strip          Wire        ESP32         Notes   │
│  ┌─────────┐                     ┌────┐              │
│  │ DIN     ├─────────────────────→ GPIO5  Data signal │
│  │ +5V     ├─────────────────────→ 5V    Power       │
│  │ GND     ├─────────────────────→ GND   Common ref  │
│  └─────────┘                     └────┘              │
│                                                         │
│  Configuration:                                        │
│  - NumLEDs: 30 (adjust to your strip length)          │
│  - Brightness: 100 (0-255 scale)                      │
│  - LED Type: WS2812 (NeoPixel compatible)             │
│  - Color Order: GRB                                    │
│                                                         │
│  Power Requirements:                                   │
│  - 30 LEDs @ full brightness (~900mA max)             │
│  - Recommend external 5V power supply (1-2A)          │
│  - If using USB power, limit brightness to avoid drops│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Code Integration

The LED strip has been integrated into `intrusion_esp32_consolidated.ino` with:

**Includes:**
```cpp
#include <FastLED.h>
```

**Configuration:**
```cpp
#define LED_STRIP_PIN 5
#define NUM_LEDS 30
#define LED_TYPE WS2812
#define COLOR_ORDER GRB
```

**Initialization (in setup()):**
```cpp
FastLED.addLeds<LED_TYPE, LED_STRIP_PIN, COLOR_ORDER>(leds, NUM_LEDS);
FastLED.setBrightness(100);
```

**Update Loop (in loop(), every 1 second):**
```cpp
updateLEDStrip();  // Cycles: Red → Green → Blue
```

## Behavior

The LED strip cycles through colors every 1 second:
1. **Red** (1s)
2. **Green** (1s)
3. **Blue** (1s)
4. Repeats...

This runs independently in the background and doesn't affect any security functionality.

## Customization

To change the animation, modify the `updateLEDStrip()` function:

```cpp
void updateLEDStrip() {
  // Example: Set all LEDs to white at 50% brightness
  fill_solid(leds, NUM_LEDS, CRGB::White);
  FastLED.setBrightness(127);  // 0-255
  FastLED.show();
}
```

### Common Colors:
- `CRGB::Red`
- `CRGB::Green`
- `CRGB::Blue`
- `CRGB::White`
- `CRGB::Yellow`
- `CRGB::Cyan`
- `CRGB::Magenta`
- `CRGB(255, 165, 0)` - Orange (custom RGB)

## Important Notes

1. **GPIO5** is used (left side of your board, not used by other components)
2. **Brightness is set to 100** to avoid power draw issues - adjust if needed
3. **External 5V power recommended** if strip uses >500mA
4. **No logic tied to strip** - purely aesthetic, runs regardless of system state
5. **FastLED library required** - install via Arduino IDE

## Power Distribution

```
USB-C 5V Input
     ↓
┌────────────────────────────────┐
│  ESP32-S3-Mini                 │
│  ├─ Logic circuits (3.3V)      │
│  └─ 5V passthrough             │
└────────────────────────────────┘
     ↓
  5V Rail
  ├─ LED Strip (recommended external power)
  ├─ Servo Motor (uses external power)
  └─ Can draw from USB if < 500mA total
```

If LED strip + Servo exceeds USB power limit (500mA), connect both to **external 5V power supply** and link GND to ESP32 GND for common reference.
