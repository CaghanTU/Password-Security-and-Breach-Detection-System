from fastapi import APIRouter, Cookie, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.requests import Request

import services.auth_service as auth_service
import services.export_service as export_service
from database import get_db
from models.schemas import ExportResponse, ImportRequest

router = APIRouter(prefix="/export", tags=["export"])


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("", response_model=ExportResponse)
def export_vault(
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, key = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    return export_service.export_vault(db, user.id, key, _client_ip(request))


@router.post("/import")
def import_vault(
    body: ImportRequest,
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, key = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    try:
        result = export_service.import_vault(
            db, user.id, key,
            body.ciphertext, body.iv, body.tag,
            _client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return result



def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("", response_model=ExportResponse)
def export_vault(
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user, key = auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    return export_service.export_vault(db, user.id, key, _client_ip(request))
