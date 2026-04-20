from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from database import Credential, HealthSnapshot, ScoreHistory
from services import strength_service

STALE_DAYS = 90
HISTORY_MIN_INTERVAL_MINUTES = 10


def _is_stale_credential(credential: Credential) -> bool:
    ref = credential.updated_at or credential.created_at
    if ref is None:
        return False
    return (datetime.utcnow() - ref) > timedelta(days=STALE_DAYS)


def _safe_ratio(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return count / total


def _score_band(score: int) -> str:
    if score >= 85:
        return "excellent"
    if score >= 70:
        return "good"
    if score >= 45:
        return "watch"
    return "critical"


def _build_breakdown(creds: list[Credential]) -> tuple[int, dict]:
    total_credentials = len(creds)

    if total_credentials == 0:
        score = 100
        breakdown = {
            "model_version": "v3",
            "score_band": _score_band(score),
            "total_credentials": 0,
            "weak_count": 0,
            "medium_count": 0,
            "reused_count": 0,
            "breached_count": 0,
            "email_breached_count": 0,
            "breach_any_count": 0,
            "stale_count": 0,
            "not_rotated_count": 0,
            "totp_enabled_count": 0,
            "weak_ratio": 0.0,
            "medium_ratio": 0.0,
            "reused_ratio": 0.0,
            "breach_any_ratio": 0.0,
            "stale_ratio": 0.0,
            "not_rotated_ratio": 0.0,
            "totp_ratio": 0.0,
            "unique_ratio": 0.0,
            "base_score": 100,
            "bonus_totp": 0,
            "bonus_unique": 0,
            "bonus_total": 0,
        }
        return score, breakdown

    weak_count = sum(1 for c in creds if c.strength_label == "weak")
    medium_count = sum(1 for c in creds if c.strength_label == "medium")
    breached_count = sum(1 for c in creds if c.is_breached)
    email_breached_count = sum(1 for c in creds if getattr(c, "email_breached", False))
    breach_any_count = sum(1 for c in creds if c.is_breached or getattr(c, "email_breached", False))
    stale_count = sum(1 for c in creds if _is_stale_credential(c))
    not_rotated_count = sum(1 for c in creds if c.breach_date_status == "not_rotated")
    totp_enabled_count = sum(1 for c in creds if bool(getattr(c, "totp_secret", None)))

    hashes = [c.reuse_hash for c in creds if c.reuse_hash]
    hash_counts = Counter(hashes)
    reused_count = sum(count - 1 for count in hash_counts.values() if count > 1)
    unique_ratio = _safe_ratio(len(hash_counts), total_credentials)

    weak_ratio = _safe_ratio(weak_count, total_credentials)
    medium_ratio = _safe_ratio(medium_count, total_credentials)
    reused_ratio = _safe_ratio(reused_count, total_credentials)
    breach_any_ratio = _safe_ratio(breach_any_count, total_credentials)
    stale_ratio = _safe_ratio(stale_count, total_credentials)
    not_rotated_ratio = _safe_ratio(not_rotated_count, total_credentials)
    totp_ratio = _safe_ratio(totp_enabled_count, total_credentials)

    weighted_risk = (
        0.30 * weak_ratio
        + 0.10 * medium_ratio
        + 0.20 * reused_ratio
        + 0.25 * breach_any_ratio
        + 0.10 * stale_ratio
        + 0.05 * not_rotated_ratio
    )
    base_score = round(100 * (1 - weighted_risk))

    bonus_totp = round(8 * totp_ratio)
    bonus_unique = round(5 * unique_ratio)
    bonus_total = bonus_totp + bonus_unique
    score = max(0, min(100, base_score + bonus_total))

    breakdown = {
        "model_version": "v3",
        "score_band": _score_band(score),
        "total_credentials": total_credentials,
        "weak_count": weak_count,
        "medium_count": medium_count,
        "reused_count": reused_count,
        "breached_count": breached_count,
        "email_breached_count": email_breached_count,
        "breach_any_count": breach_any_count,
        "stale_count": stale_count,
        "not_rotated_count": not_rotated_count,
        "totp_enabled_count": totp_enabled_count,
        "weak_ratio": round(weak_ratio, 4),
        "medium_ratio": round(medium_ratio, 4),
        "reused_ratio": round(reused_ratio, 4),
        "breach_any_ratio": round(breach_any_ratio, 4),
        "stale_ratio": round(stale_ratio, 4),
        "not_rotated_ratio": round(not_rotated_ratio, 4),
        "totp_ratio": round(totp_ratio, 4),
        "unique_ratio": round(unique_ratio, 4),
        "base_score": base_score,
        "bonus_totp": bonus_totp,
        "bonus_unique": bonus_unique,
        "bonus_total": bonus_total,
    }
    return score, breakdown


def _risk_driver(
    key: str,
    title: str,
    severity: str,
    count: int,
    ratio: float,
    weight: float,
    explanation: str,
    recommendation: str,
) -> dict:
    return {
        "key": key,
        "title": title,
        "severity": severity,
        "count": count,
        "ratio": round(ratio, 4),
        "weight": weight,
        "impact_points": round(100 * weight * ratio),
        "explanation": explanation,
        "recommendation": recommendation,
    }


def _build_explanations(breakdown: dict) -> list[dict]:
    explanations: list[dict] = []

    if breakdown["breach_any_count"] > 0:
        explanations.append(
            _risk_driver(
                "breach_any",
                "İhlalli hesaplar skoru aşağı çekiyor",
                "critical",
                breakdown["breach_any_count"],
                breakdown["breach_any_ratio"],
                0.25,
                "E-posta veya parola ihlali görülen kayıtlar en ağır risk kalemlerinden biri.",
                "Önce ihlalli kayıtların parolasını değiştirin ve mümkünse TOTP ekleyin.",
            )
        )
    if breakdown["weak_count"] > 0:
        explanations.append(
            _risk_driver(
                "weak",
                "Zayıf parolalar kolay tahmin edilebilir",
                "high",
                breakdown["weak_count"],
                breakdown["weak_ratio"],
                0.30,
                "Zayıf parolalar skora doğrudan yüksek ceza veriyor.",
                "Zayıf kayıtları güçlü ve benzersiz parolalarla değiştirin.",
            )
        )
    if breakdown["reused_count"] > 0:
        explanations.append(
            _risk_driver(
                "reused",
                "Aynı parola birden fazla yerde kullanılıyor",
                "high",
                breakdown["reused_count"],
                breakdown["reused_ratio"],
                0.20,
                "Bir hesap sızarsa aynı parola kullanılan diğer hesaplar da etkilenir.",
                "Tekrar kullanılan parolaları ayırın.",
            )
        )
    if breakdown["stale_count"] > 0:
        explanations.append(
            _risk_driver(
                "stale",
                "Eski parolalar yenilenmemiş",
                "medium",
                breakdown["stale_count"],
                breakdown["stale_ratio"],
                0.10,
                "Uzun süredir değişmeyen kritik hesaplar ek risk oluşturur.",
                "90 günü geçen kayıtları gözden geçirip döndürün.",
            )
        )
    if breakdown["not_rotated_count"] > 0:
        explanations.append(
            _risk_driver(
                "not_rotated",
                "İhlal sonrası güncellenmemiş kayıtlar var",
                "critical",
                breakdown["not_rotated_count"],
                breakdown["not_rotated_ratio"],
                0.05,
                "İhlal tarihi sonrasına taşınmayan kayıtlar hâlâ açık risk olabilir.",
                "Bu hesapları hemen güncelleyin ve takip vakasını kapatın.",
            )
        )
    if breakdown["totp_enabled_count"] == 0 and breakdown["total_credentials"] > 0:
        explanations.append(
            {
                "key": "totp_bonus",
                "title": "TOTP bonusu kullanılamıyor",
                "severity": "medium",
                "count": 0,
                "ratio": breakdown["totp_ratio"],
                "weight": 0.08,
                "impact_points": 8,
                "explanation": "Hiç TOTP aktif kayıt olmadığı için güvenlik bonusu alınamıyor.",
                "recommendation": "Özellikle kritik hesaplara TOTP ekleyin.",
            }
        )

    if not explanations:
        explanations.append(
            {
                "key": "healthy",
                "title": "Belirgin risk baskısı görünmüyor",
                "severity": "info",
                "count": 0,
                "ratio": 0.0,
                "weight": 0.0,
                "impact_points": 0,
                "explanation": "Şu an skoru aşağı çeken büyük bir risk kalemi görünmüyor.",
                "recommendation": "Mevcut güvenlik seviyesini koruyun ve düzenli taramaya devam edin.",
            }
        )

    priority_order = {"critical": 0, "high": 1, "medium": 2, "info": 3}
    return sorted(
        explanations,
        key=lambda item: (priority_order.get(item["severity"], 9), -item["impact_points"], -item["count"]),
    )


def _build_suggested_actions(breakdown: dict) -> list[dict]:
    suggestions: list[dict] = []

    if breakdown["breach_any_count"] > 0:
        suggestions.append(
            {
                "key": "fix_breached",
                "label": "İhlalli kayıtları düzelt",
                "estimated_score_gain": max(4, round(100 * 0.25 * breakdown["breach_any_ratio"])),
                "reason": "İhlal kalemi en ağır cezalardan birini oluşturuyor.",
            }
        )
    if breakdown["weak_count"] > 0:
        suggestions.append(
            {
                "key": "upgrade_weak",
                "label": "Zayıf parolaları güçlendir",
                "estimated_score_gain": max(3, round(100 * 0.30 * breakdown["weak_ratio"])),
                "reason": "Zayıf parola oranı düştüğünde skor hızlı toparlanır.",
            }
        )
    if breakdown["reused_count"] > 0:
        suggestions.append(
            {
                "key": "remove_reuse",
                "label": "Tekrar kullanılan parolaları ayır",
                "estimated_score_gain": max(2, round(100 * 0.20 * breakdown["reused_ratio"])),
                "reason": "Aynı parolayı kullanan hesapları ayırmak zincir riski azaltır.",
            }
        )
    if breakdown["stale_count"] > 0:
        suggestions.append(
            {
                "key": "rotate_stale",
                "label": "Eski parolaları döndür",
                "estimated_score_gain": max(1, round(100 * 0.10 * breakdown["stale_ratio"])),
                "reason": "Düzenli rotasyon özellikle kritik hesaplarda güvenlik duruşunu iyileştirir.",
            }
        )
    if breakdown["totp_enabled_count"] == 0 and breakdown["total_credentials"] > 0:
        suggestions.append(
            {
                "key": "enable_totp",
                "label": "TOTP ekle",
                "estimated_score_gain": 8,
                "reason": "TOTP aktif kayıtlar doğrudan pozitif bonus getirir.",
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "key": "maintain",
                "label": "Mevcut seviyeyi koru",
                "estimated_score_gain": 0,
                "reason": "Büyük açık görünmüyor; düzenli tarama ve iyi parolalarla devam edin.",
            }
        )

    return sorted(suggestions, key=lambda item: -item["estimated_score_gain"])


def _persist_health_history(db: Session, user_id: int, score: int, breakdown: dict) -> None:
    now = datetime.utcnow()
    last_entry = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.user_id == user_id)
        .order_by(ScoreHistory.calculated_at.desc())
        .first()
    )
    should_persist = True
    if last_entry and last_entry.score == score:
        should_persist = (now - last_entry.calculated_at) >= timedelta(minutes=HISTORY_MIN_INTERVAL_MINUTES)

    if not should_persist:
        return

    db.add(
        ScoreHistory(
            user_id=user_id,
            score=score,
            calculated_at=now,
        )
    )
    db.add(
        HealthSnapshot(
            user_id=user_id,
            score=score,
            weak_count=breakdown["weak_count"],
            medium_count=breakdown["medium_count"],
            reused_count=breakdown["reused_count"],
            breach_any_count=breakdown["breach_any_count"],
            stale_count=breakdown["stale_count"],
            totp_enabled_count=breakdown["totp_enabled_count"],
            created_at=now,
        )
    )
    db.commit()


