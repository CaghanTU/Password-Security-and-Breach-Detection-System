import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from database import create_tables
from routers import actions, auth, passwords, breach, generator, score, export, audit
from routers import alerts
from config import JWT_SECRET

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Password Security & Breach Risk Analysis System",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(passwords.router)
app.include_router(breach.router)
app.include_router(generator.router)
app.include_router(score.router)
app.include_router(export.router)
app.include_router(audit.router)
app.include_router(alerts.router)
app.include_router(actions.router)

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


@app.on_event("startup")
def on_startup():
    create_tables()
    _start_scheduler()


def _start_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from services.scheduler_service import run_breach_scan
        scheduler = BackgroundScheduler()
        scheduler.add_job(run_breach_scan, "cron", hour=3, minute=0)
        scheduler.start()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Scheduler could not start: %s", exc)
