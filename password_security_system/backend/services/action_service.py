import json
from collections import Counter
from typing import Optional

from sqlalchemy.orm import Session

from database import BreachIncident, Credential, RecoveryCode
from services import scoring_service

MAX_ACTIONS = 12


def _priority_rank(priority: str) -> int:
    return {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(priority, 9)


def _action(
    action_id: str,
    kind: str,
    priority: str,
    title: str,
    description: str,
    action_label: str,
    estimated_score_gain: int,
    status: str = "open",
    credential_id: Optional[int] = None,
    credential_ids: Optional[list[int]] = None,
    site_name: Optional[str] = None,
) -> dict:
    return {
        "id": action_id,
        "kind": kind,
        "priority": priority,
        "status": status,
        "title": title,
        "description": description,
        "action_label": action_label,
        "estimated_score_gain": estimated_score_gain,
        "credential_id": credential_id,
        "credential_ids": credential_ids,
        "site_name": site_name,
    }


def _serialize_follow_up(incident: BreachIncident) -> dict:
    breach_names = json.loads(incident.breach_names_json or "[]")
    credential = incident.credential
    return {
        "id": incident.id,
        "credential_id": incident.credential_id,
        "site_name": credential.site_name if credential else None,
        "status": incident.status,
        "breach_names": breach_names,
        "latest_breach_date": incident.latest_breach_date,
        "created_at": incident.created_at,
        "updated_at": incident.updated_at,
        "resolved_at": incident.resolved_at,
    }


def _build_summary(score: int, actions: list[dict], remaining_codes: int, open_incidents: list[BreachIncident], resolved_incidents: list[BreachIncident]) -> dict:
    return {
        "current_score": score,
        "open_actions": len(actions),
        "critical_actions": sum(1 for item in actions if item["priority"] == "critical"),
        "high_actions": sum(1 for item in actions if item["priority"] == "high"),
        "medium_actions": sum(1 for item in actions if item["priority"] == "medium"),
        "recovery_codes_remaining": remaining_codes,
        "unresolved_breach_cases": len(open_incidents),
        "resolved_breach_cases": len(resolved_incidents),
    }


def get_action_center_raw(db: Session, user_id: int, key: Optional[bytes] = None) -> dict:
    creds = db.query(Credential).filter(Credential.user_id == user_id).all()
    if key is not None:
        scoring_service.strength_service.sync_credential_strength_labels(db, creds, key)
    score_data = scoring_service.calculate_score(db, user_id, key, persist=False)
    breakdown = score_data["breakdown"]

    open_incidents = (
        db.query(BreachIncident)
        .filter(BreachIncident.user_id == user_id, BreachIncident.status == "open")
        .order_by(BreachIncident.updated_at.desc())
        .all()
    )
    resolved_incidents = (
        db.query(BreachIncident)
        .filter(BreachIncident.user_id == user_id, BreachIncident.status == "resolved")
        .order_by(BreachIncident.resolved_at.desc())
        .limit(5)
        .all()
    )
    open_incident_cred_ids = {incident.credential_id for incident in open_incidents}

    actions: list[dict] = []

    for incident in open_incidents:
        breach_names = json.loads(incident.breach_names_json or "[]")
        credential = incident.credential
        actions.append(
            _action(
                action_id=f"breach-{incident.id}",
                kind="breach_followup",
                priority="critical",
                title=f"Open breach follow-up for {credential.site_name if credential else 'record'}",
                description=(
                    f"There is a new or unresolved breach record. "
                    f"A password change is expected after {', '.join(breach_names[:3]) if breach_names else 'the breach date'}."
                ),
                action_label="Update password",
                estimated_score_gain=max(4, round(100 * 0.25 * breakdown["breach_any_ratio"])),
                credential_id=incident.credential_id,
                site_name=credential.site_name if credential else None,
            )
        )

    weak_creds = [cred for cred in creds if cred.strength_label == "weak" and cred.id not in open_incident_cred_ids]
    for cred in weak_creds[:4]:
        actions.append(
            _action(
                action_id=f"weak-{cred.id}",
                kind="weak_password",
                priority="high",
                title=f"Weak password for {cred.site_name}",
                description="This record is in the weak-password class. A longer, unique password is recommended.",
                action_label="Generate a strong password",
                estimated_score_gain=max(2, round(100 * 0.30 * breakdown["weak_ratio"])),
                credential_id=cred.id,
                site_name=cred.site_name,
            )
        )

    hash_counts = Counter(cred.reuse_hash for cred in creds if cred.reuse_hash)
    repeated_groups = [reuse_hash for reuse_hash, count in hash_counts.items() if count > 1]
    for index, reuse_hash in enumerate(repeated_groups[:3], start=1):
        group = [cred.site_name for cred in creds if cred.reuse_hash == reuse_hash][:4]
        group_ids = [cred.id for cred in creds if cred.reuse_hash == reuse_hash]
        actions.append(
            _action(
                action_id=f"reuse-{index}",
                kind="reused_password",
                priority="high",
                title="The same password is used across multiple accounts",
                description=f"Affected records: {', '.join(group)}.",
                action_label="Split passwords",
                estimated_score_gain=max(2, round(100 * 0.20 * breakdown["reused_ratio"])),
                credential_ids=group_ids,
            )
        )

    stale_creds = [
        cred for cred in creds
        if scoring_service._is_stale_credential(cred) and cred.id not in open_incident_cred_ids
    ]
    for cred in stale_creds[:3]:
        actions.append(
            _action(
                action_id=f"stale-{cred.id}",
                kind="stale_password",
                priority="medium",
                title=f"{cred.site_name} has not been updated in a long time",
                description="A password older than 90 days may create extra risk on critical accounts.",
                action_label="Rotate password",
                estimated_score_gain=max(1, round(100 * 0.10 * breakdown["stale_ratio"])),
                credential_id=cred.id,
                site_name=cred.site_name,
            )
        )

    recovery_codes = (
        db.query(RecoveryCode)
        .filter(RecoveryCode.user_id == user_id)
        .order_by(RecoveryCode.created_at.desc())
        .all()
    )
    remaining_codes = sum(1 for code in recovery_codes if not code.is_used)
    if remaining_codes == 0:
        actions.append(
            _action(
                action_id="recovery-codes-none",
                kind="recovery_codes",
                priority="critical",
                title="No recovery codes available",
                description="There are no backup codes available to regain access if authenticator access is lost.",
                action_label="Generate new recovery codes",
                estimated_score_gain=0,
            )
        )
    elif remaining_codes <= 2:
        actions.append(
            _action(
                action_id="recovery-codes-low",
                kind="recovery_codes",
                priority="high",
                title="Recovery code inventory is running low",
                description=f"Only {remaining_codes} unused recovery codes remain.",
                action_label="Refresh codes",
                estimated_score_gain=0,
            )
        )

    if breakdown["totp_enabled_count"] == 0 and breakdown["total_credentials"] > 0:
        actions.append(
            _action(
                action_id="totp-bonus",
                kind="totp_bonus",
                priority="medium",
                title="TOTP bonus is not being used",
                description="Enabling TOTP on critical accounts improves security and adds a score bonus.",
                action_label="Add TOTP",
                estimated_score_gain=8,
            )
        )

    actions = sorted(actions, key=lambda item: (_priority_rank(item["priority"]), -item["estimated_score_gain"]))[:MAX_ACTIONS]

    return {
        "summary": _build_summary(score_data["score"], actions, remaining_codes, open_incidents, resolved_incidents),
        "actions": actions,
        "open_follow_up": [_serialize_follow_up(incident) for incident in open_incidents],
        "recently_resolved": [_serialize_follow_up(incident) for incident in resolved_incidents],
    }


def get_action_center(db: Session, user_id: int, key: Optional[bytes] = None) -> dict:
    raw_data = get_action_center_raw(db, user_id, key)
    try:
        from services import ai_advisor_service
        ai_actions = ai_advisor_service.generate_action_plan(raw_data)
        if ai_actions:
            raw_data["actions"] = ai_actions
            raw_data["summary"] = {
                **raw_data["summary"],
                "open_actions": len(ai_actions),
                "critical_actions": sum(1 for item in ai_actions if item["priority"] == "critical"),
                "high_actions": sum(1 for item in ai_actions if item["priority"] == "high"),
                "medium_actions": sum(1 for item in ai_actions if item["priority"] == "medium"),
            }
    except Exception:
        pass
    return raw_data
