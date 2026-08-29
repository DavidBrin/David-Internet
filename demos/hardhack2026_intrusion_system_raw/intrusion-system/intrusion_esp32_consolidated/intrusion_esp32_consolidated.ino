/**
 * INTRUSION DETECTION SYSTEM - ESP32-S3-Mini CONSOLIDATED
 * 
 * All functionality (sensors + security + WiFi/MQTT) on single ESP32-S3-Mini board
 * No UART/inter-board communication - direct hardware control
 * 
 * Sensors:
 * - HC-SR04 Ultrasonic Distance Sensor
 * - VCNL4040 Proximity Sensor (I2C)
 * 
 * Security Hardware:
 * - Servo Motor (door lock control)
 * - Buzzer (alarm)
 * - LEDs (green=normal, red=alert)
 * 
 * Networking:
 * - WiFi: UCSD-PROTECTED (WPA2-Enterprise) or personal hotspot
 * - MQTT: Public HiveMQ broker at broker.hivemq.com:1883
 * - Topics: ucsd/hardhack/brent/status (publish)
 *           ucsd/hardhack/brent/command (subscribe)
 */

#include <WiFi.h>
#include <esp_wpa2.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <FastLED.h>
#include "SparkFun_VCNL4040_Arduino_Library.h"
#include "secrets.h"

// ============================================
// GPIO PIN ASSIGNMENTS
// ============================================

// Ultrasonic Sensor (HC-SR04)
#define TRIG_PIN 2
#define ECHO_PIN 3

// Security Hardware
#define SERVO_PIN 6
#define ALARM_PIN 7
#define LED_GREEN 8
#define LED_RED 9

// I2C for Proximity Sensor (VCNL4040)
#define I2C_SDA 21
#define I2C_SCL 26

// LED Strip (WS2812 / NeoPixel)
#define LED_STRIP_PIN 5
#define NUM_LEDS 30
#define LED_TYPE WS2812
#define COLOR_ORDER GRB

// ============================================
// CONFIGURATION
// ============================================

// WiFi
#define WIFI_SSID SECRETS_WIFI_SSID
#define WIFI_USERNAME SECRETS_WIFI_USERNAME
#define WIFI_PASSWORD SECRETS_WIFI_PASSWORD
#define WIFI_CONNECT_TIMEOUT_MS 20000

// MQTT
#define MQTT_BROKER SECRETS_MQTT_BROKER
#define MQTT_PORT SECRETS_MQTT_PORT
#define MQTT_USERNAME SECRETS_MQTT_USERNAME
#define MQTT_PASSWORD SECRETS_MQTT_PASSWORD
#define MQTT_STATUS_TOPIC SECRETS_MQTT_STATUS_TOPIC
#define MQTT_CMD_TOPIC SECRETS_MQTT_CMD_TOPIC

// Sensor Configuration
#define THRESHOLD_CM 11.0
#define MIN_DISTANCE 2.0
#define MAX_DISTANCE 200.0
#define INTRUSION_CONFIRMATION 3
#define SENSOR_INTERVAL_MS 500
#define STATE_ALERT_DELAY_MS 100

// Proximity Sensor (VCNL4040)
#define PROX_INTEGRATION_TIME 8
#define PROX_LED_CURRENT 200

// Timing
#define HEARTBEAT_INTERVAL_MS 60000
#define STATE_CHANGE_THRESHOLD_MS 2000

// ============================================
// STATE MACHINE & VARIABLES
// ============================================

enum SecurityState { STATE_NORMAL = 0, STATE_ALERT = 1, STATE_LOCKDOWN = 2, STATE_ERROR = 3 };

// Security State
SecurityState current_state = STATE_NORMAL;
SecurityState previous_state = STATE_NORMAL;
bool system_armed = true;
unsigned long system_start_ms = 0;
unsigned long last_state_change = 0;
unsigned long last_alarm_deactivate = 0;

// Sensor Data
float current_distance = 0.0;
float distance_buffer[2] = {0.0, 0.0};
uint8_t buffer_index = 0;
uint8_t consecutive_readings = 0;
unsigned long last_sensor_read = 0;

// Proximity Sensor
VCNL4040 proximitySensor;
long prox_baseline = 0;
long prox_delta_threshold = 0;
bool motion_detected = false;

// LED Strip
CRGB leds[NUM_LEDS];
unsigned long last_led_update = 0;
uint8_t led_color_state = 0;  // 0=red, 1=green, 2=blue

// WiFi & MQTT
WiFiClient wifi_client;
PubSubClient mqtt_client(wifi_client);
bool wifi_connected = false;
bool mqtt_connected = false;
unsigned long last_wifi_check = 0;
unsigned long last_heartbeat = 0;
int last_published_state = -1;

