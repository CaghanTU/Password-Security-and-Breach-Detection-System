from datetime import datetime

from sqlalchemy.orm import Session

from database import Credential, ScoreHistory


def calculate_score(db: Session, user_id: int) -> dict:
    """
    Risk score formula:
      score = 100
            − (5  × weak_count)
            − (8  × reused_count)
            − (15 × breached_credential_count)
            − (3  × stale_count)
            − (5  × breached_not_rotated_count)
      min 0
    
    Every call persists a row to score_history for trend visualisation.
    """
    creds = db.query(Credential).filter(Credential.user_id == user_id).all()

    weak_count = sum(1 for c in creds if c.strength_label == "weak")
    breached_count = sum(1 for c in creds if c.is_breached)
    email_breached_count = sum(1 for c in creds if getattr(c, "email_breached", False))
    stale_count = sum(1 for c in creds if c.is_stale)
    not_rotated_count = sum(1 for c in creds if c.breach_date_status == "not_rotated")

    # Same-user reuse: find hashes that appear more than once
    hashes = [c.reuse_hash for c in creds]
    reused_count = sum(1 for h in set(hashes) if hashes.count(h) > 1)

    deduction = (
        5 * weak_count
        + 8 * reused_count
        + 15 * breached_count
        + 10 * email_breached_count
        + 3 * stale_count
        + 5 * not_rotated_count
    )
    score = max(0, 100 - deduction)

    entry = ScoreHistory(
        user_id=user_id,
        score=score,
        calculated_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()

    return {
        "score": score,
        "breakdown": {
            "total_credentials": len(creds),
            "weak_count": weak_count,
            "reused_count": reused_count,
            "breached_count": breached_count,
            "email_breached_count": email_breached_count,
            "stale_count": stale_count,
            "not_rotated_count": not_rotated_count,
        },
    }


def get_history(db: Session, user_id: int) -> list[ScoreHistory]:
    return (
        db.query(ScoreHistory)
        .filter(ScoreHistory.user_id == user_id)
        .order_by(ScoreHistory.calculated_at.asc())
        .all()
    )
