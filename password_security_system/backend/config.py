import os
from dotenv import load_dotenv

load_dotenv()

HIBP_API_KEY: str = os.getenv("HIBP_API_KEY", "")
JWT_SECRET: str = os.getenv("JWT_SECRET", "change_this_secret")
DB_URL: str = os.getenv("DB_URL", "sqlite:///./password_security.db")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_MINUTES: int = 60

# SMTP — leave empty to disable email notifications
SMTP_HOST: str = os.getenv("SMTP_HOST", "")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASS: str = os.getenv("SMTP_PASS", "")
ALERT_EMAIL: str = os.getenv("ALERT_EMAIL", "")  # recipient address for breach alerts
