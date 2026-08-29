#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <Adafruit_AMG88xx.h>
#include "ECE140_WIFI.h"
#include "ECE140_MQTT.h"

// TODO: Fill in your unique client ID and topic prefix
constexpr const char* CLIENT_ID = "esp32-thermal-001";
constexpr const char* TOPIC_PREFIX = "ece140a/thermal";  // must match Python subscriber

Adafruit_AMG88xx amg;
float pixels[AMG88xx_PIXEL_ARRAY_SIZE];
ECE140_MQTT mqtt(CLIENT_ID, TOPIC_PREFIX);
ECE140_WIFI wifi;

// WiFi credentials
const char* ucsdUsername = UCSD_USERNAME;
String ucsdPassword = String(UCSD_PASSWORD);
const char* wifiSsid = WIFI_SSID;
const char* nonEnterpriseWifiPassword = NON_ENTERPRISE_WIFI_PASSWORD;

void setup() {
    Serial.begin(115200);
    delay(2000);

    // Connect to WiFi
    if (strlen(nonEnterpriseWifiPassword) < 2) {
        wifi.connectToWPAEnterprise(wifiSsid, ucsdUsername, ucsdPassword);
    } else {
        wifi.connectToWiFi(wifiSsid, nonEnterpriseWifiPassword);
    }

    // Connect to MQTT broker
    mqtt.connectToBroker();

    // Initialize AMG8833
    Wire.begin();
    if (!amg.begin()) {
        while (1) {
            Serial.println("{\"error\":\"AMG8833 not detected\"}");
            delay(1000);
        }
    }

    delay(100);  // Let sensor boot up
    Serial.println("[Setup] AMG8833 and MQTT ready!");
}

void loop() {
    mqtt.loop();

    amg.readPixels(pixels);
    float thermistor = amg.readThermistor();

    String message = "{\"thermistor\":" + String(thermistor, 2) + ",\"pixels\":[";
    for (int i = 0; i < AMG88xx_PIXEL_ARRAY_SIZE; i++) {
        message += String(pixels[i], 2);
        if (i < AMG88xx_PIXEL_ARRAY_SIZE - 1) message += ",";
    }
    message += "]}";

    mqtt.publishMessage("thermal", message);

    delay(1000);
}
