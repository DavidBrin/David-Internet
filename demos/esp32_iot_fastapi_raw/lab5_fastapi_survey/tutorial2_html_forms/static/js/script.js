// Client-side form submission using fetch()

document.getElementById('api-form').addEventListener('submit', async function(event) {
    // Prevent the default form submission (which would reload the page)
    event.preventDefault();

    // Get form values
    const name = document.getElementById('name-api').value;
    const message = document.getElementById('message-api').value;

    // Send data to server using fetch()
    const response = await fetch('/submit-api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            message: message
        })
    });

    // Parse JSON response
    const data = await response.json();

    // Update the page with the response (no reload!)
    document.getElementById('result-name').textContent = data.name;
    document.getElementById('result-message').textContent = data.message;
    document.getElementById('api-result').style.display = 'block';
});
