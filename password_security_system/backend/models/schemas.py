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
    qr_image: str        # data:image/png;base64,...
    secret: str          # base32 secret for manual entry


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
    site_username: str          # decrypted
    password: str               # decrypted
    strength_label: str
    is_breached: bool
    breach_count: int
    email_breached: bool
    email_breach_count: int
    breach_date_status: Optional[str]
    is_stale: bool
    category: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HistoryEntry(BaseModel):
    id: int
    archived_at: datetime

    model_config = {"from_attributes": True}


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


# ── Generator ─────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    length: int = 16
    use_upper: bool = True
    use_lower: bool = True
    use_digits: bool = True
    use_symbols: bool = True
    min_digits: int = 0          # guarantee at least N digits
    min_symbols: int = 0         # guarantee at least N symbols
    prefix: Optional[str] = ""   # prepend fixed text
    suffix: Optional[str] = ""   # append fixed text
    custom_chars: Optional[str] = ""  # extra chars added to alphabet


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


# ── Export ────────────────────────────────────────────────────────────

class ExportResponse(BaseModel):
    ciphertext: str
    iv: str
    tag: str


class ImportRequest(BaseModel):
    ciphertext: str
    iv: str
    tag: str


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
