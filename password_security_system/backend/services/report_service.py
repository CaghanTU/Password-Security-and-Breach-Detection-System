import io
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def _pick_unicode_font() -> tuple[str, str, str]:
    base_dir = Path(__file__).resolve().parent.parent
    fonts_dir = base_dir / "assets" / "fonts"

    regular_candidates = [
        str(fonts_dir / "DejaVuSans.ttf"),
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    bold_candidates = [
        str(fonts_dir / "DejaVuSans-Bold.ttf"),
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]
    italic_candidates = [
        str(fonts_dir / "DejaVuSans-Oblique.ttf"),
        "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
        "/Library/Fonts/Arial Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
        "C:/Windows/Fonts/ariali.ttf",
    ]

    regular = next((path for path in regular_candidates if os.path.exists(path)), None)
    bold = next((path for path in bold_candidates if os.path.exists(path)), None)
    italic = next((path for path in italic_candidates if os.path.exists(path)), None)

    if regular:
        if "PSS-Regular" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("PSS-Regular", regular))
        if bold and "PSS-Bold" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("PSS-Bold", bold))
        if italic and "PSS-Italic" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("PSS-Italic", italic))
        return (
            "PSS-Regular",
            "PSS-Bold" if bold else "PSS-Regular",
            "PSS-Italic" if italic else "PSS-Regular",
        )

    return "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"


def _pct(value: float) -> str:
    return f"{round((value or 0) * 100)}%"


def _complexity_text(label: str) -> str:
    return {
        "weak": "weak",
        "medium": "medium",
        "strong": "strong",
    }.get(label, label or "-")


def _security_status_text(cred: dict) -> str:
    if cred.get("breach_date_status") == "not_rotated":
        return "not updated after breach"
    if cred.get("is_breached") and cred.get("email_breached"):
        return "password and email breach"
    if cred.get("is_breached"):
        return "password breach"
    if cred.get("email_breached"):
        return "email breach"
    if cred.get("strength_label") == "weak":
        return "weak password"
    if cred.get("is_stale"):
        return "old password"
    return "stable"


def _score_palette(score: int) -> dict:
    if score >= 85:
        return {"bg": "#1d7a53", "fg": colors.white, "label": "Excellent"}
    if score >= 70:
        return {"bg": "#0d6e6e", "fg": colors.white, "label": "Good"}
    if score >= 45:
        return {"bg": "#b56d17", "fg": colors.white, "label": "Watch"}
    return {"bg": "#b54034", "fg": colors.white, "label": "Critical"}


def _join_parts(parts: list[str]) -> str:
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def _executive_summary(score: int, breakdown: dict) -> str:
    risks: list[str] = []
    if breakdown.get("breach_any_count", 0) > 0:
        risks.append(f"{breakdown['breach_any_count']} breached records")
    if breakdown.get("weak_count", 0) > 0:
        risks.append(f"{breakdown['weak_count']} weak passwords")
    if breakdown.get("reused_count", 0) > 0:
        risks.append(f"{breakdown['reused_count']} reused passwords")
    if breakdown.get("stale_count", 0) > 0:
        risks.append(f"{breakdown['stale_count']} old passwords")

    if not risks:
        return (
            f"The overall outlook is balanced. Score is {score}/100 and no dominant high-risk pressure is visible. "
            "To maintain the current level, regular scanning and disciplined 2FA usage should continue."
        )

    summary = _join_parts(risks)
    return (
        f"Score is {score}/100. The main factors pulling the security posture down are {summary}. "
        f"TOTP coverage is {_pct(breakdown.get('totp_ratio', 0.0))} and the total bonus is +{breakdown.get('bonus_total', 0)}."
    )


def _priority_actions(score_data: dict, breakdown: dict) -> list[list[str]]:
    suggestions = score_data.get("suggested_actions") or []
    if suggestions:
        rows = [["Order", "Action", "Estimated impact"]]
        for index, item in enumerate(suggestions[:5], start=1):
            gain = item.get("estimated_score_gain", 0)
            rows.append([
                str(index),
                f"{item.get('label', '-')}\n{item.get('reason', '')}",
                f"+{gain}" if gain > 0 else "-",
            ])
        return rows

    fallback = []
    if breakdown.get("breach_any_count", 0) > 0:
        fallback.append(["1", "Change passwords for breached records immediately.", "+4"])
    if breakdown.get("reused_count", 0) > 0:
        fallback.append(["2", "Separate reused passwords.", "+2"])
    if breakdown.get("weak_count", 0) > 0:
        fallback.append(["3", "Make weak passwords longer and unique.", "+3"])
    if breakdown.get("totp_enabled_count", 0) == 0 and breakdown.get("total_credentials", 0) > 0:
        fallback.append(["4", "Enable TOTP on critical accounts.", "+8"])
    if not fallback:
        fallback.append(["1", "Maintain the current security level.", "-"])
    return [["Order", "Action", "Estimated impact"], *fallback[:5]]


