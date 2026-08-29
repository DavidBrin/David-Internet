[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/imjA4Qo4)
# Week 3: Thermal Imaging & Delayless Programming

Learn how to interface with the AMG8833 thermal camera sensor and implement precise timing without blocking delays. You'll progress from basic serial communication to NTP-synchronized data transmission and MQTT-based request-response systems.

## Prerequisites

### Installing uv (Python Package Manager)

We use `uv` for Python dependency management. Install it first:

**macOS/Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

After installation, restart your terminal.

---

## Repository Structure

```
.
├── tutorial1_serial_delay/      # Tutorial: AMG8833 Serial with Delays
│   ├── esp32/
│   │   ├── src/main.cpp
│   │   └── platformio.ini
│   └── python/
│       ├── thermal_viewer.py
│       └── pyproject.toml
│
├── tutorial2_serial_ntp/        # Tutorial: AMG8833 Serial without Delays (NTP)
│   ├── esp32/
│   │   ├── src/main.cpp
│   │   ├── include/
│   │   ├── platformio.ini
│   │   └── env.example
│   └── python/
│       ├── thermal_viewer.py
│       └── pyproject.toml
│
├── challenge1_mqtt_thermal/     # Challenge 1: MQTT Thermal Data (50 pts)
│   ├── esp32/
│   │   ├── src/main.cpp
│   │   ├── include/
│   │   ├── platformio.ini
│   │   └── env.example
│   ├── python/
│   │   ├── thermal_viewer.py
│   │   └── pyproject.toml
│   └── README.md
│
└── challenge2_mqtt_request/     # Challenge 2: MQTT Request-Response (50 pts)
    ├── esp32/
    │   ├── src/main.cpp
    │   ├── include/
    │   ├── platformio.ini
    │   └── env.example
    ├── python/
    │   ├── thermal_controller.py
    │   └── pyproject.toml
    └── README.md
```
