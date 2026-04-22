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
    recovery_code: Optional[str] = None


class TwoFASetupResponse(BaseModel):
    qr_image: str
    secret: str


class TwoFAVerifyRequest(BaseModel):
    code: str


class MessageResponse(BaseModel):
    message: str


class RecoveryCodesResponse(BaseModel):
    codes: List[str]
    total: int


class RecoveryCodesSummaryResponse(BaseModel):
    has_codes: bool
    total: int
    used: int
    remaining: int
    generated_at: Optional[datetime]


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


class AIGenerateRequest(BaseModel):
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
    account_label: Optional[str] = ""
    purpose: Optional[str] = ""
    memorable_words: Optional[List[str]] = []
    style: str = "password"  # password | passphrase
    count: int = 3

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: str) -> str:
        allowed = {"password", "passphrase"}
        if v not in allowed:
            raise ValueError(f"style must be one of {allowed}")
        return v

    @field_validator("count")
    @classmethod
    def validate_count(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("count must be between 1 and 5")
        return v


class AIGeneratedSuggestion(BaseModel):
    password: str
    entropy_bits: float
    strength_label: str
    rationale: str


class AIGenerateResponse(BaseModel):
    model: str
    suggestions: List[AIGeneratedSuggestion]


# ── Score ─────────────────────────────────────────────────────────────

class RiskExplanation(BaseModel):
    key: str
    title: str
    severity: str
    count: int
    ratio: float
    weight: float
    impact_points: int
    explanation: str
    recommendation: str


class SuggestedAction(BaseModel):
    key: str
    label: str
    estimated_score_gain: int
    reason: str

class ScoreResponse(BaseModel):
    score: int
    breakdown: dict
    explanations: List[RiskExplanation]
    suggested_actions: List[SuggestedAction]


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


class HealthTrendPoint(BaseModel):
    id: int
    score: int
    weak_count: int
    medium_count: int
    reused_count: int
    breach_any_count: int
    stale_count: int
    totp_enabled_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthTrendSummary(BaseModel):
    trend_direction: str
    score_delta: int
    weak_delta: int
    breach_delta: int
    stale_delta: int
    reused_delta: int


class HealthTrendResponse(BaseModel):
    points: List[HealthTrendPoint]
    summary: HealthTrendSummary


# ── AI Advisor ────────────────────────────────────────────────────────

class AIAdvisorPriority(BaseModel):
    title: str
    detail: str
    impact: str


class AIAdvisorResponse(BaseModel):
    source: str
    model: str
    generated_at: datetime
    headline: str
    summary: str
    risk_posture: str
    analyst_note: Optional[str] = None
    why_now: str
    next_step: str
    priorities: List[AIAdvisorPriority]


class AIPlanStep(BaseModel):
    window: str
    title: str
    detail: str


class AIWhatIfScenario(BaseModel):
    title: str
    effect: str
    detail: str


class AIWeeklySummary(BaseModel):
    headline: str
    summary: str
    watch_items: List[str]


class AIAccountReview(BaseModel):
    credential_id: int
    site_name: str
    status_label: str
    summary: str
    recommendation: str


class AIInsightsResponse(BaseModel):
    source: str
    model: str
    generated_at: datetime
    briefing: AIAdvisorResponse
    plan_48h: List[AIPlanStep]
    what_if_scenarios: List[AIWhatIfScenario]
    weekly_summary: AIWeeklySummary
    account_reviews: List[AIAccountReview]


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


# ── Action Center ──────────────────────────────────────────────────────

class ActionSummary(BaseModel):
    current_score: int
    open_actions: int
    critical_actions: int
    high_actions: int
    medium_actions: int
    recovery_codes_remaining: int
    unresolved_breach_cases: int
    resolved_breach_cases: int


class ActionItem(BaseModel):
    id: str
    kind: str
    priority: str
    status: str
    title: str
    description: str
    action_label: str
    estimated_score_gain: int
    ai_reason: Optional[str] = None
    credential_id: Optional[int] = None
    credential_ids: Optional[List[int]] = None
    site_name: Optional[str] = None


class BreachFollowUpEntry(BaseModel):
    id: int
    credential_id: int
    site_name: Optional[str]
    status: str
    breach_names: List[str]
    latest_breach_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]


class ActionCenterResponse(BaseModel):
    summary: ActionSummary
    actions: List[ActionItem]
    open_follow_up: List[BreachFollowUpEntry]
    recently_resolved: List[BreachFollowUpEntry]
