/**
 * INTRUSION DETECTION SYSTEM - Arduino Uno R4 WiFi
 * 
 * MQTT Gateway for Intrusion Detection System
 * 
 * Features:
 * - Receives intrusion alerts from Arduino Uno via UART
 * - Connects to UCSD WiFi (WPA2-Enterprise)
 * - Publishes status to MQTT (HiveMQ Cloud)
 * - Subscribes to arm/disarm commands
 * - Implements smart throttling to reduce network load
 * 
 * UART Configuration:
 * - Serial1 RX (Pin 0) ← Arduino Uno Pin 2 (TX)
 * - Serial1 TX (Pin 1) → Arduino Uno Pin 5 (RX)
 * - Baud: 9600
 * 
 * MQTT Configuration:
 * - Broker: 2f776591c371410da94b9f5c569474b0.s1.eu.hivemq.cloud:8883 (TLS)
 * - Publish: alarm/status (state changes + heartbeat every 60s)
 * - Subscribe: alarm/cmd (arm/disarm commands)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "comm_protocol.h"
#include "secrets.h"

// ============================================
// CONFIGURATION
// ============================================

// UART pins (Arduino Uno R4 Serial1)
#define UART_BAUD 9600

// WiFi Connection
#define WIFI_SSID SECRETS_WIFI_SSID
#define WIFI_USERNAME SECRETS_WIFI_USERNAME
#define WIFI_PASSWORD SECRETS_WIFI_PASSWORD
#define WIFI_CONNECT_TIMEOUT_MS 20000

// MQTT Configuration
#define MQTT_BROKER SECRETS_MQTT_BROKER
#define MQTT_PORT SECRETS_MQTT_PORT
#define MQTT_USERNAME SECRETS_MQTT_USERNAME
#define MQTT_PASSWORD SECRETS_MQTT_PASSWORD
#define MQTT_STATUS_TOPIC SECRETS_MQTT_STATUS_TOPIC
#define MQTT_CMD_TOPIC SECRETS_MQTT_CMD_TOPIC

// Throttling and timing
#define HEARTBEAT_INTERVAL_MS 60000  // 60 second heartbeat

// Built-in LED
#define LED_BUILTIN 13

// ============================================
// STATE VARIABLES
// ============================================

WiFiClient wifi_client;  // Built-in WiFi client with TLS support on R4
PubSubClient mqtt_client(wifi_client);

bool wifi_connected = false;
bool mqtt_connected = false;
bool system_armed = true;  // System starts armed
unsigned long last_wifi_check = 0;
unsigned long last_heartbeat = 0;
unsigned long startup_time_ms = 0;

int last_published_state = -1;  // Track last published state to avoid duplicates

struct {
  uint32_t total_messages = 0;
  uint32_t total_alerts = 0;
  uint32_t failed_publishes = 0;
  uint32_t wifi_reconnects = 0;
  uint32_t mqtt_reconnects = 0;
} stats;

// Forward declarations
void mqttCallback(char* topic, byte* payload, unsigned int length);
void processArduinoMessage(String message);
void connectToWiFi();
void connectToMQTT();
void publishStatus(String arduino_message, bool force_publish);
void publishHeartbeat();

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(9600);   // USB debugging
  Serial1.begin(UART_BAUD);  // UART to Arduino Uno (RX=Pin0, TX=Pin1)
  
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  
  delay(2000);
  
  Serial.println(F("\n\n================================"));
  Serial.println(F("Arduino Uno R4 WiFi - Starting"));
  Serial.println(F("================================\n"));
  
  Serial.println(F("[R4] Serial1 initialized @ 9600 baud"));
  Serial.println(F("[R4] RX on Pin 0, TX on Pin 1"));
  
  startup_time_ms = millis();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup MQTT
  mqtt_client.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt_client.setCallback(mqttCallback);
  Serial.print(F("[MQTT] Broker: "));
  Serial.print(MQTT_BROKER);
  Serial.print(F(":"));
  Serial.println(MQTT_PORT);
  
  Serial.println(F("[R4] Setup complete, entering main loop"));
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  unsigned long now = millis();
  
  // Check WiFi connection every 10 seconds
  if (now - last_wifi_check > 10000) {
    last_wifi_check = now;
    if (!wifi_connected) {
      Serial.println(F("[R4] Attempting WiFi reconnect..."));
      connectToWiFi();
    }
  }
  
  // Connect/reconnect MQTT if WiFi is up
  if (wifi_connected && !mqtt_connected) {
    if (!mqtt_client.connected()) {
      connectToMQTT();
    }
  }
  
  // Keep MQTT connection alive and handle subscribed messages
  if (mqtt_connected) {
    mqtt_client.loop();
    
    // Send heartbeat every 60 seconds
    if (now - last_heartbeat > HEARTBEAT_INTERVAL_MS) {
      last_heartbeat = now;
      publishHeartbeat();
    }
  }
  
  // Receive messages from Arduino Uno
  while (Serial1.available()) {
    String message = Serial1.readStringUntil('\n');
    if (message.length() > 0) {
      processArduinoMessage(message);
    }
  }
  
  delay(50);  // Small delay to prevent CPU overload
}

// ============================================
// WIFI MANAGEMENT
// ============================================

void connectToWiFi() {
  Serial.print(F("[WiFi] Connecting to SSID: "));
  Serial.println(WIFI_SSID);
  
  // Arduino Uno R4 WiFi uses WiFiS3 library with personal hotspot
  // Standard WPA2/WPA3 Personal connection for iPhone hotspot
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  Serial.print(F("[WiFi] Waiting for connection"));
  unsigned long start_time = millis();
  int status = WiFi.status();
  
  // Wait for connection or timeout
  while (status != WL_CONNECTED && millis() - start_time < WIFI_CONNECT_TIMEOUT_MS) {
    delay(1000);  // Wait 1 second between checks
    status = WiFi.status();
    Serial.print(F("."));
  }
  
  Serial.println();  // New line after dots
  
  // Check final connection status
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    stats.wifi_reconnects++;
    Serial.println(F("[WiFi] Connection successful!"));
    Serial.print(F("[WiFi] IP: "));
    Serial.println(WiFi.localIP());
    Serial.print(F("[WiFi] Signal strength: "));
    Serial.print(WiFi.RSSI());
    Serial.println(F(" dBm"));
    digitalWrite(LED_BUILTIN, HIGH);  // LED on when connected
  } else {
    wifi_connected = false;
    Serial.println(F("[WiFi] Connection FAILED"));
    Serial.print(F("[WiFi] Status code: "));
    Serial.println(WiFi.status());
    Serial.println(F("[WiFi] Check: SSID name, password, hotspot availability"));
    Serial.println(F("[WiFi] Retrying in 10 seconds..."));
    digitalWrite(LED_BUILTIN, LOW);   // LED off when disconnected
  }
}

// ============================================
// MQTT CONNECTION & CALLBACKS
// ============================================

void connectToMQTT() {
  Serial.print(F("[MQTT] Connecting to broker..."));
  
  if (mqtt_client.connect("R4-Intrusion", MQTT_USERNAME, MQTT_PASSWORD)) {
    mqtt_connected = true;
    stats.mqtt_reconnects++;
    Serial.println(F(" Connected"));
    
    // Subscribe to command topic
    mqtt_client.subscribe(MQTT_CMD_TOPIC);
    Serial.print(F("[MQTT] Subscribed to "));
    Serial.println(MQTT_CMD_TOPIC);
    
    // Publish initial status
    publishHeartbeat();
  } else {
    mqtt_connected = false;
    Serial.print(F(" Failed (code: "));
    Serial.print(mqtt_client.state());
    Serial.println(F(")"));
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Handle incoming MQTT commands
  String cmd_topic = String(topic);
  String cmd = "";
  
  // Extract command from payload
  for (unsigned int i = 0; i < length; i++) {
    cmd += (char)payload[i];
  }
  
  Serial.print(F("[MQTT] Received command on "));
  Serial.print(topic);
  Serial.print(F(": "));
  Serial.println(cmd);
  
  // Parse command
  if (cmd.indexOf("arm") != -1) {
    system_armed = true;
    Serial.println(F("[SYSTEM] ARMED"));
    
    // Send command to Arduino to enable alarms
    sendCommandToArduino("arm");
    publishCommandStatus("armed");
  }
  else if (cmd.indexOf("disarm") != -1) {
    system_armed = false;
    Serial.println(F("[SYSTEM] DISARMED"));
    
    // Send command to Arduino to disable alarms
    sendCommandToArduino("disarm");
    publishCommandStatus("disarmed");
  }
}

// ============================================
// UART COMMUNICATION
// ============================================

void processArduinoMessage(String message) {
  if (message.length() < 10) return;  // Ignore short messages
  
  Serial.print(F("[Arduino] "));
  Serial.println(message);
  
  // Parse message type
  if (message.indexOf("\"type\":\"S\"") != -1) {
    // Status message
    stats.total_messages++;
    publishStatus(message, false);
  } 
  else if (message.indexOf("\"type\":\"A\"") != -1) {
    // Intrusion alert - high priority!
    stats.total_alerts++;
    
    // If system is disarmed, don't send alert
    if (!system_armed) {
      Serial.println(F("[MQTT] System disarmed - ignoring intrusion alert"));
      return;
    }
    
    publishStatus(message, true);
  }
}

void sendCommandToArduino(String cmd) {
  // Send command to Arduino via UART
  char message[64];
  snprintf(message, sizeof(message),
    "{\"type\":\"C\",\"cmd\":\"%s\"}\n", cmd.c_str());
  
  Serial1.print(message);
  Serial.print(F("[Arduino CMD] "));
  Serial.println(message);
}

// ============================================
// MQTT PUBLISHING
// ============================================

void publishStatus(String arduino_message, bool force_publish) {
  if (!mqtt_connected) {
    Serial.println(F("[MQTT] Not connected - status not published"));
    return;
  }
  
  // Extract state from Arduino message
  int state = -1;
  if (arduino_message.indexOf("\"st\":0") != -1) {
    state = 0;  // NORMAL
  } else if (arduino_message.indexOf("\"st\":1") != -1) {
    state = 1;  // ALERT
  }
  
  // Only publish if state changed OR force_publish is true (for alerts)
  if (state == -1 || (!force_publish && state == last_published_state)) {
    return;  // Don't publish duplicate status
  }
  
  last_published_state = state;
  
  // Build status JSON
  StaticJsonDocument<256> doc;
  doc["armed"] = system_armed;
  doc["state"] = state;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  // Publish to MQTT
  if (mqtt_client.publish(MQTT_STATUS_TOPIC, buffer)) {
    Serial.print(F("[MQTT] Published: "));
    Serial.println(buffer);
  } else {
    Serial.println(F("[MQTT] Publish failed"));
    stats.failed_publishes++;
  }
}

void publishHeartbeat() {
  if (!mqtt_connected) return;
  
  unsigned long uptime_s = (millis() - startup_time_ms) / 1000;
  
  StaticJsonDocument<256> doc;
  doc["type"] = "heartbeat";
  doc["armed"] = system_armed;
  doc["uptime"] = uptime_s;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt_client.publish(MQTT_STATUS_TOPIC, buffer);
}

void publishCommandStatus(String status) {
  if (!mqtt_connected) return;
  
  StaticJsonDocument<128> doc;
  doc["system_state"] = status;
  doc["timestamp"] = millis();
  
  char buffer[128];
  serializeJson(doc, buffer);
  
  mqtt_client.publish(MQTT_STATUS_TOPIC, buffer);
}

// ============================================
// END
// ============================================
