from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


# ── Auth ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    master_password: str


class LoginRequest(BaseModel):
    username: str
    master_password: str
    totp_code: Optional[str] = None


class TwoFASetupResponse(BaseModel):
    qr_image: str
    secret: str


class TwoFAVerifyRequest(BaseModel):
    code: str


class MessageResponse(BaseModel):
    message: str


# ── Credentials ───────────────────────────────────────────────────────

class CredentialCreate(BaseModel):
    site_name: str
    site_username: str
    password: str
    category: Optional[str] = "other"

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {"email", "banking", "social", "work", "other"}
        if v not in allowed:
            raise ValueError(f"category must be one of {allowed}")
        return v


class CredentialUpdate(BaseModel):
    site_name: Optional[str] = None
    site_username: Optional[str] = None
    password: Optional[str] = None
    category: Optional[str] = None


class CredentialResponse(BaseModel):
    id: int
    site_name: str
    site_username: str
    password: str
    strength_label: str
    is_breached: bool
    breach_count: int
    email_breached: bool
    email_breach_count: int
    breach_date_status: Optional[str]
    is_stale: bool
    category: str
    totp_secret: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HistoryEntry(BaseModel):
    id: int
    archived_at: datetime

    model_config = {"from_attributes": True}


# ── Bulk operations ───────────────────────────────────────────────────

class BulkDeleteRequest(BaseModel):
    ids: List[int]


class BulkCategoryRequest(BaseModel):
    ids: List[int]
    category: str

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {"email", "banking", "social", "work", "other"}
        if v not in allowed:
            raise ValueError(f"category must be one of {allowed}")
        return v


# ── TOTP vault ────────────────────────────────────────────────────────

class TOTPSetRequest(BaseModel):
    secret: str


class TOTPCodeResponse(BaseModel):
    code: str
    valid_seconds: int


# ── Breach ────────────────────────────────────────────────────────────

class BreachEmailRequest(BaseModel):
    email: str


class BreachPasswordRequest(BaseModel):
    password: str


class BreachResult(BaseModel):
    name: str
    title: str
    domain: Optional[str] = ""
    breach_date: Optional[str]
    added_date: Optional[str] = None
    pwn_count: int = 0
    description: Optional[str] = ""
    logo_path: Optional[str] = ""
    data_classes: List[str]
    is_verified: bool
    is_sensitive: bool = False


class BreachEmailResponse(BaseModel):
    email: str
    breached: bool
    breaches: List[BreachResult]


class BreachPasswordResponse(BaseModel):
    pwned: bool
    count: int


# ── Alerts ────────────────────────────────────────────────────────────

class AlertEntry(BaseModel):
    id: int
    credential_id: Optional[int]
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertsResponse(BaseModel):
    unread_count: int
    alerts: List[AlertEntry]


# ── Generator ─────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    length: int = 16
    use_upper: bool = True
    use_lower: bool = True
    use_digits: bool = True
    use_symbols: bool = True
    min_digits: int = 0
    min_symbols: int = 0
    prefix: Optional[str] = ""
    suffix: Optional[str] = ""
    custom_chars: Optional[str] = ""


class GenerateResponse(BaseModel):
    password: str
    entropy_bits: float
    strength_label: str


# ── Score ─────────────────────────────────────────────────────────────

class ScoreResponse(BaseModel):
    score: int
    breakdown: dict


class ScoreHistoryEntry(BaseModel):
    id: int
    score: int
    calculated_at: datetime

    model_config = {"from_attributes": True}


class CategoryStats(BaseModel):
    category: str
    total: int
    weak: int
    breached: int
    stale: int


# ── Export / Import ───────────────────────────────────────────────────

class ExportResponse(BaseModel):
    ciphertext: str
    iv: str
    tag: str


class ImportRequest(BaseModel):
    ciphertext: str
    iv: str
    tag: str


class ImportCSVResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


# ── Audit ─────────────────────────────────────────────────────────────

class AuditEntry(BaseModel):
    id: int
    action: str
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: List[AuditEntry]
