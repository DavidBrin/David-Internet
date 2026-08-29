/**
 * INTRUSION DETECTION SYSTEM - Arduino Uno Main
 * 
 * This is the primary controller that monitors the ultrasonic sensor
 * and communicates with ESP32 for WiFi-based status updates.
 * 
 * UART Communication:
 * - Pin 2: TX to ESP32 (GPIO3)
 * - Pin 5: RX from ESP32 (GPIO1)
 * - Baud: 9600
 */

#include <SoftwareSerial.h>
#include <Wire.h>
#include "SparkFun_VCNL4040_Arduino_Library.h"
#include "./comm_protocol.h"

// ============================================
// CONFIGURATION
// ============================================

#define TRIG_PIN 9
#define ECHO_PIN 10
#define SERVO_PIN 6
#define ALARM_PIN 7
#define LED_GREEN 3
#define LED_RED 4

// Sensor smoothing (reduced from 5 to 2 for faster response)
const uint8_t READING_BUFFER_SIZE = 2;
float distance_buffer[READING_BUFFER_SIZE];
uint8_t buffer_index = 0;

#define THRESHOLD_CM 12.0
#define MIN_DISTANCE 2.0
#define MAX_DISTANCE 200.0
#define INTRUSION_CONFIRMATION 3
#define SENSOR_INTERVAL_MS 500
#define STATE_ALERT_DELAY_MS 100  // Small delay when transitioning to alert

// ============================================
// STATE VARIABLES
// ============================================

enum SecurityState { STATE_NORMAL, STATE_ALERT, STATE_LOCKDOWN, STATE_ERROR };

SecurityState current_state = STATE_NORMAL;
SecurityState previous_state = STATE_NORMAL;
bool system_armed = true;  // System starts armed
uint8_t consecutive_readings = 0;
unsigned long last_sensor_read = 0;
unsigned long last_state_change = 0;
unsigned long last_alarm_deactivate = 0;  // Track when alarm was last deactivated
unsigned long system_start_ms = 0;

float current_distance = 0.0;

// Software Serial for ESP32 communication
SoftwareSerial esp32_serial(ARDUINO_RX_PIN, ARDUINO_TX_PIN);  // RX on 5, TX on 2

// VCNL4040 Proximity Sensor (I2C on A4/A5)
VCNL4040 proximitySensor;
long prox_baseline = 0;
long prox_delta_threshold = 0;
bool motion_detected = false;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(9600);      // USB debugging
  esp32_serial.begin(9600); // ESP32 communication
  
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
  
  Serial.println(F("[ARDUINO] Intrusion Detection System - Started"));
  Serial.println(F("[ARDUINO] UART → ESP32 on pins 2(TX), 5(RX)"));
  
  // Initialize I2C for VCNL4040 proximity sensor
  Serial.println(F("[ARDUINO] Initializing I2C and VCNL4040 proximity sensor..."));
  Wire.begin();              // I2C master on Uno (SDA=A4, SCL=A5)
  Wire.setClock(100000);     // 100kHz for reliability
  
  if (proximitySensor.begin() == false) {
    Serial.println(F("[ARDUINO] ERROR: VCNL4040 not found on I2C!"));
    Serial.println(F("[ARDUINO] Check: VDD=3.3V, GND, SDA=A4, SCL=A5, pull-ups"));
    // Continue anyway - use distance sensor only
  } else {
    Serial.println(F("[ARDUINO] VCNL4040 detected on I2C (0x60)"));
    proximitySensor.setLEDCurrent(200);      // 200mA IR LED
    proximitySensor.setProxIntegrationTime(8); // Integration time 8
    
    // Calibrate baseline proximity (8 readings averaged)
    prox_baseline = 0;
    for (byte x = 0; x < 8; x++) {
      prox_baseline += proximitySensor.getProximity();
      delay(5);
    }
    prox_baseline /= 8;
    prox_delta_threshold = (long)((float)prox_baseline * 0.05f); // 5% change
    if (prox_delta_threshold < 5) prox_delta_threshold = 5;
    
    Serial.print(F("[ARDUINO] Prox baseline: "));
    Serial.print(prox_baseline);
    Serial.print(F(" | Delta threshold: "));
    Serial.println(prox_delta_threshold);
  }
  
  delay(500);
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  unsigned long now = millis();
  
  // Read sensors at interval
  if (now - last_sensor_read >= SENSOR_INTERVAL_MS) {
    last_sensor_read = now;
    
    // Read ultrasonic distance sensor
    float raw_distance = readUltrasonicDistance();
    if (raw_distance > 0 && raw_distance >= MIN_DISTANCE && raw_distance <= MAX_DISTANCE) {
      // Apply smoothing (reduced buffer for faster response)
      current_distance = applyMovingAverage(raw_distance);
    }
    
    // Read proximity sensor
    readProximitySensor();
    
    // Update intrusion detection (checks both sensors)
    updateIntrusionStatus(current_distance);
  }
  
  // Send periodic status to ESP32
  if (now - last_state_change >= 5000) {
    sendStatusToESP32();
    last_state_change = now;
  }
  
  // Check for commands from ESP32
  if (esp32_serial.available()) {
    handleESP32Command();
  }
  
  delay(10);
}

// ============================================
// SENSOR READING
// ============================================

float readUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1.0;
  
  return duration * 0.01715;  // Pre-calculated: 0.0343 / 2
}

