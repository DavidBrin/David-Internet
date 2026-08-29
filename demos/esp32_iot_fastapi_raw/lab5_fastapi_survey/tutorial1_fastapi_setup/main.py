from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

app = FastAPI(title="Tutorial 1: FastAPI Setup")

# Mount static files directory. This makes files in ./static accessible at /static URL
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up Jinja2 templates. This tells FastAPI where to find HTML templates
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """
    Serve the home page using a template.

    The TemplateResponse requires:
    1. request - the incoming request object
    2. template name - the HTML file to render
    3. context dict - variables to pass to the template
    """
    return templates.TemplateResponse(
        request,
        "index.html",
        {"page_title": "Welcome", "message": "Hello from FastAPI!"}
    )


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
