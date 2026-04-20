from fastapi import APIRouter, Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

import services.action_service as action_service
import services.auth_service as auth_service
from database import get_db
from models.schemas import ActionCenterResponse

router = APIRouter(prefix="/actions", tags=["actions"])


def _get_user(token, db):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.get("", response_model=ActionCenterResponse)
def get_action_center(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _get_user(token, db)
    return action_service.get_action_center(db, user.id, key)
