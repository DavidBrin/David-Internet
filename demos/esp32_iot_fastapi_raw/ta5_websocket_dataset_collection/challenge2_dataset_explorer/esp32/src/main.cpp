// TODO: Update CLIENT_ID and TOPIC_PREFIX to match your Python server

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <Adafruit_AMG88xx.h>
#include "ECE140_WIFI.h"
#include "ECE140_MQTT.h"

constexpr const char* CLIENT_ID = "challenge2_esp32";
constexpr const char* TOPIC_PREFIX = "ece140";

Adafruit_AMG88xx amg;
float pixels[AMG88xx_PIXEL_ARRAY_SIZE];
ECE140_MQTT mqtt(CLIENT_ID, TOPIC_PREFIX);
ECE140_WIFI wifi;

const char* ucsdUsername = UCSD_USERNAME;
String ucsdPassword = String(UCSD_PASSWORD);
const char* wifiSsid = WIFI_SSID;
const char* nonEnterpriseWifiPassword = NON_ENTERPRISE_WIFI_PASSWORD;

void setup() {
    Serial.begin(115200);
    delay(2000);

    if (strlen(nonEnterpriseWifiPassword) < 2) {
        wifi.connectToWPAEnterprise(wifiSsid, ucsdUsername, ucsdPassword);
    } else {
        wifi.connectToWiFi(wifiSsid, nonEnterpriseWifiPassword);
    }

    mqtt.connectToBroker();

    Wire.begin();
    if (!amg.begin()) {
        Serial.println("[ERROR] AMG8833 not detected!");
        while (1) { delay(1000); }
    }

    delay(100);
}

void loop() {
    mqtt.loop();

    amg.readPixels(pixels);
    float thermistor = amg.readThermistor();

    String message = "{\"thermistor\":";
    message += String(thermistor, 2);
    message += ",\"pixels\":[";

    for (int i = 0; i < AMG88xx_PIXEL_ARRAY_SIZE; i++) {
        message += String(pixels[i], 2);
        if (i < AMG88xx_PIXEL_ARRAY_SIZE - 1) message += ",";
    }
    message += "]}";

    mqtt.publishMessage("thermal", message);

    float maxTemp = pixels[0], minTemp = pixels[0];
    for (int i = 1; i < AMG88xx_PIXEL_ARRAY_SIZE; i++) {
        if (pixels[i] > maxTemp) maxTemp = pixels[i];
        if (pixels[i] < minTemp) minTemp = pixels[i];
    }

    Serial.print("[Thermal] Amb: ");
    Serial.print(thermistor, 1);
    Serial.print("C | Min: ");
    Serial.print(minTemp, 1);
    Serial.print("C | Max: ");
    Serial.print(maxTemp, 1);
    Serial.println("C");

    delay(1000);
}
