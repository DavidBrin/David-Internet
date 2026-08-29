let ws;
let currentPixels = null;

function connect() {
    ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
        document.getElementById('status').textContent = 'Connected - Waiting for frames...';
        document.getElementById('status').className = 'connected';
    };

    ws.onclose = () => {
        document.getElementById('status').textContent = 'Disconnected';
        document.getElementById('status').className = 'disconnected';
        setTimeout(connect, 1000);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'frame') {
            currentPixels = data.pixels;
            renderHeatmap(data.pixels);
            document.getElementById('total').textContent = data.stats.total;
            document.getElementById('empty').textContent = data.stats.empty;
            document.getElementById('present').textContent = data.stats.present;
            document.getElementById('status').textContent = 'Frame received - Label it!';
        }
    };
}

function renderHeatmap(pixels) {
    const canvas = document.getElementById('heatmap');
    const ctx = canvas.getContext('2d');
    const cellSize = canvas.width / 8;

    const minTemp = Math.min(...pixels);
    const maxTemp = Math.max(...pixels);
    const range = maxTemp - minTemp || 1;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const temp = pixels[row * 8 + col];
            const norm = (temp - minTemp) / range;
            const r = Math.floor(255 * Math.min(1, norm * 2));
            const g = Math.floor(255 * Math.max(0, (norm - 0.5) * 2));
            const b = Math.floor(255 * (1 - norm));
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
    }
}

async function label(labelType) {
    if (!currentPixels) {
        document.getElementById('message').textContent = 'No frame to label';
        return;
    }

    const response = await fetch('/api/label', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({label: labelType, pixels: currentPixels})
    });

    const result = await response.json();
    document.getElementById('message').textContent = result.success
        ? `Labeled as ${labelType}!`
        : `Error: ${result.error}`;

    currentPixels = null;
}

document.addEventListener('keydown', (e) => {
    if (e.key === '0') label('empty');
    if (e.key === '1') label('present');
});

connect();
