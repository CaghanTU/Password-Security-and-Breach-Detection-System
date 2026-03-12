import os
from dotenv import load_dotenv

load_dotenv()

HIBP_API_KEY: str = os.getenv("HIBP_API_KEY", "")
JWT_SECRET: str = os.getenv("JWT_SECRET", "change_this_secret")
DB_URL: str = os.getenv("DB_URL", "sqlite:///./password_security.db")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_MINUTES: int = 60
