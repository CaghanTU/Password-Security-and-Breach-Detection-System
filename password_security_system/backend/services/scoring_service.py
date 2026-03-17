from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from database import Credential, ScoreHistory

STALE_DAYS = 90
HISTORY_MIN_INTERVAL_MINUTES = 10


def _is_stale_credential(credential: Credential) -> bool:
    ref = credential.updated_at or credential.created_at
    if ref is None:
        return False
    return (datetime.utcnow() - ref) > timedelta(days=STALE_DAYS)


def _safe_ratio(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return count / total


def calculate_score(db: Session, user_id: int) -> dict:
    """
    V2 normalized risk score formula:
      base_risk = (0.30 * weak_ratio)
                + (0.10 * medium_ratio)
                + (0.20 * reused_ratio)
                + (0.25 * breach_any_ratio)
                + (0.10 * stale_ratio)
                + (0.05 * not_rotated_ratio)

      base_score = round(100 * (1 - base_risk))
      bonus = round(8 * totp_ratio) + round(5 * unique_ratio)
      score = clamp(base_score + bonus, 0, 100)

    Score history persistence is throttled to avoid noisy duplicates.
    """
    creds = db.query(Credential).filter(Credential.user_id == user_id).all()
    total_credentials = len(creds)

    if total_credentials == 0:
        score = 100
        breakdown = {
            "model_version": "v2",
            "total_credentials": 0,
            "weak_count": 0,
            "medium_count": 0,
            "reused_count": 0,
            "breached_count": 0,
            "email_breached_count": 0,
            "breach_any_count": 0,
            "stale_count": 0,
            "not_rotated_count": 0,
            "totp_enabled_count": 0,
            "weak_ratio": 0.0,
            "medium_ratio": 0.0,
            "reused_ratio": 0.0,
            "breach_any_ratio": 0.0,
            "stale_ratio": 0.0,
            "not_rotated_ratio": 0.0,
            "totp_ratio": 0.0,
            "unique_ratio": 0.0,
            "base_score": 100,
            "bonus_totp": 0,
            "bonus_unique": 0,
            "bonus_total": 0,
        }
    else:
        weak_count = sum(1 for c in creds if c.strength_label == "weak")
        medium_count = sum(1 for c in creds if c.strength_label == "medium")
        breached_count = sum(1 for c in creds if c.is_breached)
        email_breached_count = sum(1 for c in creds if getattr(c, "email_breached", False))
        breach_any_count = sum(1 for c in creds if c.is_breached or getattr(c, "email_breached", False))
        stale_count = sum(1 for c in creds if _is_stale_credential(c))
        not_rotated_count = sum(1 for c in creds if c.breach_date_status == "not_rotated")
        totp_enabled_count = sum(1 for c in creds if bool(getattr(c, "totp_secret", None)))

        hashes = [c.reuse_hash for c in creds if c.reuse_hash]
        hash_counts = Counter(hashes)
        reused_count = sum(count - 1 for count in hash_counts.values() if count > 1)
        unique_ratio = _safe_ratio(len(hash_counts), total_credentials)

        weak_ratio = _safe_ratio(weak_count, total_credentials)
        medium_ratio = _safe_ratio(medium_count, total_credentials)
        reused_ratio = _safe_ratio(reused_count, total_credentials)
        breach_any_ratio = _safe_ratio(breach_any_count, total_credentials)
        stale_ratio = _safe_ratio(stale_count, total_credentials)
        not_rotated_ratio = _safe_ratio(not_rotated_count, total_credentials)
        totp_ratio = _safe_ratio(totp_enabled_count, total_credentials)

        weighted_risk = (
            0.30 * weak_ratio
            + 0.10 * medium_ratio
            + 0.20 * reused_ratio
            + 0.25 * breach_any_ratio
            + 0.10 * stale_ratio
            + 0.05 * not_rotated_ratio
        )
        base_score = round(100 * (1 - weighted_risk))

        bonus_totp = round(8 * totp_ratio)
        bonus_unique = round(5 * unique_ratio)
        bonus_total = bonus_totp + bonus_unique
        score = max(0, min(100, base_score + bonus_total))

        breakdown = {
            "model_version": "v2",
            "total_credentials": total_credentials,
            "weak_count": weak_count,
            "medium_count": medium_count,
            "reused_count": reused_count,
            "breached_count": breached_count,
            "email_breached_count": email_breached_count,
            "breach_any_count": breach_any_count,
            "stale_count": stale_count,
            "not_rotated_count": not_rotated_count,
            "totp_enabled_count": totp_enabled_count,
            "weak_ratio": round(weak_ratio, 4),
            "medium_ratio": round(medium_ratio, 4),
            "reused_ratio": round(reused_ratio, 4),
            "breach_any_ratio": round(breach_any_ratio, 4),
            "stale_ratio": round(stale_ratio, 4),
            "not_rotated_ratio": round(not_rotated_ratio, 4),
            "totp_ratio": round(totp_ratio, 4),
            "unique_ratio": round(unique_ratio, 4),
            "base_score": base_score,
            "bonus_totp": bonus_totp,
            "bonus_unique": bonus_unique,
            "bonus_total": bonus_total,
        }

    now = datetime.utcnow()
    last_entry = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.user_id == user_id)
        .order_by(ScoreHistory.calculated_at.desc())
        .first()
    )
    should_persist = True
    if last_entry and last_entry.score == score:
        should_persist = (now - last_entry.calculated_at) >= timedelta(minutes=HISTORY_MIN_INTERVAL_MINUTES)

    if should_persist:
        entry = ScoreHistory(
            user_id=user_id,
            score=score,
            calculated_at=now,
        )
        db.add(entry)
        db.commit()

    return {
        "score": score,
        "breakdown": breakdown,
    }


def get_history(db: Session, user_id: int) -> list[ScoreHistory]:
    return (
        db.query(ScoreHistory)
        .filter(ScoreHistory.user_id == user_id)
        .order_by(ScoreHistory.calculated_at.asc())
        .all()
    )
