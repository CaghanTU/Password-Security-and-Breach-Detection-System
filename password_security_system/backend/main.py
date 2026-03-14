import sys
import os

# Ensure backend/ is on the path so relative imports work correctly
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from database import create_tables
from routers import auth, passwords, breach, generator, score, export, audit
from config import JWT_SECRET

# ── Rate limiter ───────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Password Security & Breach Risk Analysis System",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — allow frontend origins ─────────────────────────────────────
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:8000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(passwords.router)
app.include_router(breach.router)
app.include_router(generator.router)
app.include_router(score.router)
app.include_router(export.router)
app.include_router(audit.router)

# ── Serve frontend build (production) ─────────────────────────────────
# After `npm run build`, the dist/ folder is served here
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
frontend_legacy = os.path.join(os.path.dirname(__file__), "..", "frontend")

if os.path.isdir(frontend_dist):
    # Serve built assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    # Catch-all: serve index.html for SPA routing
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
elif os.path.isdir(frontend_legacy):
    app.mount("/", StaticFiles(directory=frontend_legacy, html=True), name="frontend")


@app.on_event("startup")
def on_startup():
    create_tables()
