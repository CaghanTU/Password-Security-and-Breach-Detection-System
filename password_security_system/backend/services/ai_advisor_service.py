import json
import logging
import time
from datetime import datetime

import requests
from sqlalchemy.orm import Session

from config import AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_TIMEOUT_SECONDS
from services import password_service, scoring_service

logger = logging.getLogger(__name__)
DEFAULT_GEMINI_FALLBACKS = [
    "gemini-2.5-flash-lite",
]

PLAN_WINDOWS = ["0-6 saat", "6-24 saat", "24-48 saat"]


def _build_context(score_data: dict, action_data: dict) -> dict:
    breakdown = score_data["breakdown"]
    explanations = score_data.get("explanations", [])[:3]
    actions = action_data.get("actions", [])[:3]

    return {
        "score": score_data["score"],
        "score_band": breakdown["score_band"],
        "counts": {
            "total_credentials": breakdown["total_credentials"],
            "weak": breakdown["weak_count"],
            "breach_any": breakdown["breach_any_count"],
            "reused": breakdown["reused_count"],
            "stale": breakdown["stale_count"],
            "totp_enabled": breakdown["totp_enabled_count"],
            "recovery_codes_remaining": action_data["summary"]["recovery_codes_remaining"],
            "open_actions": action_data["summary"]["open_actions"],
            "unresolved_breach_cases": action_data["summary"]["unresolved_breach_cases"],
        },
        "risk_drivers": [
            {
                "title": item["title"],
                "severity": item["severity"],
                "count": item["count"],
                "recommendation": item["recommendation"],
            }
            for item in explanations
        ],
        "top_actions": [
            {
                "priority": item["priority"],
                "title": item["title"],
                "description": item["description"],
                "estimated_score_gain": item["estimated_score_gain"],
                "site_name": item.get("site_name"),
            }
            for item in actions
        ],
        "focus_sites": [item.get("site_name") for item in actions if item.get("site_name")][:3],
    }


def _build_action_plan_context(action_data: dict) -> dict:
    summary = action_data["summary"]
    actions = action_data.get("actions", [])[:8]
    return {
        "current_score": summary["current_score"],
        "open_actions": summary["open_actions"],
        "critical_actions": summary["critical_actions"],
        "high_actions": summary["high_actions"],
        "medium_actions": summary["medium_actions"],
        "recovery_codes_remaining": summary["recovery_codes_remaining"],
        "unresolved_breach_cases": summary["unresolved_breach_cases"],
        "candidates": [
            {
                "id": item["id"],
                "kind": item["kind"],
                "priority": item["priority"],
                "title": item["title"],
                "description": item["description"],
                "action_label": item["action_label"],
                "estimated_score_gain": item["estimated_score_gain"],
                "site_name": item.get("site_name"),
            }
            for item in actions
        ],
    }


def _credential_status_label(cred: dict) -> str:
    reasons = []
    if cred.get("is_breached") or cred.get("email_breached"):
        reasons.append("ihlal riski")
    if cred.get("strength_label") == "weak":
        reasons.append("zayıf parola")
    if cred.get("is_stale"):
        reasons.append("eski parola")
    if cred.get("breach_date_status") == "not_rotated":
        reasons.append("ihlal sonrası güncellenmedi")
    if not reasons:
        return "izleme"
    return ", ".join(reasons[:2])


def _top_risky_credentials(credentials: list[dict], limit: int = 3) -> list[dict]:
    def risk_score(cred: dict) -> tuple[int, str]:
        score = 0
        if cred.get("is_breached") or cred.get("email_breached"):
            score += 4
        if cred.get("strength_label") == "weak":
            score += 3
        if cred.get("breach_date_status") == "not_rotated":
            score += 2
        if cred.get("is_stale"):
            score += 1
        return (-score, cred.get("site_name", ""))

    risky = [
        cred for cred in credentials
        if cred.get("is_breached")
        or cred.get("email_breached")
        or cred.get("strength_label") == "weak"
        or cred.get("is_stale")
    ]
    return sorted(risky, key=risk_score)[:limit]


