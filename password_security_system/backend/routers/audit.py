from fastapi import APIRouter, Cookie, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

import services.audit_service as audit_service
import services.auth_service as auth_service
from database import get_db
from models.schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=AuditLogResponse)
def get_audit_log(
    page: int = 1,
    per_page: int = 20,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, _ = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 20

    return audit_service.get_logs(db, user.id, page, per_page)


@router.delete("", response_model=dict)
def delete_audit_log(
    date_from: Optional[str] = Query(default=None, description="ISO date, e.g. 2024-01-01"),
    date_to:   Optional[str] = Query(default=None, description="ISO date, e.g. 2024-12-31"),
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, _ = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    def _parse(s: str) -> Optional[datetime]:
        if not s:
            return None
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid date format: {s}")

    df = _parse(date_from)
    dt = _parse(date_to)

    # Ensure date_to covers the whole day if only a date is given
    if dt and dt.hour == 0 and dt.minute == 0 and dt.second == 0:
        from datetime import timedelta
        dt = dt.replace(hour=23, minute=59, second=59)

    deleted = audit_service.delete_logs(db, user.id, df, dt)
    audit_service.log(db, user.id, "AUDIT_CLEARED", None)
    return {"deleted": deleted}
