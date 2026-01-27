from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, ORJSONResponse, Response
from pathlib import Path
from app.routers import api

app = FastAPI(
    title="Zotok API Tester",
    version="1.0.0",
    default_response_class=ORJSONResponse
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(api.router)


@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main HTML page"""
    html_file = Path("static/index.html")
    return html_file.read_text(encoding="utf-8")


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/favicon.ico")
async def favicon():
    """Return empty favicon to prevent 404 errors"""
    return Response(content=b"", media_type="image/x-icon")


@app.get("/.well-known/appspecific/com.chrome.devtools.json")
async def devtools_config():
    """Return empty config for Chrome DevTools to prevent 404 errors"""
    return {}
