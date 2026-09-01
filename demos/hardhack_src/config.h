/**
 * CONFIG - Arduino Uno Intrusion Detection
 * 
 * Hardware Pin Mappings and Sensor Parameters
 */

#ifndef ARDUINO_CONFIG_H
#define ARDUINO_CONFIG_H

// ============================================
// SENSOR PINS
// ============================================

#define ULTRASONIC_TRIG_PIN 9    // HC-SR04 Trigger
#define ULTRASONIC_ECHO_PIN 10   // HC-SR04 Echo
#define SERVO_PIN 6              // Servo motor PWM
#define ALARM_PIN 7              // Buzzer/alarm
#define STATUS_LED_GREEN 3       // Green LED (normal)
#define STATUS_LED_RED 4         // Red LED (alert)
#define PRESENCE_SENSOR_PIN 8    // Optional presence sensor

// ============================================
// UART COMMUNICATION (to ESP32)
// ============================================

#define SOFT_SERIAL_RX_PIN 5     // Receives from ESP32
#define SOFT_SERIAL_TX_PIN 2     // Transmits to ESP32
#define UART_BAUD_RATE 9600

// ============================================
// SENSOR PARAMETERS
// ============================================

#define INTRUSION_THRESHOLD_CM 12.0     // Distance threshold for intrusion
#define MIN_DISTANCE_CM 2.0              // Minimum valid reading
#define MAX_DISTANCE_CM 200.0            // Maximum valid reading
#define READING_BUFFER_SIZE 2            // Smoothing buffer (reduced from 5)
#define INTRUSION_CONFIRMATION_COUNT 3   // Consecutive readings to confirm

// ============================================
// TIMING
// ============================================

#define SENSOR_READ_INTERVAL_MS 500      // Read frequency
#define STATE_ALERT_DELAY_MS 100         // Delay when transitioning to alert
#define STATUS_UPDATE_INTERVAL_MS 5000   // Send status to ESP32
#define ULTRASONIC_TIMEOUT_US 30000      // Echo timeout

// ============================================
// DEBUG
// ============================================

#define DEBUG_MODE 1
#define BAUD_SERIAL_DEBUG 9600

#endif // ARDUINO_CONFIG_H
