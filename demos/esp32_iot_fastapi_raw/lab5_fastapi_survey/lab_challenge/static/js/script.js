// Client-side form submission using fetch()

document.getElementById('api-form').addEventListener('submit', async function(event) {
    // Prevent the default form submission (which would reload the page)
    event.preventDefault();

    // Get form values
    const name = document.getElementById('name-api').value;
    const favorite_color = document.getElementById('color-api').value;
    const feedback = document.getElementById('feedback-api').value;

    // Send data to server using fetch()
    const response = await fetch('/submit-api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            favorite_color: favorite_color,
            feedback: feedback
        })
    });

    // Parse JSON response
    const data = await response.json();

    // Update the page with the response (no reload!)
    document.getElementById('result-name').textContent = data.name;
    document.getElementById('result-color').textContent = data.favorite_color;
    document.getElementById('result-feedback').textContent = data.feedback;
    document.getElementById('api-result').style.display = 'block';
});
