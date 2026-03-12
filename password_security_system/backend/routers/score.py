from fastapi import APIRouter, Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

import services.auth_service as auth_service
import services.scoring_service as scoring_service
from database import get_db
from models.schemas import ScoreHistoryEntry, ScoreResponse

router = APIRouter(prefix="/score", tags=["score"])


def _get_user(token, db):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.get("", response_model=ScoreResponse)
def get_score(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user(token, db)
    return scoring_service.calculate_score(db, user.id)


@router.get("/history", response_model=list[ScoreHistoryEntry])
def get_score_history(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user(token, db)
    return scoring_service.get_history(db, user.id)
