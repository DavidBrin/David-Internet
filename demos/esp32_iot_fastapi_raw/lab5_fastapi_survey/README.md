# Lab 5: FastAPI with HTML Templates and Static Files

In this lab, you'll learn how to serve HTML pages and static files (CSS, JavaScript) using FastAPI.

---

## Tutorial 1: FastAPI Setup for HTML and Static Files

This tutorial shows how to configure FastAPI to serve HTML templates and static files.

### Key Concepts

**1. Static Files** - CSS, JavaScript, images that don't change. Served from a directory.

**2. Templates** - HTML files that can include dynamic content using Jinja2.

### Running the Tutorial

```bash
cd tutorial1_fastapi_setup
uv run main.py
```

Open http://localhost:8000 in your browser.

### Code Explanation

**Setting up static files:**
```python
from fastapi.staticfiles import StaticFiles

# Mount static directory - files in ./static are served at /static URL
app.mount("/static", StaticFiles(directory="static"), name="static")
```

**Setting up templates:**
```python
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="templates")
```

**Returning a template:**
```python
from fastapi import Request
from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        request,
        "index.html",
        {"page_title": "Welcome", "message": "Hello!"}
    )
```

**Using variables in HTML (Jinja2):**
```html
<h1>{{ page_title }}</h1>
<p>{{ message }}</p>
```

**Linking static files in HTML (using url_for):**
```html
<link rel="stylesheet" href="{{ url_for('static', path='css/style.css') }}">
<script src="{{ url_for('static', path='js/script.js') }}"></script>
```

### Directory Structure

```
tutorial1_fastapi_setup/
├── main.py
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── script.js
```

---

## Tutorial 2: HTML/CSS Basics and Two Ways to Handle Forms

This tutorial covers basic HTML structure, CSS styling, and **two approaches** to form handling.

### Running the Tutorial

```bash
cd tutorial2_html_forms
uv run main.py
```

Open http://localhost:8000 in your browser.

### HTML Basics

Every HTML page has this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Page Title</title>
    <link rel="stylesheet" href="{{ url_for('static', path='css/style.css') }}">
</head>
<body>
    <!-- Your content goes here -->
</body>
</html>
```

The `url_for('static', path='...')` generates the correct URL for static files.

- `<!DOCTYPE html>` - Tells browser this is HTML5
- `<head>` - Contains metadata, title, CSS links
- `<body>` - Contains visible content

### CSS Basics

CSS styles HTML elements. Basic syntax:

```css
selector {
    property: value;
}
```

Examples:
```css
body {
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
}

h1 {
    color: #333;
}

.container {
    max-width: 500px;
    padding: 20px;
}
```

- `body`, `h1` - Element selectors (style all elements of that type)
- `.container` - Class selector (style elements with `class="container"`)

### HTML Forms

Forms collect user input and send it to the server.

```html
<form action="/submit" method="post">
    <label for="name">Name:</label>
    <input type="text" id="name" name="name" required>

    <label for="message">Message:</label>
    <textarea id="message" name="message"></textarea>

    <button type="submit">Submit</button>
</form>
```

- `action="/submit"` - Where to send the data
- `method="post"` - Send data in request body
- `name="..."` - The field name FastAPI receives

---

### Approach 1: SSR (Server-Side Rendering)

The server returns a **new HTML page**. The whole page reloads.

**FastAPI endpoint:**
```python
from fastapi import Form

@app.post("/submit-ssr", response_class=HTMLResponse)
async def handle_form_ssr(request: Request, name: str = Form(...), message: str = Form(...)):
    return templates.TemplateResponse(
        request,
        "result.html",
        {"name": name, "message": message}
    )
```

- `Form(...)` - Get value from form data (the `...` means required)

---

### Approach 2: Client-Side with JavaScript fetch()

JavaScript sends JSON to an API endpoint. The server returns JSON. JavaScript updates the page **without reloading**.

**FastAPI endpoint (returns JSON):**
```python
from pydantic import BaseModel

class MessageData(BaseModel):
    name: str
    message: str

@app.post("/submit-api")
async def handle_form_api(data: MessageData):
    return {
        "success": True,
        "name": data.name,
        "message": data.message
    }
```

**JavaScript (in static/js/script.js):**
```javascript
document.getElementById('api-form').addEventListener('submit', async function(event) {
    // Prevent page reload
    event.preventDefault();

    // Get form values
    const name = document.getElementById('name-api').value;
    const message = document.getElementById('message-api').value;

    // Send JSON to server
    const response = await fetch('/submit-api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name, message: message })
    });

    // Parse response and update page
    const data = await response.json();
    document.getElementById('result-name').textContent = data.name;
    document.getElementById('result-message').textContent = data.message;
    document.getElementById('api-result').style.display = 'block';
});
```

**HTML form (no action/method needed):**
```html
<form id="api-form">
    <input type="text" id="name-api" name="name" required>
    <textarea id="message-api" name="message"></textarea>
    <button type="submit">Submit</button>
</form>

<div id="api-result" style="display: none;">
    <p>Name: <span id="result-name"></span></p>
    <p>Message: <span id="result-message"></span></p>
</div>
```

---

## Lab Challenge: Survey Form (Both Approaches)

Create a survey form that works with both SSR and client-side JavaScript approaches.

### Requirements
1. **Work on Tutorial 1 and Tutorial 2**

2. **Inspect the network tab with tutorial 2** In the lab video talk about 1-2 sentences about the differences you realized in the network tab.

3. **Survey Page** (`/`) with TWO forms:
   - SSR form that submits to `/submit-ssr`
   - JavaScript form that submits to `/submit-api`
   - Both collect: name, favorite_color, feedback

4. **SSR Results Page** (`/submit-ssr`) - Server returns HTML with submitted data

5. **API Endpoint** (`/submit-api`) - Server returns JSON, JavaScript updates page

6. (Optional) **Styling** - Add CSS to make it look nice

### Getting Started

```bash
cd lab_challenge
uv run main.py
```

The starter code has:
- `main.py` - FastAPI app with TODOs to complete
- `templates/survey.html` - Form page template (needs both forms added)
- `templates/results.html` - SSR results page (needs variables displayed)
- `static/js/script.js` - JavaScript file (needs fetch code)
- `static/css/style.css` - Basic CSS (add more styles)

### What to Complete

**In `main.py`:**
1. Create a Pydantic model for survey data
2. Add GET route at `/` that serves `survey.html`
3. Add POST route at `/submit-ssr` (SSR - returns HTML template)
4. Add POST route at `/submit-api` (API - returns JSON)

**In `templates/survey.html`:**
- Add SSR form with `action="/submit-ssr"` and `method="post"`
- Add JavaScript form with `id="api-form"`

**In `templates/results.html`:**
- Display submitted data using `{{ variable_name }}`

**In `static/js/script.js`:**
- Add event listener for `api-form`
- Use `fetch()` to POST JSON to `/submit-api`
- Update the page with the response

**In `static/css/style.css`:**
- Add styles for form elements
