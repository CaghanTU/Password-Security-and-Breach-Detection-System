from fastapi import APIRouter, Cookie, Depends, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from starlette.requests import Request

import services.auth_service as auth_service
import services.breach_service as breach_service
from database import get_db
from models.schemas import BreachEmailRequest, BreachEmailResponse, BreachPasswordRequest, BreachPasswordResponse

router = APIRouter(prefix="/breach", tags=["breach"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/email", response_model=BreachEmailResponse)
@limiter.limit("10/minute")
def check_email(
    body: BreachEmailRequest,
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, _ = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    try:
        result = breach_service.check_email(db, body.email, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return result


@router.post("/password", response_model=BreachPasswordResponse)
def check_password(body: BreachPasswordRequest):
    try:
        return breach_service.check_password(body.password)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
