from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Lab Challenge: Survey Form")

# Static files and templates are already set up for you
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# TODO 1: Create a Pydantic model for the survey data (name, favorite_color, feedback)
# Hint: class SurveyData(BaseModel): ...
class SurveyData(BaseModel):
    name: str
    favorite_color: str
    feedback: str


# TODO 2: Create a GET route at "/" that serves the survey.html template
# Hint: Use templates.TemplateResponse(request, "survey.html", {})
@app.get("/", response_class=HTMLResponse)
async def show_survey(request: Request):
    return templates.TemplateResponse(request, "survey.html", {})


# =============================================================================
# SSR Endpoint (Server-Side Rendering)
# =============================================================================

# TODO 3: Create a POST route at "/submit-ssr" that:
#   - Receives form data (name, favorite_color, feedback) using Form(...)
#   - Returns survey.html template with the results (same page, inline results)
# Hint: return templates.TemplateResponse(request, "survey.html",
#           {"ssr_result": {"name": name, "favorite_color": favorite_color, "feedback": feedback}})
@app.post("/submit-ssr", response_class=HTMLResponse)
async def submit_ssr(request: Request, name: str = Form(...), favorite_color: str = Form(...), feedback: str = Form(...)):
    return templates.TemplateResponse(
        request,
        "survey.html",
        {"ssr_result": {"name": name, "favorite_color": favorite_color, "feedback": feedback}}
    )


# =============================================================================
# API Endpoint (for JavaScript fetch)
# =============================================================================

# TODO 4: Create a POST route at "/submit-api" that:
#   - Receives JSON data using your Pydantic model
#   - Returns JSON response with the survey data
# Hint: async def submit_api(data: SurveyData):
#       return {"success": True, "name": data.name, ...}
@app.post("/submit-api")
async def submit_api(data: SurveyData):
    return {
        "success": True,
        "name": data.name,
        "favorite_color": data.favorite_color,
        "feedback": data.feedback
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