def _risk_driver_rows(score_data: dict) -> list[list[str]]:
    explanations = score_data.get("explanations") or []
    rows = [["Risk driver", "Severity", "Records", "Impact", "Recommendation"]]
    for item in explanations[:5]:
        rows.append([
            item.get("title", "-"),
            item.get("severity", "-"),
            str(item.get("count", 0)),
            f"{item.get('impact_points', 0)} points",
            item.get("recommendation", "-"),
        ])
    return rows


def _critical_credentials(credentials: list[dict]) -> list[dict]:
    def priority(cred: dict) -> tuple[int, int]:
        score = 0
        if cred.get("is_breached") or cred.get("email_breached"):
            score += 3
        if cred.get("strength_label") == "weak":
            score += 2
        if cred.get("is_stale"):
            score += 1
        return (-score, cred.get("id", 0))

    critical = [
        cred for cred in credentials
        if cred.get("strength_label") == "weak"
        or cred.get("is_breached")
        or cred.get("email_breached")
        or cred.get("is_stale")
    ]
    return sorted(critical, key=priority)[:8]


def _credential_action_text(cred: dict) -> str:
    if cred.get("breach_date_status") == "not_rotated":
        return "Rotate after breach"
    if cred.get("is_breached") or cred.get("email_breached"):
        return "Change because of breach"
    if cred.get("strength_label") == "weak":
        return "Assign a stronger password"
    if cred.get("is_stale"):
        return "Rotate it"
    return "Continue monitoring"


