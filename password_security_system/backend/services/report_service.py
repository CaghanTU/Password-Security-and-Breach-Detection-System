import io
import os
from pathlib import Path
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
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

    regular = next((p for p in regular_candidates if os.path.exists(p)), None)
    bold = next((p for p in bold_candidates if os.path.exists(p)), None)
    italic = next((p for p in italic_candidates if os.path.exists(p)), None)

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


def _build_recommendations(bd: dict) -> list[list[str]]:
    items = []
    if bd.get("breach_any_count", 0) > 0:
        items.append(["1", "İhlalli kayıtların parolalarını hemen güncelleyin."])
    if bd.get("reused_count", 0) > 0:
        items.append(["2", "Aynı parolayı birden fazla hesapta kullanmayın."])
    if bd.get("weak_count", 0) > 0:
        items.append(["3", "Zayıf parolaları güçlü ve uzun parolalarla değiştirin."])
    if bd.get("stale_count", 0) > 0:
        items.append(["4", "90 günü geçen parolaları periyodik olarak yenileyin."])
    if bd.get("totp_enabled_count", 0) == 0 and bd.get("total_credentials", 0) > 0:
        items.append(["5", "Kritik hesaplarda TOTP/2FA aktif edin."])
    if not items:
        items.append(["1", "Genel durum iyi, mevcut güvenlik seviyesini koruyun."])
    return items[:5]


def _complexity_text(label: str) -> str:
    return {
        "weak": "zayıf",
        "medium": "orta",
        "strong": "güçlü",
    }.get(label, label or "-")


def _security_status_text(cred: dict) -> str:
    critical = cred.get("is_breached") or cred.get("email_breached") or cred.get("breach_date_status") == "not_rotated"
    warning = cred.get("is_stale")
    if critical:
        return "riskli"
    if warning:
        return "dikkat"
    return "iyi"


def generate_pdf(username: str, score_data: dict, credentials: list) -> bytes:
    """
    Generate a risk report PDF.
    Returns raw PDF bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    font_regular, font_bold, font_italic = _pick_unicode_font()

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=20,
        spaceAfter=6,
        textColor=colors.HexColor("#1565c0"),
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontName=font_regular,
        fontSize=10,
        textColor=colors.HexColor("#666666"),
        spaceAfter=20,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=13,
        spaceBefore=16,
        spaceAfter=8,
        textColor=colors.HexColor("#0d47a1"),
    )

    story = []

    # Header
    story.append(Paragraph("Password Security System", title_style))
    story.append(Paragraph(
        f"Risk Raporu — {username} — {datetime.utcnow().strftime('%d.%m.%Y %H:%M')} UTC",
        subtitle_style,
    ))

    # Score summary
    score = score_data.get("score", 0)
    bd = score_data.get("breakdown", {})
    score_color = colors.HexColor("#2e7d32") if score >= 70 else (
        colors.HexColor("#e65100") if score >= 40 else colors.HexColor("#c62828")
    )

    story.append(Paragraph("Risk Skoru", section_style))
    score_table_data = [
        ["Skor", f"{score} / 100"],
        ["Model", str(bd.get("model_version", "v1"))],
        ["Temel skor", str(bd.get("base_score", score))],
        ["Bonus (TOTP + Benzersizlik)", f"+{bd.get('bonus_total', 0)}"],
        ["Toplam kayıt", str(bd.get("total_credentials", 0))],
        ["Zayıf şifre", str(bd.get("weak_count", 0))],
        ["Orta şifre", str(bd.get("medium_count", 0))],
        ["Tekrar kullanılan", str(bd.get("reused_count", 0))],
        ["Şifre ihlali", str(bd.get("breached_count", 0))],
        ["E-posta ihlali", str(bd.get("email_breached_count", 0))],
        ["Toplam ihlalli kayıt", str(bd.get("breach_any_count", 0))],
        ["Eski (>90 gün)", str(bd.get("stale_count", 0))],
        ["İhlal sonrası güncellenmedi", str(bd.get("not_rotated_count", 0))],
        ["TOTP aktif kayıt", str(bd.get("totp_enabled_count", 0))],
    ]
    score_table = Table(score_table_data, colWidths=[9 * cm, 7 * cm])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), score_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 14),
        ("FONTNAME", (0, 0), (-1, -1), font_regular),
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f5f5f5")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4ff")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(score_table)

    story.append(Paragraph("Oranlar ve Ağırlıklar", section_style))
    ratio_table_data = [
        ["Metrik", "Oran", "Ağırlık"],
        ["Zayıf", _pct(bd.get("weak_ratio", 0.0)), "0.30"],
        ["Orta", _pct(bd.get("medium_ratio", 0.0)), "0.10"],
        ["Tekrar", _pct(bd.get("reused_ratio", 0.0)), "0.20"],
        ["İhlal (toplam)", _pct(bd.get("breach_any_ratio", 0.0)), "0.25"],
        ["Eski", _pct(bd.get("stale_ratio", 0.0)), "0.10"],
        ["Güncellenmedi", _pct(bd.get("not_rotated_ratio", 0.0)), "0.05"],
        ["TOTP bonus oranı", _pct(bd.get("totp_ratio", 0.0)), "+8*oran"],
        ["Benzersizlik oranı", _pct(bd.get("unique_ratio", 0.0)), "+5*oran"],
    ]
    ratio_table = Table(ratio_table_data, colWidths=[8 * cm, 4 * cm, 4 * cm])
    ratio_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d47a1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font_regular),
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef6ff")]),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(ratio_table)

    # Critical credentials
    critical = [
        c for c in credentials
        if c.get("strength_label") == "weak"
        or c.get("is_breached")
        or c.get("email_breached")
        or c.get("is_stale")
    ]

    if critical:
        story.append(Paragraph("Kritik Kayıtlar", section_style))
        cred_data = [["Site", "Kategori", "Parola karmaşıklığı", "Güvenlik durumu", "Parola yaşı"]]
        for c in critical:
            cred_data.append([
                c.get("site_name", ""),
                c.get("category", ""),
                _complexity_text(c.get("strength_label", "")),
                _security_status_text(c),
                "eski" if c.get("is_stale") else "güncel",
            ])
        cred_table = Table(
            cred_data,
            colWidths=[5 * cm, 3 * cm, 3 * cm, 2.5 * cm, 2.5 * cm],
        )
        cred_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1565c0")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), font_regular),
            ("FONTNAME", (0, 0), (-1, 0), font_bold),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff3e0")]),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(cred_table)

    story.append(Paragraph("Önerilen Aksiyonlar", section_style))
    rec_table = Table(_build_recommendations(bd), colWidths=[1.5 * cm, 14.5 * cm])
    rec_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_regular),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8f9fa")]),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(rec_table)

    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(
        "Bu rapor Password Security System tarafından otomatik oluşturulmuştur.",
        ParagraphStyle("Footer", parent=styles["Italic"], fontName=font_italic),
    ))

    doc.build(story)
    return buf.getvalue()
