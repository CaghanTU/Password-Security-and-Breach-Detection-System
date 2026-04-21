from fastapi import APIRouter, Cookie, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.requests import Request

import services.auth_service as auth_service
import services.export_service as export_service
import services.import_service as import_service
from database import get_db
from models.schemas import ExportResponse, ImportRequest, ImportCSVResponse

router = APIRouter(prefix="/export", tags=["export"])


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _auth(token, db):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return auth_service.get_current_user_and_key(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.get("", response_model=ExportResponse)
def export_vault(
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _auth(token, db)
    return export_service.export_vault(db, user.id, key, _client_ip(request))


@router.post("/import")
def import_vault(
    body: ImportRequest,
    request: Request,
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _auth(token, db)
    try:
        result = export_service.import_vault(
            db, user.id, key,
            body.ciphertext, body.iv, body.tag,
            _client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.post("/import-csv", response_model=ImportCSVResponse)
async def import_csv(
    request: Request,
    file: UploadFile = File(...),
    format: str = Form(default="auto"),
    token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    user, key = _auth(token, db)
    content = (await file.read()).decode("utf-8", errors="replace")
    filename = file.filename or ""

    try:
        if format == "lastpass":
            result = import_service.import_lastpass_csv(content, db, user.id, key)
        elif format == "bitwarden":
            result = import_service.import_bitwarden_json(content, db, user.id, key)
        elif format == "1password":
            result = import_service.import_1password_csv(content, db, user.id, key)
        else:
            result = import_service.auto_detect_and_import(content, filename, db, user.id, key)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Import error: {str(exc)}")

    return result