// Statistics
struct {
  uint32_t total_messages = 0;
  uint32_t total_alerts = 0;
  uint32_t failed_publishes = 0;
  uint32_t wifi_reconnects = 0;
  uint32_t mqtt_reconnects = 0;
} stats;

// Forward Declarations
void mqttCallback(char* topic, byte* payload, unsigned int length);
void connectToWiFi();
void connectToMQTT();
void publishStatus(bool force_publish);
void publishHeartbeat();

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println(F("\n\n================================"));
  Serial.println(F("ESP32-S3-Mini - Consolidated System"));
  Serial.println(F("================================\n"));
  
  // Initialize pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(SERVO_PIN, OUTPUT);
  pinMode(ALARM_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  
  // Start with green LED
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  digitalWrite(ALARM_PIN, LOW);
  
  system_start_ms = millis();
  
  Serial.println(F("[SYSTEM] GPIO initialized"));
  Serial.print(F("[GPIO] TRIG="));
  Serial.print(TRIG_PIN);
  Serial.print(F(" ECHO="));
  Serial.print(ECHO_PIN);
  Serial.print(F(" SERVO="));
  Serial.print(SERVO_PIN);
  Serial.print(F(" ALARM="));
  Serial.println(ALARM_PIN);
  
  // Initialize I2C for VCNL4040
  Serial.println(F("[I2C] Initializing on GPIO21(SDA)/GPIO26(SCL)..."));
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);
  
  if (proximitySensor.begin() == false) {
    Serial.println(F("[ERROR] VCNL4040 not found on I2C!"));
    Serial.println(F("[ERROR] Check: VDD=3.3V, GND, SDA=21, SCL=26"));
  } else {
    Serial.println(F("[I2C] VCNL4040 detected at 0x60"));
    proximitySensor.setLEDCurrent(PROX_LED_CURRENT);
    proximitySensor.setProxIntegrationTime(PROX_INTEGRATION_TIME);
    
    // Calibrate baseline
    prox_baseline = 0;
    for (byte x = 0; x < 8; x++) {
      prox_baseline += proximitySensor.getProximity();
      delay(5);
    }
    prox_baseline /= 8;
    prox_delta_threshold = (long)((float)prox_baseline * 0.05f);
    if (prox_delta_threshold < 5) prox_delta_threshold = 5;
    
    Serial.print(F("[I2C] Prox baseline: "));
    Serial.print(prox_baseline);
    Serial.print(F(" | Delta threshold: "));
    Serial.println(prox_delta_threshold);
  }
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup MQTT
  mqtt_client.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt_client.setCallback(mqttCallback);
  Serial.print(F("[MQTT] Broker: "));
  Serial.print(MQTT_BROKER);
  Serial.print(F(":"));
  Serial.println(MQTT_PORT);
  
  // Initialize LED Strip
  FastLED.addLeds<LED_TYPE, LED_STRIP_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(100);
  Serial.print(F("[LED_STRIP] Initialized on GPIO"));
  Serial.print(LED_STRIP_PIN);
  Serial.print(F(" with "));
  Serial.print(NUM_LEDS);
  Serial.println(F(" LEDs"));
  
  Serial.println(F("[SYSTEM] Setup complete, entering main loop\n"));
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  unsigned long now = millis();
  
  // WiFi connection check every 10 seconds
  if (now - last_wifi_check > 10000) {
    last_wifi_check = now;
    if (!wifi_connected) {
      Serial.println(F("[WIFI] Attempting reconnect..."));
      connectToWiFi();
    }
  }
  
  // MQTT connection/reconnection
  if (wifi_connected && !mqtt_connected) {
    if (!mqtt_client.connected()) {
      connectToMQTT();
    }
  }
  
  // Keep MQTT alive
  if (mqtt_connected) {
    mqtt_client.loop();
    
    // Heartbeat every 60 seconds
    if (now - last_heartbeat > HEARTBEAT_INTERVAL_MS) {
      last_heartbeat = now;
      Serial.print(F("[HEARTBEAT] Triggered at "));
      Serial.print(now / 1000);
      Serial.println(F("s"));
      publishHeartbeat();
    }
  }
  
  // Read sensors at interval
  if (now - last_sensor_read >= SENSOR_INTERVAL_MS) {
    last_sensor_read = now;
    
    // Read ultrasonic distance
    float raw_distance = readUltrasonicDistance();
    if (raw_distance > 0 && raw_distance >= MIN_DISTANCE && raw_distance <= MAX_DISTANCE) {
      current_distance = applyMovingAverage(raw_distance);
    }
    
    // Read proximity
    readProximitySensor();
    
    // Update intrusion detection
    updateIntrusionStatus();
  }
  
  // Update LED strip every 1 second (aesthetic, runs in background)
  if (now - last_led_update >= 1000) {
    last_led_update = now;
    updateLEDStrip();
  }
  
  delay(50);
}

