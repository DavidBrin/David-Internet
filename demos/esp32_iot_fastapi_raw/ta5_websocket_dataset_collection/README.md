[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/h9tot_76)
# Week 6: Edge AI Data Collection

Learn to build ML datasets by collecting and labeling thermal sensor data. The entire class will contribute to a shared dataset that we'll use for training an AI model in Week 7.

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

### API Documentation
https://sophos.ece140.site/docs

---

## Repository Structure

```
.
├── tutorial1_websocket_basics/         # Tutorial: WebSocket basics with FastAPI
│   ├── README.md
│   └── python/
│       ├── server.py
│       ├── templates/
│       │   └── index.html
│       ├── static/
│       │   ├── style.css
│       │   └── script.js
│       └── pyproject.toml
│
├── lab_challenge/                      # Lab: Labeling interface + API upload
│   ├── README.md
│   ├── esp32/                          # Complete ESP32 code provided
│   └── python/
│       ├── server.py                   # Starter code with TODOs
│       ├── templates/
│       │   └── index.html
│       ├── static/
│       │   ├── style.css
│       │   └── script.js
│       └── pyproject.toml
│
├── challenge1_collection_client/       # Assignment 1: Data collection (50 pts)
│   ├── README.md
│   ├── esp32/                          # Complete ESP32 code provided
│   └── python/
│       ├── collection_client.py        # Starter code with TODOs
│       ├── validate_collection.py
│       ├── server.py                   # Web dashboard with TODOs
│       ├── templates/
│       │   └── index.html
│       ├── static/
│       │   ├── style.css
│       │   └── script.js
│       └── pyproject.toml
│
└── challenge2_dataset_explorer/        # Assignment 2: Dashboard + WebSocket (50 pts)
    ├── README.md
    ├── esp32/                          # Complete ESP32 code provided
    └── python/
        ├── pyproject.toml
        └── explorer/
            ├── server.py               # Starter code with TODOs
            ├── templates/
            │   └── index.html
            └── static/
                ├── style.css
                └── script.js
```

---

## Grading

| Component | Points | Description |
|-----------|--------|-------------|
| Lab Challenge | Video checkoff | Labeling interface working (5 empty + 5 present = 10 frames) |
| Assignment 1 | 50 pts | Data collection client with 100 frames (50 empty + 50 present) |
| Assignment 2 | 50 pts | Dashboard with WebSocket + analysis |
| **Total** | **100 pts** | |

---

## Deadlines

| Deadline | Date | What's Due |
|----------|------|------------|
| **ML Data Collection** | **Feb 15, 11:59 PM** | 100 frames on Sophos API (50 empty + 50 present) |
| **Final Submission** | **Feb 19, 11:59 PM** | All code, videos, ANALYSIS.md |

**Important:** Your frames must be uploaded by Feb 15 so the collective dataset is ready for Week 7 ML training.

**Balance Requirement:** You must collect **50 "empty" frames** (no person) and **50 "present" frames** (person in view) for a balanced dataset.

---

## Extra Credit (OH Check-in Only)

Extra credit is available **only** through in-person OH check-in **before the deadline**.

**EC Option: Real-Time Frame Stream Visualization**
- WebSocket that streams actual thermal frames (not just stats)
- Live 8x8 heatmap visualization in browser updating in real-time

**Requirements:** Must demo in OH and explain implementation choices to Instructional Team.

---

## API Quick Reference

**Base URL:** `https://sophos.ece140.site`

**Authentication:** Bearer token with your student ID
```python
headers = {"Authorization": f"Bearer {student_id}"}
```

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /frames | Submit labeled frame |
| GET | /frames | List frames (paginated) |
| GET | /dataset/stats | View class-wide statistics |
| GET | /dataset/download | Download full CSV |
| GET | /dataset/sample | Random sample frames |
| POST | /feedback | Rate frame quality |

**Frame Payload (POST /frames):**
```json
{
  "label": "present",
  "pixels": [21.5, 22.0, ... (64 values)]
}
```

- `label`: Either `"empty"` or `"present"`
- `pixels`: Array of exactly 64 float values from the AMG8833 sensor
- Your student ID is automatically extracted from the Bearer token