def _build_insights_context(score_data: dict, action_data: dict, credentials: list[dict], trend_data: dict, score_history: list[dict]) -> dict:
    summary = action_data["summary"]
    top_credentials = _top_risky_credentials(credentials, limit=4)
    return {
        "score": score_data["score"],
        "score_band": score_data["breakdown"]["score_band"],
        "counts": {
            "total_credentials": score_data["breakdown"]["total_credentials"],
            "weak": score_data["breakdown"]["weak_count"],
            "breach_any": score_data["breakdown"]["breach_any_count"],
            "reused": score_data["breakdown"]["reused_count"],
            "stale": score_data["breakdown"]["stale_count"],
            "totp_enabled": score_data["breakdown"]["totp_enabled_count"],
            "recovery_codes_remaining": summary["recovery_codes_remaining"],
            "open_actions": summary["open_actions"],
        },
        "trend": trend_data.get("summary", {}),
        "recent_scores": [getattr(item, "score", 0) for item in score_history[-5:]],
        "top_actions": [
            {
                "id": item["id"],
                "priority": item["priority"],
                "title": item["title"],
                "description": item["description"],
                "estimated_score_gain": item["estimated_score_gain"],
                "site_name": item.get("site_name"),
            }
            for item in action_data.get("actions", [])[:6]
        ],
        "accounts": [
            {
                "credential_id": cred["id"],
                "site_name": cred["site_name"],
                "category": cred.get("category", "other"),
                "status_label": _credential_status_label(cred),
                "has_totp": bool(cred.get("totp_secret")),
            }
            for cred in top_credentials
        ],
    }


def _risk_posture(score: int) -> str:
    if score >= 85:
        return "Savunma duruşu güçlü görünüyor."
    if score >= 70:
        return "Genel tablo iyi, ancak birkaç alan iyileştirme bekliyor."
    if score >= 45:
        return "Risk görünümü dikkat istiyor; kısa vadeli müdahale gerekli."
    return "Risk baskısı yüksek; kritik açıklar öncelikli ele alınmalı."


def _fallback_advice(score_data: dict, action_data: dict) -> dict:
    breakdown = score_data["breakdown"]
    actions = action_data.get("actions", [])
    primary_action = actions[0] if actions else None

    priorities = []
    for item in actions[:3]:
        site_prefix = f"{item['site_name']}: " if item.get("site_name") else ""
        detail = f"{site_prefix}{item['description']}"
        if item.get("estimated_score_gain", 0) > 0:
            detail += f" Tahmini etki: +{item['estimated_score_gain']} puan."
        priorities.append({
            "title": item["title"],
            "detail": detail,
            "impact": "Bu adım atlanırsa ilgili risk baskısı devam eder.",
        })

    if not priorities:
        priorities.append({
            "title": "Belirgin açık aksiyon görünmüyor",
            "detail": "Düzenli tarama ve parola rotasyonu ile mevcut güvenlik seviyesini koruyun.",
            "impact": "Düzenli bakım yapılmazsa skor zamanla yeniden düşebilir.",
        })

    summary_parts = []
    if breakdown["breach_any_count"] > 0:
        summary_parts.append(f"{breakdown['breach_any_count']} ihlalli kayıt")
    if breakdown["weak_count"] > 0:
        summary_parts.append(f"{breakdown['weak_count']} zayıf parola")
    if breakdown["reused_count"] > 0:
        summary_parts.append(f"{breakdown['reused_count']} tekrar kullanılan parola")
    if breakdown["stale_count"] > 0:
        summary_parts.append(f"{breakdown['stale_count']} eski kayıt")

    if summary_parts:
        summary = (
            f"Skor {score_data['score']}/100 seviyesinde. "
            f"En görünür baskı alanları: {', '.join(summary_parts)}."
        )
    else:
        summary = (
            f"Skor {score_data['score']}/100 seviyesinde. "
            "Şu an büyük bir risk baskısı görünmüyor; sürdürülebilir güvenlik için düzenli izleme yeterli."
        )

    if primary_action:
        next_step = f"İlk adım olarak '{primary_action['title']}' aksiyonunu ele alın."
    elif breakdown["totp_enabled_count"] == 0 and breakdown["total_credentials"] > 0:
        next_step = "İlk adım olarak kritik hesaplara TOTP ekleyin."
    else:
        next_step = "İlk adım olarak kritik hesapları gözden geçirip düzenli parola yenileme planı oluşturun."

    return {
        "source": "fallback",
        "model": "local-risk-summary",
        "generated_at": datetime.utcnow(),
        "headline": "Mevcut risk görünümünde kısa vadeli müdahale gerektiren noktalar var.",
        "summary": summary,
        "risk_posture": _risk_posture(score_data["score"]),
        "why_now": "Kritik risk kalemleri çözümsüz kaldıkça hem hesap ele geçirme ihtimali hem de zincirleme etki büyür.",
        "next_step": next_step,
        "priorities": priorities,
    }


