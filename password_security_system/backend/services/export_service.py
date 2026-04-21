import json

from sqlalchemy.orm import Session

import services.audit_service as audit_service
from database import Credential
from services.crypto_service import decrypt, encrypt, derive_key


def export_vault(db: Session, user_id: int, key: bytes, ip: str = "") -> dict:
    """
    Serialize the user's entire vault to JSON, then encrypt it with AES-256-GCM.
    The plaintext is NEVER written to disk.

    Returns a dict with {ciphertext, iv, tag} (all base64-encoded strings).
    """
    creds = db.query(Credential).filter(Credential.user_id == user_id).all()

    vault = []
    for cred in creds:
        try:
            password = decrypt(cred.ciphertext, cred.iv, cred.tag, key)
            username = _decode_username(cred.site_username, key)
        except Exception:
            continue

        vault.append({
            "id": cred.id,
            "site_name": cred.site_name,
            "site_username": username,
            "password": password,
            "category": cred.category,
            "strength_label": cred.strength_label,
            "is_breached": cred.is_breached,
            "is_stale": cred.is_stale,
            "created_at": cred.created_at.isoformat() if cred.created_at else None,
            "updated_at": cred.updated_at.isoformat() if cred.updated_at else None,
        })

    plaintext_json = json.dumps(vault, ensure_ascii=False)
    ct, iv, tag = encrypt(plaintext_json, key)

    audit_service.log(db, user_id, "EXPORT", ip)
    return {"ciphertext": ct, "iv": iv, "tag": tag}


def _decode_username(encoded: str, key: bytes) -> str:
    parts = encoded.split("|")
    if len(parts) == 3:
        return decrypt(parts[0], parts[1], parts[2], key)
    return encoded


def import_vault(db: Session, user_id: int, key: bytes, ciphertext: str, iv: str, tag: str, ip: str = "") -> dict:
    """
    Decrypt an exported vault and re-import all credentials for the user.
    Skips entries that are duplicates or too similar.
    """
    import services.audit_service as audit_service
    import services.password_service as password_service

    try:
        plaintext = decrypt(ciphertext, iv, tag, key)
        vault = json.loads(plaintext)
    except Exception as exc:
        raise ValueError(f"Vault could not be decrypted: {exc}")

    imported = 0
    skipped = 0
    errors = []

    for entry in vault:
        site_name = entry.get("site_name", "").strip()
        site_username = entry.get("site_username", "").strip()
        password = entry.get("password", "")
        category = entry.get("category", "other")

        if not site_name or not password:
            skipped += 1
            continue

        result = password_service.add_credential(
            db, user_id, key, site_name, site_username, password, category, ip
        )
        if "error" in result:
            skipped += 1
            errors.append(f"{site_name}: {result['message']}")
        else:
            imported += 1

    audit_service.log(db, user_id, "IMPORT", ip)
    return {"imported": imported, "skipped": skipped, "errors": errors}
