/**
 * UART COMMUNICATION PROTOCOL - Arduino Uno ↔ Arduino Uno R4 WiFi
 * 
 * Hardware Configuration:
 * - Arduino Uno Pin 5 (RX/SoftSerial RX) ← R4 WiFi Serial1 TX (Pin 1)
 * - Arduino Uno Pin 2 (TX/SoftSerial TX) → R4 WiFi Serial1 RX (Pin 0)
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
#define MSG_TYPE_ACK       'K'   // Acknowledgement from R4
#define MSG_TYPE_CONFIG    'C'   // Configuration update from R4
#define MSG_TYPE_ERROR     'E'   // Error message

// ============================================
// STATUS MESSAGE FORMAT (Arduino → R4)
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
// ALERT MESSAGE FORMAT (Arduino → R4)
// ============================================
// {
//   "type":"A",
//   "ts":12345,
//   "dist":25.5,
//   "st":1
// }

// ============================================
// ACK MESSAGE FORMAT (R4 → Arduino)
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
#define ARDUINO_RX_PIN 5    // Receives from R4
#define ARDUINO_TX_PIN 2    // Transmits to R4

// R4 WiFi UART pins
#define R4_RX_PIN 0      // Receives from Arduino
#define R4_TX_PIN 1      // Transmits to Arduino

#endif // COMM_PROTOCOL_H
