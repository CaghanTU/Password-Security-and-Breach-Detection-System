from typing import Optional

import pyotp
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import services.auth_service as auth_service
import services.password_service as password_service
from database import get_db, Credential
from models.schemas import (
    CredentialCreate, CredentialResponse, CredentialUpdate, HistoryEntry,
    BulkDeleteRequest, BulkCategoryRequest, TOTPSetRequest, TOTPCodeResponse,
)

router = APIRouter(prefix="/passwords", tags=["passwords"])


def _get_user_and_key(token, db):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("", response_model=list[CredentialResponse])
def list_credentials(
    category: Optional[str] = None,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _get_user_and_key(token, db)
    return password_service.get_credentials(db, user.id, key, category)


@router.post("", response_model=CredentialResponse, status_code=201)
def add_credential(
    body: CredentialCreate,
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _get_user_and_key(token, db)
    result = password_service.add_credential(
        db, user.id, key,
        body.site_name, body.site_username, body.password,
        body.category, _client_ip(request),
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["message"])
    cred = result["credential"]
    items = password_service.get_credentials(db, user.id, key)
    for item in items:
        if item["id"] == cred.id:
            return item
    raise HTTPException(status_code=500, detail="Failed to retrieve created credential")


@router.put("/{credential_id}", response_model=CredentialResponse)
def update_credential(
    credential_id: int,
    body: CredentialUpdate,
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _get_user_and_key(token, db)
    result = password_service.update_credential(
        db, credential_id, user.id, key,
        body.site_name, body.site_username, body.password, body.category,
        _client_ip(request),
    )
    if "error" in result:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    cred = result["credential"]
    items = password_service.get_credentials(db, user.id, key)
    for item in items:
        if item["id"] == cred.id:
            return item
    raise HTTPException(status_code=500, detail="Failed to retrieve updated credential")


@router.delete("/{credential_id}")
def delete_credential(
    credential_id: int,
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _get_user_and_key(token, db)
    result = password_service.delete_credential(
        db, credential_id, user.id, _client_ip(request)
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.get("/{credential_id}/history", response_model=list[HistoryEntry])
def get_history(
    credential_id: int,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user_and_key(token, db)
    items = password_service.get_credential_history(db, credential_id, user.id)
    return [{"id": h.id, "archived_at": h.archived_at} for h in items]


# ── Bulk operations ───────────────────────────────────────────────────

@router.post("/bulk-delete")
def bulk_delete(
    body: BulkDeleteRequest,
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user_and_key(token, db)
    deleted = 0
    for cred_id in body.ids:
        result = password_service.delete_credential(db, cred_id, user.id, _client_ip(request))
        if "error" not in result:
            deleted += 1
    return {"deleted": deleted}


@router.post("/bulk-category")
def bulk_update_category(
    body: BulkCategoryRequest,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user_and_key(token, db)
    updated = (
        db.query(Credential)
        .filter(Credential.user_id == user.id, Credential.id.in_(body.ids))
        .update({"category": body.category}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}


# ── TOTP vault ────────────────────────────────────────────────────────

@router.post("/{credential_id}/totp", response_model=TOTPCodeResponse)
def set_totp_secret(
    credential_id: int,
    body: TOTPSetRequest,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user_and_key(token, db)
    cred = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.user_id == user.id,
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Validate secret
    try:
        totp = pyotp.TOTP(body.secret)
        code = totp.now()
    except Exception:
        raise HTTPException(status_code=400, detail="Geçersiz TOTP secret formatı")

    cred.totp_secret = body.secret
    db.commit()

    import time as _time
    valid_seconds = 30 - (int(_time.time()) % 30)
    return {"code": code, "valid_seconds": valid_seconds}


@router.get("/{credential_id}/totp/code", response_model=TOTPCodeResponse)
def get_totp_code(
    credential_id: int,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user_and_key(token, db)
    cred = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.user_id == user.id,
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    if not cred.totp_secret:
        raise HTTPException(status_code=404, detail="Bu credential için TOTP ayarlanmamış")

    import time as _time
    totp = pyotp.TOTP(cred.totp_secret)
    code = totp.now()
    valid_seconds = 30 - (int(_time.time()) % 30)
    return {"code": code, "valid_seconds": valid_seconds}


@router.delete("/{credential_id}/totp")
def remove_totp_secret(
    credential_id: int,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, _ = _get_user_and_key(token, db)
    cred = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.user_id == user.id,
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    cred.totp_secret = None
    db.commit()
    return {"message": "TOTP kaldırıldı"}