// ============================================
// SENSOR READING - ULTRASONIC
// ============================================

float readUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1.0;
  
  return duration * 0.01715;  // 0.0343 / 2
}

float applyMovingAverage(float new_distance) {
  distance_buffer[buffer_index] = new_distance;
  buffer_index = (buffer_index + 1) % 2;
  
  return (distance_buffer[0] + distance_buffer[1]) / 2.0;
}

// ============================================
// SENSOR READING - PROXIMITY
// ============================================

void readProximitySensor() {
  unsigned int prox_value = proximitySensor.getProximity();
  motion_detected = (prox_value > (prox_baseline + prox_delta_threshold));
}

// ============================================
// LED STRIP CONTROL
// ============================================

void updateLEDStrip() {
  // Aesthetic color cycling: Red → Green → Blue (every 1 second)
  switch (led_color_state) {
    case 0:  // Red
      fill_solid(leds, NUM_LEDS, CRGB::Red);
      led_color_state = 1;
      break;
    case 1:  // Green
      fill_solid(leds, NUM_LEDS, CRGB::Green);
      led_color_state = 2;
      break;
    case 2:  // Blue
      fill_solid(leds, NUM_LEDS, CRGB::Blue);
      led_color_state = 0;
      break;
  }
  FastLED.show();
}

// ============================================
// INTRUSION DETECTION
// ============================================

void updateIntrusionStatus() {
  bool distance_alert = (current_distance < THRESHOLD_CM);
  
  if (distance_alert || motion_detected) {
    consecutive_readings++;
    
    if (consecutive_readings >= INTRUSION_CONFIRMATION && current_state == STATE_NORMAL) {
      setSecurityState(STATE_ALERT);
    }
  } else {
    consecutive_readings = 0;
    if (current_state == STATE_ALERT) {
      setSecurityState(STATE_NORMAL);
    }
  }
}

void setSecurityState(SecurityState new_state) {
  if (new_state != current_state) {
    previous_state = current_state;
    current_state = new_state;
    last_state_change = millis();
    
    Serial.print(F("[STATE] "));
    Serial.print(previous_state);
    Serial.print(F(" → "));
    Serial.println(new_state);
    
    // Activate security measures
    if (current_state == STATE_ALERT) {
      if (system_armed) {
        delay(STATE_ALERT_DELAY_MS);
        activateAlarm();
        digitalWrite(LED_RED, HIGH);
        digitalWrite(LED_GREEN, LOW);
        Serial.println(F("[ALERT] INTRUSION DETECTED - ALARM ACTIVATED"));
        publishStatus(true);  // Force publish alerts
        last_alarm_deactivate = millis();
      } else {
        Serial.println(F("[ALERT] Intrusion detected but SYSTEM OFF - alarm suppressed"));
        digitalWrite(LED_RED, LOW);
        digitalWrite(LED_GREEN, HIGH);
      }
    } else if (current_state == STATE_NORMAL) {
      deactivateAlarm();
      delay(2000);
      digitalWrite(LED_RED, LOW);
      digitalWrite(LED_GREEN, HIGH);
      Serial.println(F("[NORMAL] Alarm deactivated, system normal"));
      publishStatus(true);  // Force publish state change
      last_alarm_deactivate = millis();
    }
  }
}

void activateAlarm() {
  digitalWrite(ALARM_PIN, HIGH);
  Serial.println(F("[ALARM] ACTIVATED"));
}

void deactivateAlarm() {
  digitalWrite(ALARM_PIN, LOW);
  Serial.println(F("[ALARM] Deactivated"));
}

// ============================================
// WIFI MANAGEMENT
// ============================================