def _fallback_plan_48h(action_data: dict) -> list[dict]:
    raw_actions = action_data.get("actions", [])[:3]
    plan = []
    for index, window in enumerate(PLAN_WINDOWS):
        item = raw_actions[index] if index < len(raw_actions) else None
        if item:
            plan.append({
                "window": window,
                "title": item["title"],
                "detail": item["description"],
            })
        else:
            plan.append({
                "window": window,
                "title": "Düzenli güvenlik bakımı",
                "detail": "Açık kritik iş kalmadıysa kasadaki kayıtları ve 2FA durumunu gözden geçirin.",
            })
    return plan


def _action_effect_text(item: dict) -> str:
    gain = item.get("estimated_score_gain", 0)
    if gain > 0:
        return f"Skor yaklaşık +{gain} puan iyileşebilir"
    if item.get("kind") == "recovery_codes":
        return "Hesap kurtarma güvenliği güçlenir"
    return "Risk baskısı azalır"


def _what_if_title(item: dict) -> str:
    site_name = item.get("site_name")
    kind = item.get("kind")
    if kind == "breach_followup":
        return f"{site_name or 'İhlalli hesap'} güncellenirse"
    if kind == "weak_password":
        return f"{site_name or 'Zayıf parola'} güçlendirilirse"
    if kind == "reused_password":
        return "Tekrar kullanılan parolalar ayrılırsa"
    if kind == "stale_password":
        return f"{site_name or 'Eski parola'} döndürülürse"
    if kind == "recovery_codes":
        return "Recovery code stoğu yenilenirse"
    if kind == "totp_bonus":
        return "TOTP etkinleştirilirse"
    return item.get("title", "Risk azaltma adımı tamamlanırsa")


def _what_if_detail(item: dict) -> str:
    site_prefix = f"{item['site_name']} hesabında " if item.get("site_name") else ""
    kind = item.get("kind")
    if kind == "breach_followup":
        return f"{site_prefix}ihlal sonrası parola değişimi ve ikinci faktör eklenmesi açık ihlal baskısını azaltır."
    if kind == "weak_password":
        return f"{site_prefix}zayıf parola daha güçlü ve benzersiz bir parola ile değiştirildiğinde ele geçirilme riski düşer."
    if kind == "reused_password":
        return "Aynı parolayı paylaşan kayıtlar ayrıldığında zincirleme hesap etkisi azaltılır."
    if kind == "stale_password":
        return f"{site_prefix}uzun süredir değişmeyen parola yenilendiğinde güncel olmayan kimlik bilgisi riski azalır."
    if kind == "recovery_codes":
        return "Yedek kodlar yenilendiğinde authenticator erişimi kaybolsa bile hesap kurtarma güvenceye alınır."
    if kind == "totp_bonus":
        return "Kritik hesaplarda ikinci faktör açıldığında yalnızca parola ele geçirilse bile ek koruma devreye girer."
    return item.get("description", "Bu adım tamamlandığında ilgili risk kalemi zayıflar.")


def _fallback_what_if(action_data: dict) -> list[dict]:
    scenarios = []
    for item in action_data.get("actions", [])[:3]:
        scenarios.append({
            "title": _what_if_title(item),
            "effect": _action_effect_text(item),
            "detail": _what_if_detail(item),
        })
    if not scenarios:
        scenarios.append({
            "title": "Mevcut seviyeyi koru",
            "effect": "Skoru dengede tutar",
            "detail": "Parola rotasyonu ve 2FA disiplini sürdürülürse yeni risk baskısı sınırlı kalır.",
        })
    return scenarios[:3]


