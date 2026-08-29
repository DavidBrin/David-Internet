#include <Arduino.h>
#include <WiFi.h>
#include "ECE140_WIFI.h"
#include "ECE140_MQTT.h"

constexpr const int NUM_NETWORKS = 10;
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


// Helper function to scan networks and publish JSON to MQTT
void scanAndPublishNetworks() {
    Serial.println("Starting WiFi network scan...");
    
    // Get connected network info
    String connectedSSID = WiFi.SSID();
    int connectedRSSI = WiFi.RSSI();
    
    int n = WiFi.scanNetworks();
    Serial.print("Found ");
    Serial.print(n);
    Serial.println(" networks");
    
    String json = "{";
    json += "\"device_id\":\"" + String(CLIENT_ID) + "\",";
    json += "\"timestamp\":" + String(millis()) + ",";
    json += "\"connected_ssid\":\"" + connectedSSID + "\",";
    json += "\"connected_rssi\":" + String(connectedRSSI) + ",";
    json += "\"networks\":[";
    
    bool first = true;
    for (int i = 0; i < n; i++) {
        int rssi = WiFi.RSSI(i);
        // Filter networks weaker than -80 dBm
        if (rssi >= -80) {
            if (!first) {
                json += ",";
            }
            first = false;
            String ssid = WiFi.SSID(i);
            ssid.replace("\"", "\\\"");
            json += "{\"ssid\":\"" + ssid + "\",\"rssi\":" + String(rssi) + "}";
        }
    }
    
    json += "]}";
    
    Serial.println("Publishing scan results:");
    Serial.println(json);
    
    mqtt.publishMessage("scan", json);
}

void MQTTcallback(char* topic, byte* payload, unsigned int length) {
    String message = String((char*)payload, length);
    Serial.println("Received MQTT message: " + message);
    
    // Trigger scan when command is received
    if (message == "scan" || message.length() > 0) {
        scanAndPublishNetworks();
    }
}


void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("Attempting setup WiFi");
    if(strlen(nonEnterpriseWifiPassword) < 2){
        Serial.println("Connecting to UCSD-PROTECTED...");
        wifi.connectToWPAEnterprise(wifiSsid, ucsdUsername, ucsdPassword);
    } else {
        Serial.println("Connecting to Non-Enterprise WiFi...");
        wifi.connectToWiFi(wifiSsid,nonEnterpriseWifiPassword);
    }
    delay(1000);
    // Connect to MQTT broker
    mqtt.connectToBroker();
    
    // Set up the callback function
    mqtt.setCallback(MQTTcallback);
    
    // Subscribe to the "command" topic
    mqtt.subscribeTopic("command");
    
}

void loop() {
    mqtt.loop(); 
}