float applyMovingAverage(float new_distance) {
  distance_buffer[buffer_index] = new_distance;
  buffer_index = (buffer_index + 1) % READING_BUFFER_SIZE;
  
  float sum = 0.0;
  for (uint8_t i = 0; i < READING_BUFFER_SIZE; i++) {
    sum += distance_buffer[i];
  }
  return sum / READING_BUFFER_SIZE;
}

void readProximitySensor() {
  unsigned int prox_value = proximitySensor.getProximity();
  motion_detected = (prox_value > (prox_baseline + prox_delta_threshold));
  
  // Debug output (optional - remove if too verbose)
  // Serial.print(F("[PROX] Value: "));
  // Serial.print(prox_value);
  // Serial.print(F(" | Motion: "));
  // Serial.println(motion_detected ? F("YES") : F("NO"));
}

// ============================================
// INTRUSION DETECTION
// ============================================

void updateIntrusionStatus(float distance) {
  // Check both distance sensor AND proximity sensor
  bool distance_alert = (distance < THRESHOLD_CM);
  
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
    
    Serial.print(F("[ARDUINO] State: "));
    Serial.print(previous_state);
    Serial.print(F(" → "));
    Serial.println(new_state);
    
    // Activate security measures with delays and armed state check
    if (current_state == STATE_ALERT) {
      // Check if system is armed before activating alarm
      if (system_armed) {
        delay(STATE_ALERT_DELAY_MS);  // 2 second delay when alarm turns on
        activateAlarm();
        digitalWrite(LED_RED, HIGH);
        digitalWrite(LED_GREEN, LOW);
        sendIntrusionAlertToESP32();
        last_alarm_deactivate = millis();  // Start cooldown timer
      } else {
        Serial.println(F("[ARDUINO] Intrusion detected but system DISARMED - alarm suppressed"));
        digitalWrite(LED_RED, LOW);
        digitalWrite(LED_GREEN, HIGH);
      }
    } else if (current_state == STATE_NORMAL) {
      deactivateAlarm();
      delay(2000);  // 2 second delay after alarm turns off
      digitalWrite(LED_RED, LOW);
      digitalWrite(LED_GREEN, HIGH);
      last_alarm_deactivate = millis();  // Reset cooldown
    }
  }
}

void activateAlarm() {
  digitalWrite(ALARM_PIN, HIGH);
  Serial.println(F("[ARDUINO] ALARM ACTIVATED"));
}

void deactivateAlarm() {
  digitalWrite(ALARM_PIN, LOW);
  Serial.println(F("[ARDUINO] Alarm deactivated"));
}

// ============================================
// COMMUNICATION WITH ESP32
// ============================================

void sendStatusToESP32() {
  // Format compact JSON status message
  // {"type":"S","ts":12345,"dist":45.5,"st":0,"up":120}
  
  char message[128];
  unsigned long uptime_s = (millis() - system_start_ms) / 1000;
  
  // Use dtostrf for safer floating point conversion
  char dist_str[8];
  dtostrf(current_distance, 5, 1, dist_str);
  
  snprintf(message, sizeof(message),
    "{\"type\":\"S\",\"ts\":%lu,\"dist\":%s,\"st\":%d,\"up\":%lu}\n",
    millis(), dist_str, current_state, uptime_s);
  
  // Debug: Show what we're sending byte-by-byte
  Serial.print(F("[Arduino_SEND_RAW] Bytes: "));
  for (size_t i = 0; message[i] != 0; i++) {
    Serial.print((int)message[i]);
    Serial.print(F(" "));
  }
  Serial.println();
  
  esp32_serial.print(message);
  Serial.print(F("[→ESP32] "));
  Serial.println(message);
}

void sendIntrusionAlertToESP32() {
  // High-priority intrusion alert
  // {"type":"A","ts":12345,"dist":25.5,"st":1}
  
  char message[96];
  
  // Use dtostrf for safer floating point conversion
  char dist_str[8];
  dtostrf(current_distance, 5, 1, dist_str);
  
  snprintf(message, sizeof(message),
    "{\"type\":\"A\",\"ts\":%lu,\"dist\":%s,\"st\":1}\n",
    millis(), dist_str);
  
  // Debug: Show what we're sending byte-by-byte
  Serial.print(F("[Arduino_ALERT_RAW] Bytes: "));
  for (size_t i = 0; message[i] != 0; i++) {
    Serial.print((int)message[i]);
    Serial.print(F(" "));
  }
  Serial.println();
  
  esp32_serial.print(message);
  Serial.print(F("[→ESP32 ALERT] "));
  Serial.println(message);
}

void handleESP32Command() {
  String command = esp32_serial.readStringUntil('\n');
  Serial.print(F("[←ESP32] "));
  Serial.println(command);
  
  // Parse command from JSON: {"type":"C","cmd":"ON"} or {"type":"C","cmd":"OFF"}
  if (command.indexOf("\"cmd\":\"ON\"") != -1) {
    system_armed = true;
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
    Serial.println(F("[ARDUINO] SYSTEM ON"));
    deactivateAlarm();  // Ensure alarm is off when turning on
  }
  else if (command.indexOf("\"cmd\":\"OFF\"") != -1) {
    system_armed = false;
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, LOW);  // Both LEDs off when turned off
    Serial.println(F("[ARDUINO] SYSTEM OFF"));
    deactivateAlarm();  // Turn off alarm immediately when turning off
    if (current_state == STATE_ALERT) {
      current_state = STATE_NORMAL;  // Force back to normal without delay
    }
  }
}

// ============================================
// END
// ============================================