def _fallback_weekly_summary(score_data: dict, trend_data: dict, action_data: dict) -> dict:
    breakdown = score_data["breakdown"]
    trend = trend_data.get("summary", {})
    score_delta = int(trend.get("score_delta", 0) or 0)
    if score_delta > 0:
        trend_line = f"Son kayıt aralığında skor {score_delta} puan iyileşmiş."
    elif score_delta < 0:
        trend_line = f"Son kayıt aralığında skor {abs(score_delta)} puan gerilemiş."
    else:
        trend_line = "Son kayıt aralığında skor büyük ölçüde yatay seyretmiş."

    watch_items = []
    if breakdown["breach_any_count"] > 0:
        watch_items.append(
            f"{breakdown['breach_any_count']} kayıt ihlal riski taşıyor; bu hesaplar kapanmadan kritik baskı devam eder."
        )
    if breakdown["weak_count"] > 0:
        watch_items.append(
            f"{breakdown['weak_count']} zayıf parola hızlı iyileştirme alanı sunuyor."
        )
    if breakdown["reused_count"] > 0:
        watch_items.append(
            f"{breakdown['reused_count']} tekrar kullanılan parola, tek sızıntının birden fazla hesabı etkilemesine yol açabilir."
        )
    if breakdown["stale_count"] > 0 and len(watch_items) < 3:
        watch_items.append(
            f"{breakdown['stale_count']} kayıt 90 gün eşiğini aşmış durumda; özellikle kritik hesaplar için parola rotasyonu önerilir."
        )
    if breakdown["totp_enabled_count"] == 0 and breakdown["total_credentials"] > 0 and len(watch_items) < 3:
        watch_items.append("Henüz TOTP aktif kayıt görünmüyor; ikinci faktör koruması hâlâ açık bir iyileştirme alanı.")
    if action_data["summary"]["open_actions"] > 0 and len(watch_items) < 3:
        watch_items.append(
            f"{action_data['summary']['open_actions']} açık aksiyon bulunuyor; ilk üç aksiyon kapatıldığında görünüm daha dengeli hale gelir."
        )

    while len(watch_items) < 3:
        watch_items.append("Büyük bir yeni risk görünmüyor; düzenli tarama ve parola yenileme ile mevcut seviye korunabilir.")

    return {
        "headline": "Haftalık parola güvenliği özeti",
        "summary": (
            f"Anlık skor {score_data['score']}/100. {trend_line} "
            f"Şu anda {breakdown['weak_count']} zayıf, {breakdown['breach_any_count']} ihlal riski taşıyan "
            f"ve {breakdown['reused_count']} tekrar kullanılan kayıt bulunuyor."
        ),
        "watch_items": watch_items[:3],
    }


def _account_recommendation(cred: dict) -> str:
    recommendations = []
    if cred.get("is_breached") or cred.get("email_breached") or cred.get("breach_date_status") == "not_rotated":
        recommendations.append("parolayı hemen değiştirin")
    if cred.get("strength_label") == "weak":
        recommendations.append("benzersiz ve güçlü bir parola kullanın")
    if cred.get("is_stale"):
        recommendations.append("parolayı güncelleyin")
    if not cred.get("totp_secret") and cred.get("category") in {"banking", "email", "work"}:
        recommendations.append("mümkünse TOTP ekleyin")

    if not recommendations:
        return "Kaydı izlemeye devam edin ve düzenli güvenlik taramasını sürdürün."

    sentence = ", ".join(recommendations[:3])
    return f"Bu hesap için {sentence}."


def _fallback_account_reviews(credentials: list[dict]) -> list[dict]:
    reviews = []
    for cred in _top_risky_credentials(credentials, limit=3):
        status_label = _credential_status_label(cred)
        reviews.append({
            "credential_id": cred["id"],
            "site_name": cred["site_name"],
            "status_label": status_label,
            "summary": f"{cred['site_name']} kaydı şu anda {status_label} nedeniyle öncelikli inceleme gerektiriyor.",
            "recommendation": _account_recommendation(cred),
        })
    return reviews


