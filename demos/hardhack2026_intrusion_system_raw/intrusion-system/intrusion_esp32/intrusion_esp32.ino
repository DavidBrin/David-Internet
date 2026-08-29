/**
 * INTRUSION DETECTION SYSTEM - ESP32-S3-Mini
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
 * - GPIO3 (RX) ← Arduino Uno Pin 2 (TX)
 * - GPIO1 (TX) → Arduino Uno Pin 5 (RX)
 * - Baud: 9600
 * 
 * MQTT Configuration:
 * - Broker: 2f776591c371410da94b9f5c569474b0.s1.eu.hivemq.cloud:8883 (TLS)
 * - Publish: alarm/status (state changes + heartbeat every 60s)
 * - Subscribe: alarm/cmd (arm/disarm commands)
 */

#include <HardwareSerial.h>
#include <WiFi.h>
#include <esp_wpa2.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "comm_protocol.h"
#include "secrets.h"

// ============================================
// CONFIGURATION
// ============================================

#define UART_RX_PIN 18   // GPIO18 - Receives from Arduino (Arduino TX Pin 2)
#define UART_TX_PIN 17   // GPIO17 - Transmits to Arduino (Arduino RX Pin 5)
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
#define ALARM_DELAY_MS 2000           // 2 second delay when alarm turns on
#define ALARM_COOLDOWN_MS 2000        // 2 second delay after alarm turns off

// ============================================
// STATE VARIABLES
// ============================================

