const API_BASE = '';
let distributionChart = null;

async function fetchStats() {
    // TODO: Implement - fetch from /api/stats and update the page
    // - Update #total-frames, #empty-count, #present-count
    // - Update the distribution chart
    // - Update the leaderboard
    try {
        const data = await fetch('/api/stats').then(r => r.json());
        if (data.error) {
            document.getElementById('total-frames').textContent = data.error;
            document.getElementById('empty-count').textContent = '-';
            document.getElementById('present-count').textContent = '-';
            return;
        }
        const total = data.total_frames ?? data.total ?? 0;
        const empty = data.empty_count ?? data.empty ?? 0;
        const present = data.present_count ?? data.present ?? 0;
        document.getElementById('total-frames').textContent = total;
        document.getElementById('empty-count').textContent = empty;
        document.getElementById('present-count').textContent = present;
        if (distributionChart) {
            distributionChart.data.datasets[0].data = [empty, present];
            distributionChart.update();
        }
        const list = data.contributors ?? data.top_contributors ?? [];
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        list.slice(0, 20).forEach((row, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + (row.student_id ?? row.studentId ?? row.id ?? '') + '</td><td>' + (row.count ?? row.frames ?? 0) + '</td>';
            tbody.appendChild(tr);
        });
    } catch (e) {
        document.getElementById('total-frames').textContent = 'Error';
        document.getElementById('empty-count').textContent = '-';
        document.getElementById('present-count').textContent = '-';
    }
}

async function fetchSamples() {
    // TODO: Implement - fetch from /api/sample and render heatmaps
    // - Fetch 6 samples (3 empty, 3 present)
    // - Render each as an 8x8 canvas heatmap
    const gallery = document.getElementById('sample-gallery');
    gallery.innerHTML = '';
    try {
        const emptyData = await fetch('/api/sample?label=empty&n=3').then(r => r.json());
        const presentData = await fetch('/api/sample?label=present&n=3').then(r => r.json());
        if (emptyData && emptyData.error) {
            gallery.innerHTML = '<p>Error: ' + emptyData.error + '</p>';
            return;
        }
        if (presentData && presentData.error) {
            gallery.innerHTML = '<p>Error: ' + presentData.error + '</p>';
            return;
        }
        const emptyFrames = Array.isArray(emptyData) ? emptyData : (emptyData.frames || []);
        const presentFrames = Array.isArray(presentData) ? presentData : (presentData.frames || []);
        const all = [...emptyFrames, ...presentFrames];
        if (all.length === 0) {
            gallery.innerHTML = '<p>No samples available. Try again later.</p>';
            return;
        }
        all.forEach(frame => {
            const wrap = document.createElement('div');
            wrap.className = 'sample-frame';
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 120;
            const pixels = frame.pixels ?? frame;
            if (Array.isArray(pixels) && pixels.length === 64) {
                renderHeatmap(canvas, pixels, frame.label ?? '');
            }
            wrap.appendChild(canvas);
            const lbl = document.createElement('div');
            lbl.className = 'label';
            lbl.textContent = frame.label ?? '';
            wrap.appendChild(lbl);
            gallery.appendChild(wrap);
        });
    } catch (e) {
        gallery.innerHTML = '<p>Failed to load samples</p>';
    }
}

function renderHeatmap(canvas, pixels, label) {
    // TODO: Implement - draw an 8x8 heatmap on the canvas
    // - Each pixel is a colored rectangle
    // - Use a color scale (e.g., blue = cold, red = hot)
    // - Show the label below the canvas
    const ctx = canvas.getContext('2d');
    const cellSize = canvas.width / 8;
    const minT = Math.min(...pixels);
    const maxT = Math.max(...pixels);
    const range = maxT - minT || 1;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const temp = pixels[row * 8 + col];
            const norm = (temp - minT) / range;
            const r = Math.floor(255 * Math.min(1, norm * 2));
            const g = Math.floor(255 * Math.max(0, (norm - 0.5) * 2));
            const b = Math.floor(255 * (1 - norm));
            ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
    }
}

function connectWebSocket() {
    // TODO: Implement - connect to /ws/live
    // - Update #ws-status on connect/disconnect
    // - Parse incoming messages and update stats
    const ws = new WebSocket('ws://' + window.location.host + '/ws/live');
    ws.onopen = () => {
        document.getElementById('ws-status').textContent = 'Connected';
        document.getElementById('ws-status').className = 'connected';
    };
    ws.onclose = () => {
        document.getElementById('ws-status').textContent = 'Disconnected';
        document.getElementById('ws-status').className = 'disconnected';
        setTimeout(connectWebSocket, 1000);
    };
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.error) {
                document.getElementById('total-frames').textContent = data.error;
                document.getElementById('empty-count').textContent = '-';
                document.getElementById('present-count').textContent = '-';
                return;
            }
            const total = data.total_frames ?? data.total ?? 0;
            const empty = data.empty_count ?? data.empty ?? 0;
            const present = data.present_count ?? data.present ?? 0;
            document.getElementById('total-frames').textContent = total;
            document.getElementById('empty-count').textContent = empty;
            document.getElementById('present-count').textContent = present;
            if (distributionChart) {
                distributionChart.data.datasets[0].data = [empty, present];
                distributionChart.update();
            }
            const list = data.contributors ?? data.top_contributors ?? [];
            const tbody = document.getElementById('leaderboard-body');
            tbody.innerHTML = '';
            list.slice(0, 20).forEach((row, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + (row.student_id ?? row.studentId ?? row.id ?? '') + '</td><td>' + (row.count ?? row.frames ?? 0) + '</td>';
                tbody.appendChild(tr);
            });
        } catch (e) {}
    };
}

async function uploadFrame(formData) {
    // TODO: Implement - POST to /api/upload
    // - Show success/error in #upload-status
    const el = document.getElementById('upload-status');
    el.className = '';
    try {
        const r = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await r.json();
        if (data.error) {
            el.textContent = 'Error: ' + data.error;
            el.className = 'error';
        } else {
            el.textContent = 'Upload successful';
            el.className = 'success';
            fetchStats();
        }
    } catch (e) {
        el.textContent = 'Error: ' + e.message;
        el.className = 'error';
    }
}

function initChart() {
    const ctx = document.getElementById('distribution-chart').getContext('2d');
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Empty', 'Present'],
            datasets: [{
                label: 'Frame Count',
                data: [0, 0],
                backgroundColor: ['#2ecc71', '#e74c3c']
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    fetchStats();
    fetchSamples();
    connectWebSocket();

    document.getElementById('refresh-samples').addEventListener('click', fetchSamples);

    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;

        const pixelString = form.pixels.value;
        const pixels = pixelString.split(',').map(v => parseFloat(v.trim()));

        if (pixels.length !== 64 || pixels.some(isNaN)) {
            document.getElementById('upload-status').textContent = 'Error: Need exactly 64 numeric values';
            return;
        }

        const formData = {
            label: form.label.value,
            pixels: pixels
        };

        await uploadFrame(formData);
    });
});
