import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


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

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=20,
        spaceAfter=6,
        textColor=colors.HexColor("#1565c0"),
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#666666"),
        spaceAfter=20,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=16,
        spaceAfter=8,
        textColor=colors.HexColor("#0d47a1"),
    )

    story = []

    # Header
    story.append(Paragraph("🔐 Password Security System", title_style))
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
        ["Toplam kayıt", str(bd.get("total_credentials", 0))],
        ["Zayıf şifre", str(bd.get("weak_count", 0))],
        ["Tekrar kullanılan", str(bd.get("reused_count", 0))],
        ["Şifre ihlali", str(bd.get("breached_count", 0))],
        ["E-posta ihlali", str(bd.get("email_breached_count", 0))],
        ["Eski (>90 gün)", str(bd.get("stale_count", 0))],
        ["İhlal sonrası güncellenmedi", str(bd.get("not_rotated_count", 0))],
    ]
    score_table = Table(score_table_data, colWidths=[9 * cm, 7 * cm])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), score_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 14),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f5f5f5")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4ff")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(score_table)

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
        cred_data = [["Site", "Kategori", "Güç", "İhlal", "Eski"]]
        for c in critical:
            cred_data.append([
                c.get("site_name", ""),
                c.get("category", ""),
                c.get("strength_label", ""),
                "✓" if c.get("is_breached") or c.get("email_breached") else "—",
                "✓" if c.get("is_stale") else "—",
            ])
        cred_table = Table(
            cred_data,
            colWidths=[5 * cm, 3 * cm, 3 * cm, 2.5 * cm, 2.5 * cm],
        )
        cred_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1565c0")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff3e0")]),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(cred_table)

    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(
        "Bu rapor Password Security System tarafından otomatik oluşturulmuştur.",
        styles["Italic"],
    ))

    doc.build(story)
    return buf.getvalue()