void connectToWiFi() {
  Serial.print(F("[WIFI] Connecting to: "));
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  
  // Check for enterprise authentication
  if (strlen(WIFI_USERNAME) > 0) {
    Serial.println(F("[WIFI] Using WPA2-Enterprise"));
    
    esp_wifi_sta_wpa2_ent_set_identity((uint8_t *)WIFI_USERNAME, strlen(WIFI_USERNAME));
    esp_wifi_sta_wpa2_ent_set_username((uint8_t *)WIFI_USERNAME, strlen(WIFI_USERNAME));
    esp_wifi_sta_wpa2_ent_set_password((uint8_t *)WIFI_PASSWORD, strlen(WIFI_PASSWORD));
    esp_wifi_sta_wpa2_ent_enable();
    WiFi.begin(WIFI_SSID);
  } else {
    Serial.println(F("[WIFI] Using Personal (WPA2/WPA3)"));
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
  
  Serial.print(F("[WIFI] Waiting"));
  unsigned long start_time = millis();
  int status = WiFi.status();
  
  while (status != WL_CONNECTED && millis() - start_time < WIFI_CONNECT_TIMEOUT_MS) {
    delay(1000);
    status = WiFi.status();
    Serial.print(F("."));
  }
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    stats.wifi_reconnects++;
    Serial.println(F("[WIFI] ✓ Connected!"));
    Serial.print(F("[WIFI] IP: "));
    Serial.println(WiFi.localIP());
    Serial.print(F("[WIFI] Signal: "));
    Serial.print(WiFi.RSSI());
    Serial.println(F(" dBm"));
  } else {
    wifi_connected = false;
    Serial.println(F("[WIFI] ✗ Connection FAILED"));
    Serial.print(F("[WIFI] Status: "));
    Serial.println(WiFi.status());
  }
}

// ============================================
// MQTT CONNECTION & CALLBACKS
// ============================================

void connectToMQTT() {
  Serial.print(F("[MQTT] Connecting..."));
  
  if (mqtt_client.connect("ESP32-Intrusion", MQTT_USERNAME, MQTT_PASSWORD)) {
    mqtt_connected = true;
    stats.mqtt_reconnects++;
    Serial.println(F(" ✓ Connected"));
    
    mqtt_client.subscribe(MQTT_CMD_TOPIC);
    Serial.print(F("[MQTT] Subscribed to: "));
    Serial.println(MQTT_CMD_TOPIC);
    
    publishHeartbeat();
  } else {
    mqtt_connected = false;
    Serial.print(F(" ✗ Failed (code: "));
    Serial.print(mqtt_client.state());
    Serial.println(F(")"));
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String cmd_topic = String(topic);
  String cmd = "";
  
  for (unsigned int i = 0; i < length; i++) {
    cmd += (char)payload[i];
  }
  
  Serial.print(F("[MQTT] Command on "));
  Serial.print(topic);
  Serial.print(F(": "));
  Serial.println(cmd);
  
  if (cmd.indexOf("ON") != -1) {
    system_armed = true;
    Serial.println(F("[SYSTEM] TURNED ON"));
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
    deactivateAlarm();
  } 
  else if (cmd.indexOf("OFF") != -1) {
    system_armed = false;
    Serial.println(F("[SYSTEM] TURNED OFF"));
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, LOW);
    deactivateAlarm();
    if (current_state == STATE_ALERT) {
      current_state = STATE_NORMAL;
    }
  }
}

// ============================================
// MQTT PUBLISHING
// ============================================

void publishStatus(bool force_publish) {
  if (!mqtt_connected) {
    Serial.println(F("[MQTT] Not connected - status not published"));
    return;
  }
  
  // Only publish on state change or if forced
  if (!force_publish && current_state == last_published_state) {
    return;
  }
  
  last_published_state = current_state;
  
  // Build JSON
  StaticJsonDocument<256> doc;
  doc["armed"] = system_armed;
  doc["state"] = current_state;
  doc["distance"] = current_distance;
  doc["motion"] = motion_detected;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  Serial.print(F("[MQTT→] Publishing to '"));
  Serial.print(MQTT_STATUS_TOPIC);
  Serial.print(F("': "));
  Serial.println(buffer);
  
  if (mqtt_client.publish(MQTT_STATUS_TOPIC, buffer)) {
    Serial.println(F("[MQTT] ✓ Publish successful"));
  } else {
    Serial.println(F("[MQTT] ✗ Publish FAILED"));
    stats.failed_publishes++;
  }
}

void publishHeartbeat() {
  if (!mqtt_connected) {
    Serial.println(F("[HEARTBEAT] MQTT not connected - skipping"));
    return;
  }
  
  unsigned long uptime_s = (millis() - system_start_ms) / 1000;
  
  StaticJsonDocument<256> doc;
  doc["type"] = "heartbeat";
  doc["armed"] = system_armed;
  doc["state"] = current_state;
  doc["uptime"] = uptime_s;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  Serial.print(F("[HEARTBEAT→] Publishing to '"));
  Serial.print(MQTT_STATUS_TOPIC);
  Serial.print(F("': "));
  Serial.println(buffer);
  
  if (mqtt_client.publish(MQTT_STATUS_TOPIC, buffer)) {
    Serial.println(F("[HEARTBEAT] ✓ Sent successfully"));
  } else {
    Serial.println(F("[HEARTBEAT] ✗ Send FAILED"));
  }
}

// ============================================
// END
// ============================================
