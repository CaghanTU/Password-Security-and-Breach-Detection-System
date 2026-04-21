import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL

logger = logging.getLogger(__name__)


def send_breach_alert(username: str, new_breaches: list[str]) -> None:
    """
    Send an email alert when new breaches are found for a user.
    Silently skips if SMTP is not configured.
    """
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS, ALERT_EMAIL]):
        logger.info("SMTP not configured, skipping email notification")
        return

    breach_list = "\n".join(f"  • {b}" for b in new_breaches)
    body = (
        f"Hello,\n\n"
        f"New breaches were detected during the automated breach scan for the account '{username}':\n\n"
        f"{breach_list}\n\n"
        f"Please change the passwords for the affected accounts.\n\n"
        f"— Password Security System"
    )

    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = ALERT_EMAIL
    msg["Subject"] = f"[Security Alert] New breach found for {username}"
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, ALERT_EMAIL, msg.as_string())
        logger.info("Breach alert email sent for user %s", username)
    except Exception as exc:
        logger.error("Failed to send breach alert email: %s", exc)
