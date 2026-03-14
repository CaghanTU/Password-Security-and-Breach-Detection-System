from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

import services.auth_service as auth_service
from database import get_db
from models.schemas import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TwoFASetupResponse,
    TwoFAVerifyRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user, qr_image, secret = auth_service.register(db, body.username, body.master_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "User registered successfully", "qr_image": qr_image, "secret": secret}


@router.post("/login")
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    ip = _get_client_ip(request)
    try:
        token = auth_service.login(
            db, body.username, body.master_password, body.totp_code, ip
        )
    except PermissionError as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    import os
    is_prod = os.getenv("ENV", "dev").lower() == "prod"
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=is_prod,       # dev'de False: localhost HTTP üzerinde çalışır
        samesite="lax",       # strict cross-site sorun çıkarabilir
        max_age=auth_service.JWT_EXPIRE_MINUTES * 60,
    )
    return {"message": "Login successful"}


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    ip = _get_client_ip(request)
    if token:
        try:
            user, _ = auth_service.get_current_user_and_key(db, token)
            from jose import jwt as _jwt
            from config import JWT_SECRET, JWT_ALGORITHM
            payload = _jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            auth_service.logout(db, user.id, payload["session_id"], ip)
        except Exception:
            pass
    response.delete_cookie("token")
    return {"message": "Logged out"}


@router.post("/2fa/setup", response_model=TwoFASetupResponse)
def setup_2fa(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, _ = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    qr_uri, secret = auth_service.setup_2fa(db, user)
    return {"qr_image": qr_uri, "secret": secret}


@router.post("/2fa/verify", response_model=MessageResponse)
def verify_2fa(
    body: TwoFAVerifyRequest,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, _ = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    if not auth_service.verify_2fa(user, body.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
    return {"message": "2FA code is valid"}
