#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <time.h>
#include <Adafruit_AMG88xx.h>
#include "ECE140_WIFI.h"

Adafruit_AMG88xx amg;
float pixels[AMG88xx_PIXEL_ARRAY_SIZE];
ECE140_WIFI wifi;

// WiFi credentials
const char* ucsdUsername = UCSD_USERNAME;
String ucsdPassword = String(UCSD_PASSWORD);
const char* wifiSsid = WIFI_SSID;
const char* nonEnterpriseWifiPassword = NON_ENTERPRISE_WIFI_PASSWORD;

// NTP Server settings
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -28800;  // PST = UTC-8
const int daylightOffset_sec = 0;

// Timing variables for delayless programming
int lastSecond = -1;

void setup() {
    Serial.begin(115200);
    delay(2000);

    // Connect to WiFi
    if (strlen(nonEnterpriseWifiPassword) < 2) {
        wifi.connectToWPAEnterprise(wifiSsid, ucsdUsername, ucsdPassword);
    } else {
        wifi.connectToWiFi(wifiSsid, nonEnterpriseWifiPassword);
    }

    // Configure NTP time synchronization
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    Serial.println("[NTP] Waiting for time sync...");

    struct tm timeinfo;
    while (!getLocalTime(&timeinfo)) {
        Serial.print(".");
        delay(500);
    }
    Serial.println("\n[NTP] Time synchronized!");

    // Initialize AMG8833
    Wire.begin();
    if (!amg.begin()) {
        while (1) {
            Serial.println("{\"error\":\"AMG8833 not detected\"}");
            delay(1000);
        }
    }

    delay(100);  // Let sensor boot up
    Serial.println("{\"status\":\"Ready - sending at start of each second\"}");
}

void loop() {
    // Get current time
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        return;
    }

    int currentSecond = timeinfo.tm_sec;

    // Only send data at the START of each new second
    // This is delayless programming - we check if time has changed
    if (currentSecond != lastSecond) {
        lastSecond = currentSecond;

        // Read all 64 pixels at once
        amg.readPixels(pixels);
        float thermistor = amg.readThermistor();

        // Build JSON with timestamp
        Serial.print("{\"time\":\"");
        Serial.print(timeinfo.tm_hour);
        Serial.print(":");
        if (timeinfo.tm_min < 10) Serial.print("0");
        Serial.print(timeinfo.tm_min);
        Serial.print(":");
        if (timeinfo.tm_sec < 10) Serial.print("0");
        Serial.print(timeinfo.tm_sec);
        Serial.print("\",\"thermistor\":");
        Serial.print(thermistor, 2);
        Serial.print(",\"pixels\":[");

        for (int i = 0; i < AMG88xx_PIXEL_ARRAY_SIZE; i++) {
            Serial.print(pixels[i], 2);
            if (i < AMG88xx_PIXEL_ARRAY_SIZE - 1) Serial.print(",");
        }

        Serial.println("]}");
    }

    // No delay() here The loop runs continuously
    // and only sends data when a new second begins
}