HardwareSerial arduino_serial(1);  // UART1 on GPIO1/3
WiFiClient wifi_client;
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
  Serial.begin(115200);  // USB debugging on built-in UART0
  delay(1000);
  
  Serial.println(F("\n\n================================"));
  Serial.println(F("ESP32-S3-Mini - Starting Up"));
  Serial.println(F("================================\n"));
  
  // Initialize UART to Arduino
  arduino_serial.begin(UART_BAUD, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);
  Serial.println(F("[UART] Initialized on GPIO1(RX)/GPIO3(TX) @ 9600 baud"));
  Serial.print(F("[UART] RX Pin: GPIO"));
  Serial.print(UART_RX_PIN);
  Serial.print(F(" | TX Pin: GPIO"));
  Serial.println(UART_TX_PIN);
  
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
  
  Serial.println(F("[ESP32] Setup complete, entering main loop"));
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
      Serial.println(F("[ESP32] Attempting WiFi reconnect..."));
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
      Serial.print(F("[MAIN] Heartbeat interval reached (60s) at "));
      Serial.print(now / 1000);
      Serial.println(F("s"));
      publishHeartbeat();
    }
  }
  
  // Receive messages from Arduino
  static String uart_buffer = "";
  
  while (arduino_serial.available()) {
    int raw_byte = arduino_serial.read();
    char c = (char)raw_byte;
    
    // Debug: Show raw bytes received
    Serial.print(F("[UART_RAW] Byte: "));
    Serial.print(raw_byte);
    Serial.print(F(" (char: '"));
    if (c >= 32 && c <= 126) {
      Serial.print(c);
    } else if (c == '\n') {
      Serial.print(F("LF"));
    } else if (c == '\r') {
      Serial.print(F("CR"));
    } else {
      Serial.print(F("?"));
    }
    Serial.println(F("')"));
    
    // Build message until newline
    if (c == '\n' || c == '\r') {
      if (uart_buffer.length() > 0) {
        Serial.print(F("[UART_COMPLETE] Message length: "));
        Serial.println(uart_buffer.length());
        Serial.print(F("[UART_COMPLETE] Content: '"));
        Serial.print(uart_buffer);
        Serial.println(F("'"));
        processArduinoMessage(uart_buffer);
        uart_buffer = "";
      }
    } else if (c != 0) {  // Ignore null bytes
      uart_buffer += c;
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
  
  WiFi.mode(WIFI_STA);
  
  // Check if using enterprise (WPA2) authentication
  if (strlen(WIFI_USERNAME) > 0) {
    Serial.println(F("[WiFi] Using WPA2-Enterprise authentication"));
    
    // Configure WPA2-Enterprise for UCSD
    esp_wifi_sta_wpa2_ent_set_identity((uint8_t *)WIFI_USERNAME, strlen(WIFI_USERNAME));
    esp_wifi_sta_wpa2_ent_set_username((uint8_t *)WIFI_USERNAME, strlen(WIFI_USERNAME));
    esp_wifi_sta_wpa2_ent_set_password((uint8_t *)WIFI_PASSWORD, strlen(WIFI_PASSWORD));
    esp_wifi_sta_wpa2_ent_enable();
    
    // Connect to WPA2-Enterprise network
    WiFi.begin(WIFI_SSID);
  } else {
    Serial.println(F("[WiFi] Using WPA2/WPA3 Personal authentication"));
    // Personal WiFi connection
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
  
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
  } else {
    wifi_connected = false;
    Serial.println(F("[WiFi] Connection FAILED"));
    Serial.print(F("[WiFi] Status code: "));
    Serial.println(WiFi.status());
    Serial.println(F("[WiFi] Check: SSID name, credentials, network availability"));
    Serial.println(F("[WiFi] Retrying in 10 seconds..."));
  }
}

// ============================================
// MQTT CONNECTION & CALLBACKS
// ============================================

void connectToMQTT() {
  Serial.print(F("[MQTT] Connecting to broker..."));
  
  if (mqtt_client.connect("ESP32-Intrusion", MQTT_USERNAME, MQTT_PASSWORD)) {
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
  
  // Parse command (expects ON or OFF)
  if (cmd.indexOf("ON") != -1) {
    system_armed = true;
    Serial.println(F("[SYSTEM] TURNED ON"));
    
    // Send command to Arduino to enable system
    sendCommandToArduino("ON");
    publishCommandStatus("on");
  }
  else if (cmd.indexOf("OFF") != -1) {
    system_armed = false;
    Serial.println(F("[SYSTEM] TURNED OFF"));
    
    // Send command to Arduino to disable system
    sendCommandToArduino("OFF");
    publishCommandStatus("off");
  }
}

// ============================================
// UART COMMUNICATION
// ============================================

void processArduinoMessage(String message) {
  if (message.length() < 10) {
    Serial.print(F("[Arduino] Message too short ("));
    Serial.print(message.length());
    Serial.println(F(" bytes) - ignoring"));
    return;  // Ignore short messages
  }
  
  Serial.print(F("[Arduino→ESP] Processing: "));
  Serial.println(message);
  
  // Parse message type
  if (message.indexOf("\"type\":\"S\"") != -1) {
    // Status message
    stats.total_messages++;
    Serial.print(F("[Arduino] Message type: STATUS | Total received: "));
    Serial.println(stats.total_messages);
    publishStatus(message, false);
  } 
  else if (message.indexOf("\"type\":\"A\"") != -1) {
    // Intrusion alert - high priority!
    stats.total_alerts++;
    Serial.print(F("[Arduino] Message type: ALERT (HIGH PRIORITY) | Total alerts: "));
    Serial.println(stats.total_alerts);
    
    // If system is disarmed, don't send alert
    if (!system_armed) {
      Serial.println(F("[Arduino] ⚠ System is OFF - alert suppressed by ESP32"));
      return;
    }
    
    publishStatus(message, true);
  }
  else {
    Serial.println(F("[Arduino_PARSE] ERROR: Unknown message type"));
    Serial.print(F("[Arduino_PARSE] Full message: '"));
    Serial.print(message);
    Serial.println(F("'"));
  }
}

void sendCommandToArduino(String cmd) {
  // Send command to Arduino via UART
  if (!arduino_serial) {
    Serial.println(F("[ERROR] Arduino UART not initialized!"));
    return;
  }
  
  char message[64];
  snprintf(message, sizeof(message),
    "{\"type\":\"C\",\"cmd\":\"%s\"}\n", cmd.c_str());
  
  // Debug: Show what we're sending byte-by-byte
  Serial.print(F("[→Arduino_RAW] Sending bytes: "));
  for (size_t i = 0; message[i] != 0; i++) {
    Serial.print((int)message[i]);
    Serial.print(F(" "));
  }
  Serial.println();
  
  size_t bytes_sent = arduino_serial.print(message);
  Serial.print(F("[→Arduino CMD] "));
  Serial.print(message);
  Serial.print(F(" (bytes sent: "));
  Serial.print(bytes_sent);
  Serial.println(F(")"));
}

// ============================================
// MQTT PUBLISHING
// ============================================

void publishStatus(String arduino_message, bool force_publish) {
  if (!mqtt_connected) {
    Serial.println(F("[MQTT] Not connected - status not published"));
    return;
  }
  
  Serial.print(F("[STATUS] Processing Arduino message: "));
  Serial.println(arduino_message);
  
  // Extract state from Arduino message
  int state = -1;
  if (arduino_message.indexOf("\"st\":0") != -1) {
    state = 0;  // NORMAL
    Serial.println(F("[STATUS] State detected: NORMAL"));
  } else if (arduino_message.indexOf("\"st\":1") != -1) {
    state = 1;  // ALERT
    Serial.println(F("[STATUS] State detected: ALERT"));
  } else {
    Serial.println(F("[STATUS] ERROR: Could not parse state from message"));
  }
  
  // Only publish if state changed OR force_publish is true (for alerts)
  if (state == -1) {
    Serial.println(F("[STATUS] Invalid state - not publishing"));
    return;
  }
  
  if (!force_publish && state == last_published_state) {
    Serial.print(F("[STATUS] State unchanged ("));
    Serial.print(state);
    Serial.println(F(") - not publishing (use force_publish for alerts)"));
    return;  // Don't publish duplicate status
  }
  
  Serial.print(F("[STATUS] Publishing state change: "));
  Serial.print(last_published_state);
  Serial.print(F(" -> "));
  Serial.println(state);
  
  last_published_state = state;
  
  // Build status JSON
  StaticJsonDocument<256> doc;
  doc["armed"] = system_armed;
  doc["state"] = state;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  // Publish to MQTT
  Serial.print(F("[MQTT→Broker] Publishing to '"));
  Serial.print(MQTT_STATUS_TOPIC);
  Serial.print(F("': "));
  Serial.println(buffer);
  
  if (mqtt_client.publish(MQTT_STATUS_TOPIC, buffer)) {
    Serial.println(F("[MQTT] ✓ Publish successful!"));
  } else {
    Serial.println(F("[MQTT] ✗ Publish FAILED"));
    stats.failed_publishes++;
  }
}

void publishHeartbeat() {
  if (!mqtt_connected) {
    Serial.println(F("[HEARTBEAT] MQTT not connected - skipping heartbeat"));
    return;
  }
  
  unsigned long uptime_s = (millis() - startup_time_ms) / 1000;
  
  StaticJsonDocument<256> doc;
  doc["type"] = "heartbeat";
  doc["armed"] = system_armed;
  doc["uptime"] = uptime_s;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  Serial.print(F("[HEARTBEAT] Publishing to '"));
  Serial.print(MQTT_STATUS_TOPIC);
  Serial.print(F("': "));
  Serial.println(buffer);
  
  if (mqtt_client.publish(MQTT_STATUS_TOPIC, buffer)) {
    Serial.println(F("[HEARTBEAT] ✓ Sent successfully"));
  } else {
    Serial.println(F("[HEARTBEAT] ✗ Send FAILED"));
  }
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