def calculate_score(db: Session, user_id: int, key: Optional[bytes] = None, persist: bool = True) -> dict:
    creds = db.query(Credential).filter(Credential.user_id == user_id).all()
    if key is not None:
        strength_service.sync_credential_strength_labels(db, creds, key)
    score, breakdown = _build_breakdown(creds)
    explanations = _build_explanations(breakdown)
    suggested_actions = _build_suggested_actions(breakdown)

    if persist:
        _persist_health_history(db, user_id, score, breakdown)

    return {
        "score": score,
        "breakdown": breakdown,
        "explanations": explanations,
        "suggested_actions": suggested_actions,
    }


def get_history(db: Session, user_id: int) -> list[ScoreHistory]:
    return (
        db.query(ScoreHistory)
        .filter(ScoreHistory.user_id == user_id)
        .order_by(ScoreHistory.calculated_at.asc())
        .all()
    )


def get_health_trend(db: Session, user_id: int) -> dict:
    points = (
        db.query(HealthSnapshot)
        .filter(HealthSnapshot.user_id == user_id)
        .order_by(HealthSnapshot.created_at.asc())
        .all()
    )

    if len(points) < 2:
        summary = {
            "trend_direction": "insufficient_data",
            "score_delta": 0,
            "weak_delta": 0,
            "breach_delta": 0,
            "stale_delta": 0,
            "reused_delta": 0,
        }
    else:
        first = points[0]
        last = points[-1]
        score_delta = last.score - first.score
        weak_delta = last.weak_count - first.weak_count
        breach_delta = last.breach_any_count - first.breach_any_count
        stale_delta = last.stale_count - first.stale_count
        reused_delta = last.reused_count - first.reused_count

        if score_delta > 0 or sum(delta < 0 for delta in [weak_delta, breach_delta, stale_delta, reused_delta]) >= 2:
            direction = "improving"
        elif score_delta < 0 or sum(delta > 0 for delta in [weak_delta, breach_delta, stale_delta, reused_delta]) >= 2:
            direction = "declining"
        else:
            direction = "stable"

        summary = {
            "trend_direction": direction,
            "score_delta": score_delta,
            "weak_delta": weak_delta,
            "breach_delta": breach_delta,
            "stale_delta": stale_delta,
            "reused_delta": reused_delta,
        }

    return {
        "points": points,
        "summary": summary,
    }
