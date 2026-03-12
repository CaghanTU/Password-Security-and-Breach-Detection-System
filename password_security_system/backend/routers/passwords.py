from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import services.auth_service as auth_service
import services.password_service as password_service
from database import get_db
from models.schemas import CredentialCreate, CredentialResponse, CredentialUpdate, HistoryEntry

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
    # Re-fetch decrypted view
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
