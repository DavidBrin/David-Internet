/**
 * UART COMMUNICATION PROTOCOL - Arduino Uno ↔ ESP32-S3-Mini
 * 
 * Hardware Configuration:
 * - Arduino Uno Pin 5 (RX/SoftSerial RX) ← ESP32 TX
 * - Arduino Uno Pin 2 (TX/SoftSerial TX) → ESP32 RX
 * - ESP32 Pin 3 (GPIO3 RX) ← Arduino TX
 * - ESP32 Pin 1 (GPIO1 TX) → Arduino RX
 * - GND connected between both boards
 * 
 * Baud Rate: 9600
 * Protocol: JSON over UART
 */

#ifndef COMM_PROTOCOL_H
#define COMM_PROTOCOL_H

// ============================================
// MESSAGE TYPES
// ============================================

#define MSG_TYPE_STATUS    'S'   // Status update from Arduino
#define MSG_TYPE_ALERT     'A'   // Intrusion alert from Arduino
#define MSG_TYPE_ACK       'K'   // Acknowledgement from ESP32
#define MSG_TYPE_CONFIG    'C'   // Configuration update from ESP32
#define MSG_TYPE_ERROR     'E'   // Error message

// ============================================
// STATUS MESSAGE FORMAT (Arduino → ESP32)
// ============================================
// {
//   "type":"S",
//   "ts":12345,
//   "dist":45.5,
//   "st":0,
//   "tl":1,
//   "up":120.5
// }

// ============================================
// ALERT MESSAGE FORMAT (Arduino → ESP32)
// ============================================
// {
//   "type":"A",
//   "ts":12345,
//   "dist":25.5,
//   "st":1
// }

// ============================================
// ACK MESSAGE FORMAT (ESP32 → Arduino)
// ============================================
// {
//   "type":"K",
//   "ok":1
// }

// ============================================
// UART SETTINGS
// ============================================

#define UART_BAUD_RATE 9600
#define UART_MESSAGE_TIMEOUT_MS 2000
#define MAX_MESSAGE_LENGTH 128

// Software Serial pins (Arduino Uno)
#define ARDUINO_RX_PIN 5    // Receives from ESP32
#define ARDUINO_TX_PIN 2    // Transmits to ESP32

// ESP32 UART pins (GPIO)
#define ESP32_RX_PIN 3      // GPIO3 - Receives from Arduino
#define ESP32_TX_PIN 1      // GPIO1 - Transmits to Arduino

#endif // COMM_PROTOCOL_H
