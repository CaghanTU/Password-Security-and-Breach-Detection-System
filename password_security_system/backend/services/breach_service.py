import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional

import requests
from sqlalchemy.orm import Session

from config import HIBP_API_KEY
from database import BreachCache, Credential

HIBP_BREACH_URL = "https://haveibeenpwned.com/api/v3/breachedaccount/{email}?truncateResponse=false"
HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/{prefix}"
CACHE_TTL_HOURS = 24


def _get_cached_breaches(db: Session, email: str) -> Optional[list]:
    entry = db.query(BreachCache).filter(BreachCache.email == email).first()
    if entry:
        age = datetime.utcnow() - entry.cached_at
        if age < timedelta(hours=CACHE_TTL_HOURS):
            data = json.loads(entry.result_json)
            # Detect old-format cache (snake_case keys from old service version) → force re-fetch
            if data and isinstance(data[0], dict) and "Name" not in data[0]:
                return None
            return data
    return None


def _save_cache(db: Session, email: str, breaches: list) -> None:
    entry = db.query(BreachCache).filter(BreachCache.email == email).first()
    if entry:
        entry.result_json = json.dumps(breaches)
        entry.cached_at = datetime.utcnow()
    else:
        entry = BreachCache(email=email, result_json=json.dumps(breaches))
        db.add(entry)
    db.commit()


def check_email(db: Session, email: str, user_id: int) -> dict:
    """
    Query HIBP for breaches associated with an email address.
    Results are cached for CACHE_TTL_HOURS hours to avoid redundant API calls.
    """
    import services.audit_service as audit_service

    cached = _get_cached_breaches(db, email)
    if cached is not None:
        raw_breaches = cached
    else:
        headers = {
            "hibp-api-key": HIBP_API_KEY,
            "User-Agent": "PasswordSecuritySystem/1.0",
        }
        url = HIBP_BREACH_URL.format(email=email)
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 404:
            raw_breaches = []
        elif resp.status_code == 200:
            raw_breaches = resp.json()
        elif resp.status_code == 401:
            raise ValueError("Invalid HIBP API key")
        else:
            raise RuntimeError(f"HIBP returned status {resp.status_code}")
        _save_cache(db, email, raw_breaches)

    breaches = [
        {
            "name": b.get("Name", ""),
            "title": b.get("Title", b.get("Name", "")),
            "domain": b.get("Domain", ""),
            "breach_date": b.get("BreachDate"),
            "added_date": b.get("AddedDate"),
            "pwn_count": b.get("PwnCount", 0),
            "description": b.get("Description", ""),
            "logo_path": b.get("LogoPath", ""),
            "data_classes": b.get("DataClasses", []),
            "is_verified": b.get("IsVerified", False),
            "is_sensitive": b.get("IsSensitive", False),
        }
        for b in raw_breaches
    ]

    audit_service.log(db, user_id, "BREACH_CHECK", None)
    return {
        "email": email,
        "breached": len(breaches) > 0,
        "breaches": breaches,
    }


def check_password(password: str) -> dict:
    """
    HIBP k-anonymity password check.
    Only the first 5 chars of the SHA-1 hash are sent to the API.
    The plaintext password NEVER leaves the server.
    """
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]

    resp = requests.get(
        HIBP_RANGE_URL.format(prefix=prefix),
        headers={"User-Agent": "PasswordSecuritySystem/1.0"},
        timeout=10,
    )
    resp.raise_for_status()

    count = 0
    for line in resp.text.splitlines():
        h, n = line.split(":")
        if h == suffix:
            count = int(n)
            break

    return {"pwned": count > 0, "count": count}


def update_breach_status(
    db: Session,
    credential: Credential,
    email_breaches: list[dict],
) -> None:
    """
    Compare the credential's updated_at against HIBP BreachDate values.
    Sets breach_date_status = 'changed_after' or 'not_rotated'.
    """
    if not email_breaches:
        credential.is_breached = False
        credential.breach_date_status = None
        db.commit()
        return

    credential.is_breached = True
    # Use the most recent breach date for comparison
    breach_dates = []
    for b in email_breaches:
        bd = b.get("breach_date")
        if bd:
            try:
                breach_dates.append(datetime.strptime(bd, "%Y-%m-%d"))
            except ValueError:
                pass

    if not breach_dates:
        credential.breach_date_status = None
        db.commit()
        return

    latest_breach = max(breach_dates)
    ref = credential.updated_at or credential.created_at

    if ref and ref > latest_breach:
        credential.breach_date_status = "changed_after"
    else:
        credential.breach_date_status = "not_rotated"

    db.commit()
