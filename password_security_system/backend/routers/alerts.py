from fastapi import APIRouter, Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

import services.auth_service as auth_service
from database import get_db, BreachAlert
from models.schemas import AlertEntry, AlertsResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _get_user(token, db):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.get("", response_model=AlertsResponse)
def get_alerts(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user(token, db)
    alerts = (
        db.query(BreachAlert)
        .filter(BreachAlert.user_id == user.id, BreachAlert.is_read == False)
        .order_by(BreachAlert.created_at.desc())
        .all()
    )
    return {"unread_count": len(alerts), "alerts": alerts}


@router.post("/read")
def mark_all_read(
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user(token, db)
    db.query(BreachAlert).filter(
        BreachAlert.user_id == user.id,
        BreachAlert.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Tüm bildirimler okundu olarak işaretlendi"}
