let ws;

function connect() {
    ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
        document.getElementById('status').textContent = 'Connected';
        document.getElementById('status').className = 'connected';
    };

    ws.onclose = () => {
        document.getElementById('status').textContent = 'Disconnected';
        document.getElementById('status').className = 'disconnected';
        setTimeout(connect, 1000);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'counter') {
                document.getElementById('counter').textContent = data.value;
                return;
            }
        } catch {}

        const div = document.createElement('div');
        div.textContent = event.data;
        document.getElementById('messages').appendChild(div);
        document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
    };
}

function send() {
    const input = document.getElementById('message');
    if (input.value && ws.readyState === WebSocket.OPEN) {
        ws.send(input.value);
        input.value = '';
    }
}

document.getElementById('message').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send();
});

connect();