def _fallback_insights(score_data: dict, action_data: dict, credentials: list[dict], trend_data: dict) -> dict:
    briefing = _fallback_advice(score_data, action_data)
    return {
        "source": briefing["source"],
        "model": briefing["model"],
        "generated_at": briefing["generated_at"],
        "briefing": briefing,
        "plan_48h": _fallback_plan_48h(action_data),
        "what_if_scenarios": _fallback_what_if(action_data),
        "weekly_summary": _fallback_weekly_summary(score_data, trend_data, action_data),
        "account_reviews": _fallback_account_reviews(credentials),
    }


def _extract_json(content: str) -> dict:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


def _candidate_models() -> list[str]:
    models = [AI_MODEL]
    if "generativelanguage.googleapis.com" in AI_BASE_URL and AI_MODEL.startswith("gemini-"):
        models.extend(DEFAULT_GEMINI_FALLBACKS)

    deduped: list[str] = []
    for model in models:
        model = (model or "").strip()
        if model and model not in deduped:
            deduped.append(model)
    return deduped


def _call_ai(context: dict) -> dict:
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not configured")

    endpoint = f"{AI_BASE_URL.rstrip('/')}/chat/completions"
    system_prompt = (
        "You are a cybersecurity advisor embedded in a password security dashboard. "
        "Use only the supplied metrics. Do not invent incidents, tools, or accounts. "
        "Respond in Turkish. Return only valid JSON with this exact shape: "
        "{\"headline\": string, \"summary\": string, \"risk_posture\": string, \"why_now\": string, \"next_step\": string, "
        "\"priorities\": [{\"title\": string, \"detail\": string, \"impact\": string}, {\"title\": string, \"detail\": string, \"impact\": string}, {\"title\": string, \"detail\": string, \"impact\": string}]}. "
        "Make the wording feel like a human security analyst, not a template. "
        "Reference concrete risk patterns or focus sites from the input when available. "
        "Keep the tone concise, practical, and academically credible. "
        "Do not use markdown fences."
    )
    user_prompt = json.dumps(context, ensure_ascii=False)

    last_error: Exception | None = None
    for model in _candidate_models():
        for attempt in range(2):
            response = None
            try:
                response = requests.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {AI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "temperature": 0.2,
                        "max_tokens": 400,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                    timeout=AI_TIMEOUT_SECONDS,
                )
                response.raise_for_status()

                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                parsed = _extract_json(content)

                priorities = parsed.get("priorities") or []
                cleaned_priorities = []
                for item in priorities[:3]:
                    title = str(item.get("title", "")).strip()
                    detail = str(item.get("detail", "")).strip()
                    impact = str(item.get("impact", "")).strip()
                    if title and detail and impact:
                        cleaned_priorities.append({"title": title, "detail": detail, "impact": impact})

                if not cleaned_priorities:
                    raise ValueError("AI response did not include usable priorities")

                headline = str(parsed.get("headline", "")).strip()
                summary = str(parsed.get("summary", "")).strip()
                risk_posture = str(parsed.get("risk_posture", "")).strip()
                why_now = str(parsed.get("why_now", "")).strip()
                next_step = str(parsed.get("next_step", "")).strip()
                if not (headline and summary and risk_posture and why_now and next_step):
                    raise ValueError("AI response was missing required text fields")

                return {
                    "source": "ai",
                    "model": model,
                    "generated_at": datetime.utcnow(),
                    "headline": headline,
                    "summary": summary,
                    "risk_posture": risk_posture,
                    "why_now": why_now,
                    "next_step": next_step,
                    "priorities": cleaned_priorities,
                }
            except Exception as exc:
                last_error = exc
                status_code = getattr(response, "status_code", None)
                is_retryable = status_code in {429, 500, 502, 503, 504}
                logger.warning(
                    "AI advisor call failed for model=%s attempt=%s status=%s error=%s",
                    model,
                    attempt + 1,
                    status_code,
                    exc,
                )
                if (is_retryable or isinstance(exc, ValueError)) and attempt == 0:
                    time.sleep(1.0)
                    continue
                break

    if last_error:
        raise last_error
    raise RuntimeError("AI call failed without a concrete error")


