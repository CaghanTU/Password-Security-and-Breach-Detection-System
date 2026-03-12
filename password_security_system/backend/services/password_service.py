from datetime import datetime, timedelta
from typing import Optional
import re

from rapidfuzz import fuzz
from sqlalchemy.orm import Session
from zxcvbn import zxcvbn

import services.audit_service as audit_service
from database import Credential, PasswordHistory
from services.crypto_service import decrypt, encrypt, hash_for_reuse

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

STALE_DAYS = 90
LEVENSHTEIN_THRESHOLD = 80   # ≥80 → too similar
MAX_HISTORY = 5


def _strength_label(score: int) -> str:
    """Map zxcvbn score (0-4) to human-readable label."""
    if score <= 1:
        return "weak"
    elif score == 2:
        return "medium"
    return "strong"


def _check_too_similar(
    new_password: str,
    db: Session,
    user_id: int,
    exclude_credential_id: Optional[int] = None,
) -> bool:
    """
    Check Levenshtein similarity against all of the user's current passwords
    AND their password history.

    SHA-256 hash comparison alone won't catch 'password1' → 'password2'
    (edit distance = 1).  rapidfuzz gives us an edit-distance-based ratio.
    """
    creds = db.query(Credential).filter(Credential.user_id == user_id).all()
    for cred in creds:
        if exclude_credential_id and cred.id == exclude_credential_id:
            continue
        # We store hashes, not plaintexts, so similarity is checked at write-time
        # via the plaintext the caller provides.
        # NOTE: history entries don't retain plaintext either, so we compare
        # reuse_hash equality for history and use plaintext similarity only for
        # credentials the caller can provide.
        ratio = fuzz.ratio(new_password, cred.reuse_hash)  # hash vs hash is not useful
        # We compare against site_name to surface the same-site pattern, but the
        # meaningful comparison is password vs password.  Since we cannot decrypt
        # without the caller's key, the service layer in password_service receives
        # the plaintext and performs the comparison before encryption.
        _ = ratio  # placeholder — actual comparison done in add/update helpers below

    return False  # sentinel; real logic in _similar_to_existing


def _similar_to_existing(
    new_plaintext: str,
    existing_plaintexts: list[str],
) -> bool:
    """Return True if new_plaintext is ≥ LEVENSHTEIN_THRESHOLD similar to any existing."""
    for existing in existing_plaintexts:
        if fuzz.ratio(new_plaintext, existing) >= LEVENSHTEIN_THRESHOLD:
            return True
    return False


def _is_stale(credential: Credential) -> bool:
    ref = credential.updated_at or credential.created_at
    if ref is None:
        return False
    return (datetime.utcnow() - ref) > timedelta(days=STALE_DAYS)


def add_credential(
    db: Session,
    user_id: int,
    key: bytes,
    site_name: str,
    site_username: str,
    password: str,
    category: str = "other",
    ip: str = "",
) -> dict:
    """
    Add a new credential.  Performs:
    - zxcvbn strength analysis
    - same-user reuse detection (exact hash)
    - Levenshtein similarity detection against all current passwords
    - AES-256-GCM encryption
    """
    reuse_h = hash_for_reuse(password)

    # Exact reuse check
    existing_creds = db.query(Credential).filter(Credential.user_id == user_id).all()
    existing_hashes = {c.reuse_hash for c in existing_creds}
    if reuse_h in existing_hashes:
        return {"error": "reuse_detected", "message": "This password is already used in another credential."}

    # Levenshtein check — we need plaintext of existing creds, which requires decryption.
    # The caller must supply key; we decrypt here.
    existing_plaintexts: list[str] = []
    for cred in existing_creds:
        try:
            pt = decrypt(cred.ciphertext, cred.iv, cred.tag, key)
            existing_plaintexts.append(pt)
        except Exception:
            pass  # skip entries that can't be decrypted (shouldn't happen)

    # Also check password history
    for cred in existing_creds:
        for hist in cred.history:
            try:
                pt = decrypt(hist.ciphertext, hist.iv, hist.tag, key)
                existing_plaintexts.append(pt)
            except Exception:
                pass

    if _similar_to_existing(password, existing_plaintexts):
        return {"error": "too_similar", "message": "New password is too similar to an existing one."}

    zx = zxcvbn(password)
    strength = _strength_label(zx["score"])

    # Encrypt username and password
    enc_username_ct, enc_username_iv, enc_username_tag = encrypt(site_username, key)
    ct, iv, tag = encrypt(password, key)

    cred = Credential(
        user_id=user_id,
        site_name=site_name,
        site_username=enc_username_ct,  # store encrypted; iv/tag reuse field names
        ciphertext=ct,
        iv=iv,
        tag=tag,
        reuse_hash=reuse_h,
        strength_label=strength,
        category=category,
        is_stale=False,
    )
    # Store username encryption metadata in extra fields
    # We'll piggyback iv/tag for username in separate columns via a simpler approach:
    # store site_username as "enc_ct|enc_iv|enc_tag"
    cred.site_username = f"{enc_username_ct}|{enc_username_iv}|{enc_username_tag}"

    db.add(cred)
    db.commit()
    db.refresh(cred)

    # Auto breach check (k-anonymity, no external API needed)
    try:
        import services.breach_service as breach_service
        bcheck = breach_service.check_password(password)
        cred.is_breached = bcheck["pwned"]
        cred.breach_count = bcheck["count"]
        db.commit()
        db.refresh(cred)
    except Exception:
        pass  # breach check is best-effort, never block save

    # Auto email breach check if site_username looks like an email
    if _EMAIL_RE.match(site_username):
        try:
            import services.breach_service as breach_service
            echeck = breach_service.check_email(db, site_username, user_id)
            cred.email_breached = echeck["breached"]
            cred.email_breach_count = len(echeck["breaches"])
            db.commit()
            db.refresh(cred)
        except Exception:
            pass  # best-effort

    audit_service.log(db, user_id, "CREDENTIAL_ADD", ip)
    return {"credential": cred}


