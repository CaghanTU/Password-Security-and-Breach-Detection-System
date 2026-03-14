from fastapi import APIRouter, Cookie, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

import services.auth_service as auth_service
import services.scoring_service as scoring_service
import services.password_service as password_service
import services.report_service as report_service
from database import get_db, Credential
from models.schemas import ScoreHistoryEntry, ScoreResponse, CategoryStats

router = APIRouter(prefix="/score", tags=["score"])

CATEGORIES = ["email", "banking", "social", "work", "other"]


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


@router.get("/by-category", response_model=list[CategoryStats])
def get_score_by_category(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user(token, db)
    creds = db.query(Credential).filter(Credential.user_id == user.id).all()
    result = []
    for cat in CATEGORIES:
        cat_creds = [c for c in creds if c.category == cat]
        result.append({
            "category": cat,
            "total": len(cat_creds),
            "weak": sum(1 for c in cat_creds if c.strength_label == "weak"),
            "breached": sum(1 for c in cat_creds if c.is_breached or getattr(c, "email_breached", False)),
            "stale": sum(1 for c in cat_creds if c.is_stale),
        })
    return result


@router.get("/report")
def download_report(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _get_user(token, db)
    score_data = scoring_service.calculate_score(db, user.id)
    credentials = password_service.get_credentials(db, user.id, key)
    pdf_bytes = report_service.generate_pdf(user.username, score_data, credentials)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=risk_report_{user.username}.pdf"},
    )
