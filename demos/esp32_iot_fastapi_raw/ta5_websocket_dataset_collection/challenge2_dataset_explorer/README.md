# Assignment Challenge 2: Dataset Explorer Dashboard (50 pts)

## Description

Build a FastAPI dashboard that interacts with the Sophos API to visualize and analyze the collective class dataset. Your dashboard should support both reading data AND uploading new frames.

The dashboard uses **client-side rendering (CSR)** with JavaScript fetch() calls - no complex Jinja templating required. Jinja is only used to serve the static HTML shell.

## Setup

```bash
cd python
cp ../../env.example .env
# Edit .env with your student ID
uv run explorer/server.py
```

Then open http://localhost:8000 in your browser.

## Requirements

### 1. FastAPI Backend (20 pts)

Your server must provide these endpoints:

**REST Endpoints (proxy to Sophos API):**
```
GET /api/stats      → Fetch and return dataset stats from Sophos
GET /api/sample     → Fetch random sample frames from Sophos
POST /api/upload    → Proxy frame upload to Sophos API
```

**WebSocket Endpoint:**
```
WebSocket /ws/live  → Push live stats updates to connected clients
```

The WebSocket should:
- Accept client connections
- Periodically fetch stats from Sophos API (every 5-10 seconds)
- Push updated stats to all connected clients

### 2. Dashboard Frontend (20 pts)

The HTML page should display (all rendered client-side with JavaScript):

1. **Class Distribution Chart** - Bar chart showing empty vs present counts
   - Use Chart.js
   - Updates via WebSocket

2. **Contributor Leaderboard** - Top contributors by frame count
   - Table showing student_id and count
   - Updates via WebSocket

3. **Sample Frame Gallery** - 8x8 heatmap visualizations
   - Use HTML Canvas to render thermal frames
   - Show 3 empty + 3 present samples
   - Button to refresh samples

4. **Upload Form** - Submit new frames
   - Form with all required fields
   - Submit via fetch() POST to your API
   - Show success/error messages

### 3. Analysis (10 pts)

Create `ANALYSIS.md` answering these questions with supporting data:

1. Is the dataset balanced? If not, what problems could this cause for ML training?
2. What temperature threshold separates "empty" from "present"? Show a histogram.
3. Find 3 likely mislabeled frames. Show them (as heatmaps) and explain why.
4. How does data vary across students? Compare 3 student_ids.

## Starter Code Structure

```
explorer/
├── server.py           # FastAPI app with REST + WebSocket endpoints
├── templates/
│   └── index.html      # Static HTML shell + JavaScript
└── static/
    └── style.css       # Basic styling
```

## Deliverables

- `explorer/server.py` - FastAPI server with all endpoints
- `explorer/templates/index.html` - Dashboard HTML + JavaScript
- `explorer/static/style.css` - Styling
- `ANALYSIS.md` - Analysis answers with visualizations
- `README.md` - Setup instructions + YouTube video link

## Video Demo (2-3 min)

Show:
1. Dashboard loading with live data
2. Charts updating via WebSocket
3. Sample frame gallery with heatmaps
4. Uploading a frame via the form
5. Walk through your ANALYSIS.md findings

## Grading Rubric

| Component | Points |
|-----------|--------|
| REST API endpoints | 10 |
| WebSocket live updates | 10 |
| Dashboard visualizations | 15 |
| Analysis questions | 10 |
| Code quality | 5 |
| **Total** | **50** |

## Tips

- Start with the REST endpoints - get `/api/stats` working first
- Use Chart.js CDN: `https://cdn.jsdelivr.net/npm/chart.js`
- For canvas heatmaps, create a function that takes 64 pixels and draws an 8x8 grid
- The WebSocket can use `asyncio.sleep()` between polls to Sophos API
- Keep the JavaScript simple - vanilla JS with fetch() is fine
