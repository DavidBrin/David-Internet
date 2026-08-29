# Assignment Challenge 1: Robust Collection Client (50 pts)

https://youtube.com/shorts/6vwyfoDXOhc?feature=share its at the bottom too
## Description

Build a production-quality data collection system with both a CLI client and a web dashboard. Your client will be the tool you use to contribute your share of the class dataset.

**You must collect exactly 100 frames: 50 "empty" + 50 "present" and upload them to the Sophos API by Feb 15.**

## Setup

### CLI Client
```bash
cd python
cp ../../env.example ../../.env
# Edit .env with your student ID
uv run collection_client.py
```

### Web Dashboard
```bash
cd python
uv run server.py
```
Open http://localhost:8000 in your browser.

## Requirements

### 1. Robust API Client (15 pts)

- Auto-retry on API failures with exponential backoff
- Handle network errors gracefully
- Validate server responses
- Clear error messages when something goes wrong

### 2. Frame Validation (10 pts)

Before uploading, validate each frame:
- Exactly 64 pixel values
- All temperatures in valid range (0-80°C)
- No identical pixels (sensor error detection)
- Warn if labeling seems inconsistent (e.g., "present" but max_temp < 26°C)

### 3. Local CSV Backup (10 pts)

Save all uploaded frames to `my_collection.csv`:
- Columns: `timestamp, label, p0, p1, ..., p63`
- This is your backup if something goes wrong

### 4. Progress Tracking (5 pts)

Track progress toward the 50/50 goal:
- Display counts for empty and present frames
- Show remaining frames needed for each class
- Notify when goal is reached

### 5. Validation Script (10 pts)

Create `validate_collection.py` that:
- Loads your local CSV
- Reports total frames per class
- Verifies you have 50 empty + 50 present
- Flags potentially mislabeled frames (e.g., "present" but max_temp < 26°C)
- Generates a summary visualization (bar chart of class distribution)

## Web Dashboard

The `server.py` provides a real-time web interface for collecting frames:
- Live heatmap visualization from MQTT
- Chart.js progress chart showing collected vs target
- Empty/Present buttons (or keyboard shortcuts 0/1)
- Real-time stats updates via WebSocket

The dashboard has TODOs for you to complete in:
- `static/script.js`: WebSocket connection and collect function
- `server.py`: `/api/collect` endpoint

## Collection Protocol

To ensure dataset diversity, collect across multiple conditions:

| Label | Target | Tips |
|-------|--------|------|
| Empty | 50 | Vary: different rooms, lighting, times of day |
| Present | 50 | Vary: distances, poses, walking vs sitting |

**Tip:** Collect in sessions - don't try to do all 100 at once!

## API Payload

The simplified API only needs two fields:

```json
{
  "label": "empty",
  "pixels": [64 float values]
}
```

Your student ID is extracted from the Bearer token automatically.

## Deliverables

- `collection_client.py` - Your robust collection client
- `validate_collection.py` - Validation and summary script
- `server.py` - Web dashboard server
- `templates/index.html` - Dashboard HTML
- `static/style.css` - Dashboard styling
- `static/script.js` - Dashboard JavaScript
- `my_collection.csv` - Your local dataset backup (50 empty + 50 present)
- `README.md` - Setup instructions + YouTube video link

## Video Demo (2-3 min)
https://youtube.com/shorts/6vwyfoDXOhc?feature=share 

Show:
1. Your collection client receiving and labeling frames
2. At least one successful upload with retry (temporarily disconnect WiFi to show retry)
3. Your validation script output showing 50/50 balance
4. Progress tracking toward goal

## Grading Rubric

| Component | Points |
|-----------|--------|
| Robust API client with retry | 15 |
| Frame validation | 10 |
| Local CSV backup | 10 |
| Progress tracking | 5 |
| Validation script | 10 |
| **Total** | **50** |

**Bonus consideration:** Clean code, good error messages, thoughtful collection across varied conditions.
