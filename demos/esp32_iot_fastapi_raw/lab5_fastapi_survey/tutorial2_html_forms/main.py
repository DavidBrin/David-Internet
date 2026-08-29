from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Tutorial 2: HTML Forms")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# Pydantic model for JSON request body
class MessageData(BaseModel):
    name: str
    message: str


@app.get("/", response_class=HTMLResponse)
async def show_form(request: Request):
    """Serve the form page with both SSR and client-side examples."""
    return templates.TemplateResponse(request, "index.html", {})


# =============================================================================
# APPROACH 1: Server-Side Rendering (SSR) with Templates
# - Browser sends form data, server returns the SAME page with results
# - The page reloads but shows results inline (no separate results page)
# =============================================================================

@app.post("/submit-ssr", response_class=HTMLResponse)
async def handle_form_ssr(request: Request, name: str = Form(...), message: str = Form(...)):
    """
    SSR approach: Returns the same page with results included.

    Form(...) tells FastAPI to get these values from form data.
    The '...' means the field is required.
    """
    return templates.TemplateResponse(
        request,
        "index.html",
        {"ssr_result": {"name": name, "message": message}}
    )


# =============================================================================
# APPROACH 2: Client-Side with JavaScript fetch()
# - Browser sends JSON, server returns JSON
# - JavaScript updates the page WITHOUT reloading
# =============================================================================

@app.post("/submit-api")
async def handle_form_api(data: MessageData):
    """
    API approach: Returns JSON data.

    JavaScript on the client will use this data to update the page.
    """
    return {
        "success": True,
        "name": data.name,
        "message": data.message
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