def _call_insights_ai(context: dict) -> dict:
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not configured")

    endpoint = f"{AI_BASE_URL.rstrip('/')}/chat/completions"
    system_prompt = (
        "You are a cybersecurity analyst embedded in a password security dashboard. "
        "Use only the supplied metrics, actions, and account list. Do not invent new accounts or new incidents. "
        "Respond in Turkish and return only valid JSON with this exact shape: "
        "{\"briefing\":{\"headline\":string,\"summary\":string,\"risk_posture\":string,\"why_now\":string,\"next_step\":string,"
        "\"priorities\":[{\"title\":string,\"detail\":string,\"impact\":string},{\"title\":string,\"detail\":string,\"impact\":string},{\"title\":string,\"detail\":string,\"impact\":string}]},"
        "\"plan_48h\":[{\"window\":string,\"title\":string,\"detail\":string},{\"window\":string,\"title\":string,\"detail\":string},{\"window\":string,\"title\":string,\"detail\":string}],"
        "\"what_if_scenarios\":[{\"title\":string,\"effect\":string,\"detail\":string},{\"title\":string,\"effect\":string,\"detail\":string},{\"title\":string,\"effect\":string,\"detail\":string}],"
        "\"weekly_summary\":{\"headline\":string,\"summary\":string,\"watch_items\":[string,string,string]},"
        "\"account_reviews\":[{\"credential_id\":number,\"site_name\":string,\"status_label\":string,\"summary\":string,\"recommendation\":string},{\"credential_id\":number,\"site_name\":string,\"status_label\":string,\"summary\":string,\"recommendation\":string},{\"credential_id\":number,\"site_name\":string,\"status_label\":string,\"summary\":string,\"recommendation\":string}]}. "
        "Make it feel like an expert analyst briefing: concrete, account-aware, and action-oriented. "
        "Use only credential_id values from the supplied accounts list. "
        "Do not use markdown fences."
    )
    user_prompt = json.dumps(context, ensure_ascii=False)
    allowed_ids = {item["credential_id"] for item in context.get("accounts", [])}

    last_error: Exception | None = None
    for model in _candidate_models():
        for attempt in range(2):
            response = None
            try:
                response = requests.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {AI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "temperature": 0.25,
                        "max_tokens": 1200,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                    timeout=AI_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                parsed = _extract_json(content)

                briefing = parsed.get("briefing") or {}
                priorities = briefing.get("priorities") or []
                cleaned_priorities = []
                for item in priorities[:3]:
                    title = str(item.get("title", "")).strip()
                    detail = str(item.get("detail", "")).strip()
                    impact = str(item.get("impact", "")).strip()
                    if title and detail and impact:
                        cleaned_priorities.append({"title": title, "detail": detail, "impact": impact})
                if not cleaned_priorities:
                    raise ValueError("AI insights response did not include usable priorities")

                cleaned_briefing = {
                    "source": "ai",
                    "model": model,
                    "generated_at": datetime.utcnow(),
                    "headline": str(briefing.get("headline", "")).strip(),
                    "summary": str(briefing.get("summary", "")).strip(),
                    "risk_posture": str(briefing.get("risk_posture", "")).strip(),
                    "why_now": str(briefing.get("why_now", "")).strip(),
                    "next_step": str(briefing.get("next_step", "")).strip(),
                    "priorities": cleaned_priorities,
                }
                if not all([
                    cleaned_briefing["headline"],
                    cleaned_briefing["summary"],
                    cleaned_briefing["risk_posture"],
                    cleaned_briefing["why_now"],
                    cleaned_briefing["next_step"],
                ]):
                    raise ValueError("AI insights briefing was missing required fields")

                plan_48h = []
                for item in (parsed.get("plan_48h") or [])[:3]:
                    window = str(item.get("window", "")).strip()
                    title = str(item.get("title", "")).strip()
                    detail = str(item.get("detail", "")).strip()
                    if window and title and detail:
                        plan_48h.append({"window": window, "title": title, "detail": detail})
                if len(plan_48h) < 3:
                    raise ValueError("AI insights did not include a complete 48h plan")

                what_if_scenarios = []
                for item in (parsed.get("what_if_scenarios") or [])[:3]:
                    title = str(item.get("title", "")).strip()
                    effect = str(item.get("effect", "")).strip()
                    detail = str(item.get("detail", "")).strip()
                    if title and effect and detail:
                        what_if_scenarios.append({"title": title, "effect": effect, "detail": detail})
                if len(what_if_scenarios) < 3:
                    raise ValueError("AI insights did not include complete what-if scenarios")

                weekly = parsed.get("weekly_summary") or {}
                watch_items = [str(item).strip() for item in (weekly.get("watch_items") or [])[:3] if str(item).strip()]
                if len(watch_items) < 3:
                    raise ValueError("AI insights weekly summary was incomplete")
                weekly_summary = {
                    "headline": str(weekly.get("headline", "")).strip(),
                    "summary": str(weekly.get("summary", "")).strip(),
                    "watch_items": watch_items,
                }
                if not weekly_summary["headline"] or not weekly_summary["summary"]:
                    raise ValueError("AI insights weekly summary was missing required text")

                account_reviews = []
                seen_ids: set[int] = set()
                for item in (parsed.get("account_reviews") or [])[:3]:
                    credential_id = item.get("credential_id")
                    try:
                        credential_id = int(credential_id)
                    except Exception:
                        continue
                    if credential_id not in allowed_ids or credential_id in seen_ids:
                        continue
                    site_name = str(item.get("site_name", "")).strip()
                    status_label = str(item.get("status_label", "")).strip()
                    summary = str(item.get("summary", "")).strip()
                    recommendation = str(item.get("recommendation", "")).strip()
                    if site_name and status_label and summary and recommendation:
                        account_reviews.append({
                            "credential_id": credential_id,
                            "site_name": site_name,
                            "status_label": status_label,
                            "summary": summary,
                            "recommendation": recommendation,
                        })
                        seen_ids.add(credential_id)

                return {
                    "source": "ai",
                    "model": model,
                    "generated_at": datetime.utcnow(),
                    "briefing": cleaned_briefing,
                    "plan_48h": plan_48h,
                    "what_if_scenarios": what_if_scenarios,
                    "weekly_summary": weekly_summary,
                    "account_reviews": account_reviews,
                }
            except Exception as exc:
                last_error = exc
                status_code = getattr(response, "status_code", None)
                is_retryable = status_code in {429, 500, 502, 503, 504}
                logger.warning(
                    "AI insights call failed for model=%s attempt=%s status=%s error=%s",
                    model,
                    attempt + 1,
                    status_code,
                    exc,
                )
                if (is_retryable or isinstance(exc, ValueError)) and attempt == 0:
                    time.sleep(1.0)
                    continue
                break

    if last_error:
        raise last_error
    raise RuntimeError("AI insights call failed without a concrete error")


def _call_action_ai(context: dict) -> dict:
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not configured")

    endpoint = f"{AI_BASE_URL.rstrip('/')}/chat/completions"
    system_prompt = (
        "You are an AI action planner inside a password security dashboard. "
        "Use only the supplied candidate actions. Do not invent new IDs, accounts, or security findings. "
        "Respond in Turkish and return only valid JSON with this exact shape: "
        "{\"actions\": [{\"id\": string, \"priority\": string, \"title\": string, "
        "\"description\": string, \"action_label\": string, \"ai_reason\": string}]}. "
        "The id must be copied exactly from the candidate list. "
        "Priority must be one of critical, high, medium, low. "
        "Choose at most 6 actions, sorted from most urgent to least urgent. "
        "Descriptions must be concise and practical. "
        "Rewrite every title, description, and action_label in fresh wording; do not copy candidate text verbatim. "
        "The ai_reason field must explain why this action matters now in one sentence. "
        "Use an action-oriented, advisory tone suitable for a project demo. "
        "Do not use markdown fences."
    )
    user_prompt = json.dumps(context, ensure_ascii=False)
    allowed_ids = {item["id"] for item in context.get("candidates", [])}

    last_error: Exception | None = None
    for model in _candidate_models():
        for attempt in range(2):
            response = None
            try:
                response = requests.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {AI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "temperature": 0.2,
                        "max_tokens": 500,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                    timeout=AI_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                parsed = _extract_json(content)
                actions = parsed.get("actions") or []
                cleaned_actions = []
                seen_ids: set[str] = set()
                for item in actions[:6]:
                    action_id = str(item.get("id", "")).strip()
                    if not action_id or action_id not in allowed_ids or action_id in seen_ids:
                        continue
                    priority = str(item.get("priority", "")).strip().lower()
                    if priority not in {"critical", "high", "medium", "low"}:
                        priority = "medium"
                    title = str(item.get("title", "")).strip()
                    description = str(item.get("description", "")).strip()
                    action_label = str(item.get("action_label", "")).strip()
                    ai_reason = str(item.get("ai_reason", "")).strip()
                    if title and description and action_label and ai_reason:
                        cleaned_actions.append({
                            "id": action_id,
                            "priority": priority,
                            "title": title,
                            "description": description,
                            "action_label": action_label,
                            "ai_reason": ai_reason,
                        })
                        seen_ids.add(action_id)

                if not cleaned_actions:
                    raise ValueError("AI action response did not include usable actions")

                return {"model": model, "actions": cleaned_actions}
            except Exception as exc:
                last_error = exc
                status_code = getattr(response, "status_code", None)
                is_retryable = status_code in {429, 500, 502, 503, 504}
                logger.warning(
                    "AI action planner failed for model=%s attempt=%s status=%s error=%s",
                    model,
                    attempt + 1,
                    status_code,
                    exc,
                )
                if (is_retryable or isinstance(exc, ValueError)) and attempt == 0:
                    time.sleep(1.0)
                    continue
                break

    if last_error:
        raise last_error
    raise RuntimeError("AI action planner failed without a concrete error")


def generate_action_plan(action_data: dict) -> list[dict]:
    raw_actions = action_data.get("actions", [])
    if not raw_actions:
        return []

    context = _build_action_plan_context(action_data)
    raw_by_id = {item["id"]: item for item in raw_actions}

    try:
        result = _call_action_ai(context)
        ai_actions = []
        for item in result["actions"]:
            raw = raw_by_id[item["id"]]
            ai_actions.append({
                **raw,
                "priority": item["priority"],
                "title": item["title"],
                "description": item["description"],
                "action_label": item["action_label"],
                "ai_reason": item["ai_reason"],
            })
        return ai_actions
    except Exception as exc:
        logger.warning("AI action planner fell back to raw actions: %s", exc)
        return raw_actions


def generate_insights(db: Session, user_id: int, key: bytes) -> dict:
    from services import action_service

    score_data = scoring_service.calculate_score(db, user_id, key)
    action_data = action_service.get_action_center_raw(db, user_id, key)
    credentials = password_service.get_credentials(db, user_id, key)
    trend_data = scoring_service.get_health_trend(db, user_id)
    score_history = scoring_service.get_history(db, user_id)
    deterministic_insights = _fallback_insights(score_data, action_data, credentials, trend_data)
    context = _build_context(score_data, action_data)
    context["trend"] = trend_data.get("summary", {})
    context["recent_scores"] = [getattr(item, "score", 0) for item in score_history[-5:]]
    context["priority_candidates"] = deterministic_insights["briefing"]["priorities"]
    context["focus_accounts"] = [
        {
            "credential_id": item["credential_id"],
            "site_name": item["site_name"],
            "status_label": item["status_label"],
        }
        for item in deterministic_insights["account_reviews"]
    ]

    try:
        briefing = _call_ai(context)
        if not briefing["summary"]:
            raise ValueError("AI insights response was missing briefing summary")

        return {
            **deterministic_insights,
            "source": "ai",
            "model": briefing["model"],
            "generated_at": briefing["generated_at"],
            "briefing": {
                **briefing,
                "priorities": deterministic_insights["briefing"]["priorities"],
            },
        }
    except Exception as exc:
        logger.warning("AI insights fell back to local summary: %s", exc)
        return deterministic_insights


def generate_advisor(db: Session, user_id: int, key: bytes) -> dict:
    return generate_insights(db, user_id, key)["briefing"]
