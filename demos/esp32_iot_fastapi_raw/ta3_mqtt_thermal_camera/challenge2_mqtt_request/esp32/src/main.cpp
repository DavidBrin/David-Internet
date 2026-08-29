#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <Adafruit_AMG88xx.h>
#include "ECE140_WIFI.h"
#include "ECE140_MQTT.h"

constexpr const char* CLIENT_ID = "esp32-thermal-002";
constexpr const char* TOPIC_PREFIX = "ece140a/thermal2";

Adafruit_AMG88xx amg;
float pixels[AMG88xx_PIXEL_ARRAY_SIZE];
ECE140_MQTT mqtt(CLIENT_ID, TOPIC_PREFIX);
volatile bool dataRequested = false;
ECE140_WIFI wifi;

// WiFi credentials
const char* ucsdUsername = UCSD_USERNAME;
String ucsdPassword = String(UCSD_PASSWORD);
const char* wifiSsid = WIFI_SSID;
const char* nonEnterpriseWifiPassword = NON_ENTERPRISE_WIFI_PASSWORD;

/**
 * @brief Callback function for MQTT messages
 */
void mqttCallback(char* topic, uint8_t* payload, unsigned int length) {
    (void)payload;
    (void)length;
    Serial.print("[Request] Received on topic: ");
    Serial.println(topic);
    dataRequested = true;
}


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
    mqtt.setCallback(mqttCallback);
    mqtt.subscribeTopic("request");
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

    if (dataRequested) {
        dataRequested = false;
        amg.readPixels(pixels);
        float thermistor = amg.readThermistor();
        String message = "{\"thermistor\":" + String(thermistor, 2) + ",\"pixels\":[";
        for (int i = 0; i < AMG88xx_PIXEL_ARRAY_SIZE; i++) {
            message += String(pixels[i], 2);
            if (i < AMG88xx_PIXEL_ARRAY_SIZE - 1) message += ",";
        }
        message += "]}";
        mqtt.publishMessage("response", message);
    }
}