def _decode_username(encoded: str, key: bytes) -> str:
    parts = encoded.split("|")
    if len(parts) == 3:
        return decrypt(parts[0], parts[1], parts[2], key)
    return encoded  # fallback for unencrypted legacy


def get_credentials(
    db: Session,
    user_id: int,
    key: bytes,
    category: Optional[str] = None,
) -> list[dict]:
    query = db.query(Credential).filter(Credential.user_id == user_id)
    if category:
        query = query.filter(Credential.category == category)
    creds = query.all()

    result = []
    for cred in creds:
        # Refresh staleness flag
        stale = _is_stale(cred)
        if cred.is_stale != stale:
            cred.is_stale = stale
            db.commit()

        try:
            password = decrypt(cred.ciphertext, cred.iv, cred.tag, key)
            username = _decode_username(cred.site_username, key)
        except Exception:
            password = "[decryption error]"
            username = "[decryption error]"

        result.append({
            "id": cred.id,
            "site_name": cred.site_name,
            "site_username": username,
            "password": password,
            "strength_label": cred.strength_label,
            "is_breached": cred.is_breached,
            "breach_count": getattr(cred, "breach_count", 0) or 0,
            "email_breached": getattr(cred, "email_breached", False) or False,
            "email_breach_count": getattr(cred, "email_breach_count", 0) or 0,
            "breach_date_status": cred.breach_date_status,
            "is_stale": cred.is_stale,
            "category": cred.category,
            "created_at": cred.created_at,
            "updated_at": cred.updated_at,
        })
    return result


def update_credential(
    db: Session,
    credential_id: int,
    user_id: int,
    key: bytes,
    site_name: Optional[str] = None,
    site_username: Optional[str] = None,
    password: Optional[str] = None,
    category: Optional[str] = None,
    ip: str = "",
) -> dict:
    cred = db.query(Credential).filter(
        Credential.id == credential_id, Credential.user_id == user_id
    ).first()
    if not cred:
        return {"error": "not_found", "message": "Credential not found"}

    if site_name:
        cred.site_name = site_name

    if site_username:
        ct_u, iv_u, tag_u = encrypt(site_username, key)
        cred.site_username = f"{ct_u}|{iv_u}|{tag_u}"

    if password:
        new_hash = hash_for_reuse(password)

        # Check history (last MAX_HISTORY entries)
        history_hashes = {h.reuse_hash for h in cred.history}
        if new_hash == cred.reuse_hash or new_hash in history_hashes:
            return {"error": "reuse_detected", "message": "Cannot reuse a recent password."}

        # Levenshtein against all current + history
        all_creds = db.query(Credential).filter(Credential.user_id == user_id).all()
        existing_plaintexts: list[str] = []
        for c in all_creds:
            if c.id == credential_id:
                continue
            try:
                pt = decrypt(c.ciphertext, c.iv, c.tag, key)
                existing_plaintexts.append(pt)
            except Exception:
                pass
        for hist in cred.history:
            try:
                pt = decrypt(hist.ciphertext, hist.iv, hist.tag, key)
                existing_plaintexts.append(pt)
            except Exception:
                pass
        try:
            current_pt = decrypt(cred.ciphertext, cred.iv, cred.tag, key)
            existing_plaintexts.append(current_pt)
        except Exception:
            pass

        if _similar_to_existing(password, existing_plaintexts):
            return {"error": "too_similar", "message": "New password is too similar to an existing one."}

        # Archive current password to history
        hist_entry = PasswordHistory(
            credential_id=cred.id,
            ciphertext=cred.ciphertext,
            iv=cred.iv,
            tag=cred.tag,
            reuse_hash=cred.reuse_hash,
        )
        db.add(hist_entry)

        # Trim history to MAX_HISTORY
        all_history = (
            db.query(PasswordHistory)
            .filter(PasswordHistory.credential_id == cred.id)
            .order_by(PasswordHistory.archived_at.desc())
            .all()
        )
        for old in all_history[MAX_HISTORY:]:
            db.delete(old)

        # Encrypt new password
        ct, iv, tag = encrypt(password, key)
        zx = zxcvbn(password)
        cred.ciphertext = ct
        cred.iv = iv
        cred.tag = tag
        cred.reuse_hash = new_hash
        cred.strength_label = _strength_label(zx["score"])
        cred.is_stale = False
        cred.is_breached = False
        cred.breach_date_status = None

    if category:
        cred.category = category

    cred.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cred)

    audit_service.log(db, user_id, "CREDENTIAL_UPDATE", ip)
    return {"credential": cred}


def delete_credential(
    db: Session, credential_id: int, user_id: int, ip: str = ""
) -> dict:
    cred = db.query(Credential).filter(
        Credential.id == credential_id, Credential.user_id == user_id
    ).first()
    if not cred:
        return {"error": "not_found", "message": "Credential not found"}
    db.delete(cred)
    db.commit()
    audit_service.log(db, user_id, "CREDENTIAL_DELETE", ip)
    return {"message": "Deleted"}


def get_credential_history(
    db: Session, credential_id: int, user_id: int
) -> list[PasswordHistory]:
    cred = db.query(Credential).filter(
        Credential.id == credential_id, Credential.user_id == user_id
    ).first()
    if not cred:
        return []
    return cred.history
