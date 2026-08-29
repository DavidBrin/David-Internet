#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_AMG88xx.h>

Adafruit_AMG88xx amg;
float pixels[AMG88xx_PIXEL_ARRAY_SIZE];

void setup() {
    Serial.begin(115200);
    delay(2000);

    Wire.begin();

    if (!amg.begin()) {
        while (1) {
            Serial.println("{\"error\":\"AMG8833 not detected\"}");
            delay(1000);
        }
    }

    Serial.println("{\"status\":\"AMG8833 initialized\"}");
    delay(100);  // Let sensor boot up
}

void loop() {
    // Read all 64 pixels at once
    amg.readPixels(pixels);

    // Get the thermistor temperature (ambient)
    float thermistor = amg.readThermistor();

    // Build JSON message with all pixel data
    Serial.print("{\"thermistor\":");
    Serial.print(thermistor, 2);
    Serial.print(",\"pixels\":[");

    for (int i = 0; i < AMG88xx_PIXEL_ARRAY_SIZE; i++) {
        Serial.print(pixels[i], 2);
        if (i < AMG88xx_PIXEL_ARRAY_SIZE - 1) Serial.print(",");
    }

    Serial.println("]}");

    delay(1000);  // Send data every second
}
