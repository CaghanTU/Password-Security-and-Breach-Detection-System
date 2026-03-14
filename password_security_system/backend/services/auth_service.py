import base64
import io
import uuid
from datetime import datetime, timedelta
from typing import Optional

import pyotp
import qrcode
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import services.audit_service as audit_service
from config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from database import User
from services.crypto_service import (
    derive_key,
    generate_kdf_salt,
    hash_password,
    verify_password,
)

# In-memory key store: (user_id, session_id) → AES-256 key bytes
# On server restart all sessions are invalidated (by design; use Redis in prod).
KEY_STORE: dict[tuple[int, str], bytes] = {}

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _is_locked_out(user: User) -> bool:
    if user.lockout_until and datetime.utcnow() < user.lockout_until:
        return True
    return False


def register(db: Session, username: str, master_password: str) -> tuple[User, str, str]:
    """Create a new user with mandatory 2FA.  master_password is NEVER stored — only its hash."""
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise ValueError("Username already taken")

    kdf_salt = generate_kdf_salt()
    pw_hash = hash_password(master_password)

    secret = pyotp.random_base32()

    user = User(
        username=username,
        password_hash=pw_hash,
        kdf_salt=kdf_salt,
        totp_secret=secret,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.username,
        issuer_name="PasswordSecuritySystem",
    )
    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    qr_data_uri = f"data:image/png;base64,{b64}"

    return user, qr_data_uri, secret


def login(
    db: Session,
    username: str,
    master_password: str,
    totp_code: Optional[str],
    ip: str,
) -> str:
    """
    Authenticate user and return a signed JWT stored as HttpOnly cookie value.

    Design notes:
    - Master password never stored; Argon2id used twice with separate salts:
      once for authentication (stored hash), once for key derivation (deterministic,
      never stored).
    - Derived encryption key lives only in KEY_STORE for the session duration.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise ValueError("Invalid credentials")

    if _is_locked_out(user):
        remaining = int((user.lockout_until - datetime.utcnow()).total_seconds() // 60) + 1
        raise PermissionError(f"Account locked. Try again in {remaining} minute(s).")

    if not verify_password(user.password_hash, master_password):
        user.failed_attempts = (user.failed_attempts or 0) + 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.lockout_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        db.commit()
        audit_service.log(db, user.id, "LOGIN_FAILED", ip)
        raise ValueError("Invalid credentials")

    # 2FA check — mandatory for all users
    if not user.totp_secret:
        raise ValueError("2FA is not set up. Please register again.")
    if not totp_code:
        raise ValueError("2FA code required")
    if not pyotp.TOTP(user.totp_secret).verify(totp_code):
        user.failed_attempts = (user.failed_attempts or 0) + 1
        db.commit()
        audit_service.log(db, user.id, "LOGIN_FAILED", ip)
        raise ValueError("Invalid 2FA code")

    # Reset lockout on successful login
    user.failed_attempts = 0
    user.lockout_until = None
    db.commit()

    session_id = str(uuid.uuid4())
    key = derive_key(master_password, user.kdf_salt)
    KEY_STORE[(user.id, session_id)] = key

    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "session_id": session_id,
        "jti": str(uuid.uuid4()),
        "exp": expire,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    audit_service.log(db, user.id, "LOGIN", ip)
    return token


def logout(db: Session, user_id: int, session_id: str, ip: str) -> None:
    """Remove only this session's encryption key from KEY_STORE."""
    KEY_STORE.pop((user_id, session_id), None)
    audit_service.log(db, user_id, "LOGOUT", ip)


def get_current_user_and_key(
    db: Session, token: str
) -> tuple[User, bytes]:
    """
    Validate JWT from cookie, return (user, encryption_key).
    Raises ValueError on any auth failure.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise ValueError("Invalid or expired token")

    user_id = int(payload["sub"])
    session_id = payload["session_id"]

    key = KEY_STORE.get((user_id, session_id))
    if key is None:
        raise ValueError("Session not found — please log in again")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    return user, key


# ── 2FA ────────────────────────────────────────────────────────────────

def setup_2fa(db: Session, user: User) -> tuple[str, str]:
    """
    Generate a TOTP secret, store it, and return (qr_data_uri, secret).
    The QR data URI is a base64-encoded PNG scannable by Google Authenticator / Authy.
    """
    secret = pyotp.random_base32()
    user.totp_secret = secret
    db.commit()

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.username,
        issuer_name="PasswordSecuritySystem",
    )

    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    qr_data_uri = f"data:image/png;base64,{b64}"

    audit_service.log(db, user.id, "2FA_ENABLED", None)
    return qr_data_uri, secret


def verify_2fa(user: User, code: str) -> bool:
    """Verify a TOTP code against the user's stored secret."""
    if not user.totp_secret:
        return False
    return pyotp.TOTP(user.totp_secret).verify(code)
