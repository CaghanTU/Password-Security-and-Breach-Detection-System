from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from database import AuditLog




def log(db: Session, user_id: int, action: str, ip: Optional[str]) -> None:
    """Write a single audit record for a critical user action."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        ip_address=ip,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()


def get_logs(
    db: Session, user_id: int, page: int = 1, per_page: int = 20
) -> dict:
    total = db.query(AuditLog).filter(AuditLog.user_id == user_id).count()
    items = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user_id)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"total": total, "page": page, "per_page": per_page, "items": items}


def delete_logs(
    db: Session,
    user_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> int:
    """Delete audit log entries. Returns the count of deleted rows."""
    q = db.query(AuditLog).filter(AuditLog.user_id == user_id)
    if date_from:
        q = q.filter(AuditLog.created_at >= date_from)
    if date_to:
        q = q.filter(AuditLog.created_at <= date_to)
    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return count
