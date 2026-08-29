#include <Arduino.h>
#include <WiFi.h>
#include "ECE140_WIFI.h"
#include "ECE140_MQTT.h"
#include <Wire.h>
#include <Adafruit_AMG88xx.h>

// WiFi credentials
const char* ucsdUsername = UCSD_USERNAME;
String ucsdPassword = String(UCSD_PASSWORD);
const char* wifiSsid = WIFI_SSID;
const char* nonEnterpriseWifiPassword = NON_ENTERPRISE_WIFI_PASSWORD;
unsigned long lastPublish = 0;

// MQTT config
const char* CLIENT_ID = MQTT_CLIENT_ID;
const char* TOPIC_PREFIX = MQTT_TOPIC;


Adafruit_AMG88xx amg;
float pixels[AMG88xx_PIXEL_ARRAY_SIZE];



ECE140_MQTT mqtt(CLIENT_ID, TOPIC_PREFIX);
ECE140_WIFI wifi;

// Helper function to publish sensor data as JSON
void sendThermalData() {
    Serial.println("Reading thermal data from AMG8833...");
    
    // Read pixels from sensor
    amg.readPixels(pixels);
    
    // Build JSON string manually
    String json = "{";
    json += "\"device_id\":\"" + String(CLIENT_ID) + "\",";
    json += "\"pixels\":[";
    
    for (int i = 0; i < AMG88xx_PIXEL_ARRAY_SIZE; i++) {
        if (i > 0) {
            json += ",";
        }
        json += String(pixels[i], 1);
    }
    
    json += "]}";
    
    Serial.println("Publishing thermal data:");
    Serial.println(json);
    
    // Publish to thermal_data topic
    mqtt.publishMessage("thermal_data", json);
}

// MQTT callback function to handle incoming commands
void MQTTcallback(char* topic, byte* payload, unsigned int length) {
    String message = String((char*)payload, length);
    Serial.println("Received MQTT message: " + message);
    
    // Trigger thermal reading when "read" command is received
    if (message == "read") {
        sendThermalData();
    } else {
        Serial.println("Unknown command: " + message);
    }
}

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("Attempting setup WiFi");
    if(strcmp(wifiSsid, "UCSD-PROTECTED") == 0){
        Serial.println("Connecting to UCSD-PROTECTED...");
        wifi.connectToWPAEnterprise(wifiSsid, ucsdUsername, ucsdPassword);
     } //else {
    //     Serial.println("Connecting to Non-Enterprise WiFi...");
    //     wifi.connectToWiFi(wifiSsid,nonEnterpriseWifiPassword);
    // }
    delay(1000);
    
    // Connect to MQTT broker
    mqtt.connectToBroker();
    
    // Subscribe to command topic
    mqtt.subscribeTopic("command");
    
    // Set up the callback function
    mqtt.setCallback(MQTTcallback);

    // Initializing the AMG8833 sensor
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
}
