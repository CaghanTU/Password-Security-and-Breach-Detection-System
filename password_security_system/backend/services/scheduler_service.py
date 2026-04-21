import json
import logging
import time
from datetime import datetime, timedelta
from typing import Optional

import requests

from config import HIBP_API_KEY
from database import SessionLocal, User, Credential, BreachCache, BreachAlert
from services.crypto_service import hash_lookup_value

logger = logging.getLogger(__name__)

HIBP_BREACH_URL = "https://haveibeenpwned.com/api/v3/breachedaccount/{email}?truncateResponse=false"
CACHE_TTL_HOURS = 24
REQUEST_DELAY = 1.5  # seconds between HIBP requests to respect rate limits


def _fetch_email_breaches(email: str) -> Optional[list]:
    """Fetch breaches from HIBP for a given email. Returns None on error."""
    headers = {
        "hibp-api-key": HIBP_API_KEY,
        "User-Agent": "PasswordSecuritySystem/1.0",
    }
    try:
        resp = requests.get(
            HIBP_BREACH_URL.format(email=email),
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 404:
            return []
        if resp.status_code == 200:
            return resp.json()
        logger.warning("HIBP returned %s for %s", resp.status_code, email)
        return None
    except Exception as exc:
        logger.error("HIBP request failed for %s: %s", email, exc)
        return None


def run_breach_scan() -> None:
    """
    Scheduled job: re-check all cached emails against HIBP.
    Detects new breaches and creates BreachAlert rows if found.
    Runs daily at 03:00.
    """
    if not HIBP_API_KEY:
        logger.info("No HIBP API key configured, skipping breach scan")
        return

    db = SessionLocal()
    try:
        users = db.query(User).all()
        logger.info("Starting breach scan, %d users in system", len(users))

        # Find stale cache entries to re-check
        cutoff = datetime.utcnow() - timedelta(hours=CACHE_TTL_HOURS)
        stale_caches = (
            db.query(BreachCache)
            .filter(BreachCache.cached_at < cutoff)
            .limit(100)
            .all()
        )

        for cache_entry in stale_caches:
            old_names = {b.get("Name", "") for b in json.loads(cache_entry.result_json)}
            time.sleep(REQUEST_DELAY)
            new_raw = _fetch_email_breaches(cache_entry.email)
            if new_raw is None:
                continue

            new_names = {b.get("Name", "") for b in new_raw}
            added = new_names - old_names

            # Update cache
            cache_entry.result_json = json.dumps(new_raw)
            cache_entry.cached_at = datetime.utcnow()
            db.commit()

            if not added:
                continue

            email_hash = hash_lookup_value(cache_entry.email)
            affected_creds = (
                db.query(Credential)
                .filter(Credential.site_username_hash == email_hash)
                .all()
            )
            for cred in affected_creds:
                try:
                    from services.breach_service import apply_email_breach_result
                    normalized = [
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
                        for b in new_raw
                    ]
                    apply_email_breach_result(db, cred, normalized, email_hash=email_hash, commit=False)
                except Exception as exc:
                    logger.error("Breach follow-up sync failed for credential %s: %s", cred.id, exc)
                    continue

                u = db.query(User).filter(User.id == cred.user_id).first()
                alert = BreachAlert(
                    user_id=cred.user_id,
                    credential_id=cred.id,
                    message=f"New breach for {cred.site_name}: {', '.join(sorted(added))} ({cache_entry.email})",
                )
                db.add(alert)
                try:
                    from services.email_service import send_breach_alert
                    send_breach_alert(u.username if u else "user", sorted(added))
                except Exception as exc:
                    logger.error("Email send failed: %s", exc)
            db.commit()

        logger.info("Breach scan complete")
    except Exception as exc:
        logger.error("Breach scan error: %s", exc)
    finally:
        db.close()
