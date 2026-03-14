"""
CSV/JSON import service supporting LastPass, Bitwarden, and 1Password formats.
"""
import csv
import io
import json
import logging

from sqlalchemy.orm import Session

import services.password_service as password_service

logger = logging.getLogger(__name__)

CATEGORIES = {"email", "banking", "social", "work", "other"}


def _guess_category(site_name: str, url: str) -> str:
    combined = (site_name + " " + url).lower()
    if any(k in combined for k in ["mail", "gmail", "outlook", "yahoo", "proton"]):
        return "email"
    if any(k in combined for k in ["bank", "paypal", "finance", "credit", "invest"]):
        return "banking"
    if any(k in combined for k in ["facebook", "twitter", "instagram", "linkedin", "reddit", "social"]):
        return "social"
    if any(k in combined for k in ["slack", "jira", "confluence", "github", "gitlab", "work"]):
        return "work"
    return "other"


def _import_rows(rows: list[dict], db: Session, user_id: int, key: bytes) -> dict:
    imported = 0
    skipped = 0
    errors = []

    for row in rows:
        site_name = row.get("site_name", "").strip()
        site_username = row.get("username", "").strip()
        password = row.get("password", "").strip()
        url = row.get("url", "")
        category = row.get("category", _guess_category(site_name, url))

        if category not in CATEGORIES:
            category = "other"

        if not site_name or not password:
            skipped += 1
            continue

        result = password_service.add_credential(
            db, user_id, key, site_name, site_username or site_name, password, category, "import"
        )
        if "error" in result:
            if result["error"] == "reuse":
                skipped += 1
            else:
                errors.append(f"{site_name}: {result['message']}")
                skipped += 1
        else:
            imported += 1

    return {"imported": imported, "skipped": skipped, "errors": errors[:10]}


def import_lastpass_csv(content: str, db: Session, user_id: int, key: bytes) -> dict:
    """
    LastPass CSV format:
    url,username,password,extra,name,grouping,fav
    """
    reader = csv.DictReader(io.StringIO(content))
    rows = []
    for r in reader:
        rows.append({
            "site_name": r.get("name") or r.get("url", ""),
            "username": r.get("username", ""),
            "password": r.get("password", ""),
            "url": r.get("url", ""),
            "category": _guess_category(r.get("name", ""), r.get("url", "")),
        })
    return _import_rows(rows, db, user_id, key)


def import_bitwarden_json(content: str, db: Session, user_id: int, key: bytes) -> dict:
    """
    Bitwarden JSON format:
    {"items": [{"name": ..., "login": {"username": ..., "password": ..., "uris": [{"uri": ...}]}}]}
    """
    data = json.loads(content)
    items = data.get("items", [])
    rows = []
    for item in items:
        login = item.get("login") or {}
        uris = login.get("uris") or []
        url = uris[0].get("uri", "") if uris else ""
        rows.append({
            "site_name": item.get("name", url),
            "username": login.get("username", ""),
            "password": login.get("password", ""),
            "url": url,
        })
    return _import_rows(rows, db, user_id, key)


def import_1password_csv(content: str, db: Session, user_id: int, key: bytes) -> dict:
    """
    1Password CSV format:
    Title,Username,Password,URL,Notes,OTPAuth
    """
    reader = csv.DictReader(io.StringIO(content))
    rows = []
    for r in reader:
        rows.append({
            "site_name": r.get("Title") or r.get("title", ""),
            "username": r.get("Username") or r.get("username", ""),
            "password": r.get("Password") or r.get("password", ""),
            "url": r.get("URL") or r.get("url", ""),
        })
    return _import_rows(rows, db, user_id, key)


def auto_detect_and_import(content: str, filename: str, db: Session, user_id: int, key: bytes) -> dict:
    """Detect format from filename or content structure and import."""
    fname = filename.lower()

    # Try JSON first
    if fname.endswith(".json") or content.lstrip().startswith("{"):
        try:
            return import_bitwarden_json(content, db, user_id, key)
        except Exception as exc:
            logger.warning("Bitwarden JSON parse failed: %s", exc)

    # Detect CSV format from header
    first_line = content.strip().split("\n")[0].lower()
    if "url" in first_line and "grouping" in first_line:
        return import_lastpass_csv(content, db, user_id, key)
    if "otpauth" in first_line or "title" in first_line:
        return import_1password_csv(content, db, user_id, key)

    # Fall back to LastPass
    return import_lastpass_csv(content, db, user_id, key)
