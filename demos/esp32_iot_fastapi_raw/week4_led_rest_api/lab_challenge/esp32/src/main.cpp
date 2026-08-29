#include <Arduino.h>
#include <WiFi.h>
#include <Adafruit_NeoPixel.h>
#include "ECE140_WIFI.h"
#include "ECE140_MQTT.h"


constexpr int NEOPIXEL_PIN = 33;

// WiFi credentials
const char* ucsdUsername = UCSD_USERNAME;
String ucsdPassword = String(UCSD_PASSWORD);
const char* wifiSsid = WIFI_SSID;
const char* nonEnterpriseWifiPassword = NON_ENTERPRISE_WIFI_PASSWORD;
unsigned long lastPublish = 0;

// MQTT config
const char* CLIENT_ID = MQTT_CLIENT_ID;
const char* TOPIC_PREFIX = MQTT_TOPIC;


ECE140_MQTT mqtt(CLIENT_ID, TOPIC_PREFIX);
ECE140_WIFI wifi;
Adafruit_NeoPixel pixel(1, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);

String currentColor = "off";

void setColor(int r, int g, int b) {
    pixel.setPixelColor(0, pixel.Color(r, g, b));
    pixel.show();
}

// MQTT Callback to handle LED color changes
void MQTTcallback(char* topic, byte* payload, unsigned int length) {
    String message = String((char*)payload, length);
    Serial.println("Received MQTT message: " + message);
    if (message == "red") {
        setColor(255, 0, 0);
        currentColor = "red";
    } else if (message == "green") {
        setColor(0, 255, 0);
        currentColor = "green";
    } else if (message == "blue") {
        setColor(0, 0, 255);
        currentColor = "blue";
    } else if (message == "off") {
        setColor(0, 0, 0);
        currentColor = "off";
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(NEOPIXEL_POWER, OUTPUT);
    digitalWrite(NEOPIXEL_POWER, HIGH);
    delay(10);
    pixel.begin();
    pixel.setBrightness(50);
    Serial.println("NeoPixel initialized");

    Serial.println("Attempting setup WiFi");
    if(wifiSsid == "UCSD-PROTECTED"){
        Serial.println("Connecting to UCSD-PROTECTED...");
        wifi.connectToWPAEnterprise("UCSD-PROTECTED", ucsdUsername, ucsdPassword);
    } else {
        Serial.println("Connecting to Non-Enterprise WiFi...");
        wifi.connectToWiFi(wifiSsid,nonEnterpriseWifiPassword);
    }
    delay(1000);
    mqtt.connectToBroker();
    mqtt.subscribeTopic("led");
    mqtt.setCallback(MQTTcallback);
}

void loop() {
    mqtt.loop();
}