def generate_pdf(username: str, score_data: dict, credentials: list[dict], ai_insights: Optional[dict] = None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.7 * cm,
        rightMargin=1.7 * cm,
        topMargin=1.7 * cm,
        bottomMargin=1.5 * cm,
    )

    font_regular, font_bold, font_italic = _pick_unicode_font()
    styles = getSampleStyleSheet()
    palette = _score_palette(score_data.get("score", 0))

    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#10222f"),
        spaceAfter=4,
    )
    kicker_style = ParagraphStyle(
        "Kicker",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#0d6e6e"),
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName=font_regular,
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#34424f"),
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#10222f"),
        spaceBefore=14,
        spaceAfter=8,
    )
    score_value_style = ParagraphStyle(
        "ScoreValue",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=30,
        leading=32,
        alignment=1,
        textColor=palette["fg"],
    )
    score_label_style = ParagraphStyle(
        "ScoreLabel",
        parent=styles["Normal"],
        fontName=font_regular,
        fontSize=10,
        leading=13,
        alignment=1,
        textColor=palette["fg"],
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Italic"],
        fontName=font_italic,
        fontSize=8.5,
        textColor=colors.HexColor("#6c7a86"),
    )

    score = score_data.get("score", 0)
    breakdown = score_data.get("breakdown", {})
    story = []

    hero_left = [
        Paragraph("SECURITY REPORT", kicker_style),
        Paragraph("Password Security System", title_style),
        Paragraph(
            f"User: <b>{username}</b><br/>Created: {datetime.utcnow().strftime('%d.%m.%Y %H:%M')} UTC",
            body_style,
        ),
    ]
    hero_right = Table(
        [[
            Paragraph("Current Score", score_label_style),
        ], [
            Paragraph(str(score), score_value_style),
        ], [
            Paragraph(f"{palette['label']} level", score_label_style),
        ]],
        colWidths=[4.2 * cm],
    )
    hero_right.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(palette["bg"])),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(palette["bg"])),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    hero_table = Table([[hero_left, hero_right]], colWidths=[11.2 * cm, 4.5 * cm])
    hero_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f4fbfa")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 12),
        ("RIGHTPADDING", (0, 0), (0, 0), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d7ebe8")),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))
    story.append(hero_table)

    metric_table = Table([
        [
            Paragraph("Total records", body_style),
            Paragraph("Breached records", body_style),
            Paragraph("Weak passwords", body_style),
            Paragraph("TOTP enabled", body_style),
        ],
        [
            Paragraph(f"<b>{breakdown.get('total_credentials', 0)}</b>", body_style),
            Paragraph(f"<b>{breakdown.get('breach_any_count', 0)}</b>", body_style),
            Paragraph(f"<b>{breakdown.get('weak_count', 0)}</b>", body_style),
            Paragraph(f"<b>{breakdown.get('totp_enabled_count', 0)}</b>", body_style),
        ],
    ], colWidths=[3.9 * cm, 3.9 * cm, 3.9 * cm, 3.9 * cm])
    metric_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10222f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f8fbfd")),
        ("FONTNAME", (0, 0), (-1, -1), font_regular),
        ("FONTNAME", (0, 1), (-1, 1), font_bold),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d6dee6")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d6dee6")),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(Spacer(1, 0.35 * cm))
    story.append(metric_table)

    story.append(Paragraph("Executive Summary", section_style))
    story.append(Paragraph(_executive_summary(score, breakdown), body_style))

    if ai_insights:
        briefing = ai_insights.get("briefing", {})
        weekly = ai_insights.get("weekly_summary", {})
        story.append(Paragraph("AI Analysis Section", section_style))
        if briefing.get("headline"):
            story.append(Paragraph(f"<b>{briefing['headline']}</b>", body_style))
        if briefing.get("summary"):
            story.append(Paragraph(briefing["summary"], body_style))
        if briefing.get("why_now"):
            story.append(Spacer(1, 0.15 * cm))
            story.append(Paragraph(f"<b>Why now?</b> {briefing['why_now']}", body_style))
        if weekly.get("headline") or weekly.get("summary"):
            story.append(Spacer(1, 0.2 * cm))
            story.append(Paragraph(f"<b>{weekly.get('headline', 'Weekly outlook')}</b>", body_style))
            if weekly.get("summary"):
                story.append(Paragraph(weekly["summary"], body_style))

        plan_rows = [["Time", "AI recommendation"]]
        for item in ai_insights.get("plan_48h", [])[:3]:
            plan_rows.append([item.get("window", "-"), f"{item.get('title', '-')}\n{item.get('detail', '-')}"])
        if len(plan_rows) > 1:
            story.append(Spacer(1, 0.2 * cm))
            plan_table = Table(plan_rows, colWidths=[2.8 * cm, 12.8 * cm])
            plan_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b5870")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), font_regular),
                ("FONTNAME", (0, 0), (-1, 0), font_bold),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f9fc")]),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d5e0ea")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5e0ea")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(plan_table)

    story.append(Paragraph("Priority Actions", section_style))
    action_table = Table(_priority_actions(score_data, breakdown), colWidths=[1.3 * cm, 11.6 * cm, 2.8 * cm])
    action_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d6e6e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font_regular),
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5faf9")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d7ebe8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d7ebe8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(action_table)

    story.append(Paragraph("Risk Drivers", section_style))
    driver_table = Table(_risk_driver_rows(score_data), colWidths=[4.1 * cm, 2.1 * cm, 1.6 * cm, 2.2 * cm, 5.8 * cm])
    driver_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10222f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font_regular),
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f9fb")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d6dee6")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d6dee6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(driver_table)

    critical = _critical_credentials(credentials)
    if critical:
        story.append(Paragraph("Highlighted Records", section_style))
        critical_rows = [["Record", "Category", "Complexity", "Risk reason", "Recommended action"]]
        for cred in critical:
            critical_rows.append([
                cred.get("site_name", "-"),
                cred.get("category", "-"),
                _complexity_text(cred.get("strength_label", "")),
                _security_status_text(cred),
                _credential_action_text(cred),
            ])
        critical_table = Table(critical_rows, colWidths=[4.5 * cm, 2.9 * cm, 2.6 * cm, 2.8 * cm, 3.0 * cm])
        critical_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b54034")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), font_regular),
            ("FONTNAME", (0, 0), (-1, 0), font_bold),
            ("FONTSIZE", (0, 0), (-1, -1), 8.8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff7f6")]),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#ecd0cc")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ecd0cc")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(critical_table)

    story.append(Paragraph("Model Summary", section_style))
    model_table = Table([
        ["Base score", str(breakdown.get("base_score", score))],
        ["Total bonus", f"+{breakdown.get('bonus_total', 0)}"],
        ["Uniqueness ratio", _pct(breakdown.get("unique_ratio", 0.0))],
        ["TOTP coverage", _pct(breakdown.get("totp_ratio", 0.0))],
        ["Reuse ratio", _pct(breakdown.get("reused_ratio", 0.0))],
        ["Old password ratio", _pct(breakdown.get("stale_ratio", 0.0))],
    ], colWidths=[6.2 * cm, 9.4 * cm])
    model_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_regular),
        ("FONTNAME", (0, 0), (0, -1), font_bold),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f7f9fb")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d6dee6")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d6dee6")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(model_table)

    story.append(Spacer(1, 0.45 * cm))
    story.append(Paragraph(
        "This report was generated automatically by Password Security System. "
        "Prioritization is calculated from current password health and risk model data.",
        footer_style,
    ))

    doc.build(story)
    return buf.getvalue()
