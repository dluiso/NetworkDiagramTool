"""
Email utility module.
All email sending is optional — if SMTP is not configured, operations
log a message instead of failing. This allows the system to work without
email in development while supporting proper notifications in production.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _send_email(to_address: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """Internal: send an email via SMTP. Returns True on success."""
    if not settings.smtp_enabled:
        logger.info(f"[Email] SMTP not configured. Would send '{subject}' to {to_address}")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_address

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.smtp_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)

        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, to_address, msg.as_string())
        server.quit()
        logger.info(f"[Email] Sent '{subject}' to {to_address}")
        return True
    except Exception as e:
        logger.error(f"[Email] Failed to send '{subject}' to {to_address}: {e}")
        return False


def send_account_approved_email(to_address: str, username: str) -> bool:
    """Notify a user that their account has been approved by an admin."""
    subject = f"Your {settings.app_name} account has been approved"
    login_url = f"{settings.frontend_url}/login"
    html = f"""
    <html><body style="font-family: sans-serif; color: #1e293b; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Account Approved</h2>
        <p>Hi <strong>{username}</strong>,</p>
        <p>Your <strong>{settings.app_name}</strong> account has been reviewed and approved by an administrator.</p>
        <p>You can now log in using your credentials:</p>
        <p><a href="{login_url}" style="background:#6366f1;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Sign In</a></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="font-size:12px;color:#94a3b8;">This is an automated message from {settings.app_name}.</p>
    </body></html>
    """
    text = f"Hi {username},\n\nYour {settings.app_name} account has been approved.\nLogin at: {login_url}\n"
    return _send_email(to_address, subject, html, text)


def send_registration_pending_email(to_address: str, username: str) -> bool:
    """Notify a user that their registration is pending admin approval."""
    subject = f"Registration received — {settings.app_name}"
    html = f"""
    <html><body style="font-family: sans-serif; color: #1e293b; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Registration Received</h2>
        <p>Hi <strong>{username}</strong>,</p>
        <p>Thank you for registering on <strong>{settings.app_name}</strong>.</p>
        <p>Your account is pending administrator approval. You will receive another email once your account is activated.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="font-size:12px;color:#94a3b8;">This is an automated message from {settings.app_name}.</p>
    </body></html>
    """
    text = f"Hi {username},\n\nYour registration on {settings.app_name} is pending administrator approval.\n"
    return _send_email(to_address, subject, html, text)


def send_account_deactivated_email(to_address: str, username: str) -> bool:
    """Notify a user that their account has been deactivated."""
    subject = f"Account deactivated — {settings.app_name}"
    html = f"""
    <html><body style="font-family: sans-serif; color: #1e293b; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Account Deactivated</h2>
        <p>Hi <strong>{username}</strong>,</p>
        <p>Your <strong>{settings.app_name}</strong> account has been deactivated by an administrator.</p>
        <p>Please contact your system administrator if you believe this is an error.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="font-size:12px;color:#94a3b8;">This is an automated message from {settings.app_name}.</p>
    </body></html>
    """
    text = f"Hi {username},\n\nYour {settings.app_name} account has been deactivated.\n"
    return _send_email(to_address, subject, html, text)
