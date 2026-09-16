"""Pluggable OTP / account-message delivery.

The channel is picked by settings.OTP_CHANNEL:

- "whatsapp" (default): settings.OTP_SENDER / settings.ACCOUNT_MESSAGE_SENDER.
  Dev uses the console senders (log the code); production should point them at
  a real WhatsApp Cloud API sender.
- "email": codes and account messages go to the user's email via Django's mail
  backend (SMTP/Gmail in production, console backend in dev).

Senders are addressed by phone (the account identifier); email senders resolve
the recipient address from the account.
"""
import logging
from typing import Protocol

from django.conf import settings
from django.core.mail import send_mail
from django.utils.html import escape
from django.utils.module_loading import import_string

logger = logging.getLogger("wisal.otp")
notify_logger = logging.getLogger("wisal.notify")

CHANNEL_WHATSAPP = "whatsapp"
CHANNEL_EMAIL = "email"


def otp_channel() -> str:
    return settings.OTP_CHANNEL


def uses_email() -> bool:
    return otp_channel() == CHANNEL_EMAIL


def _email_for_phone(phone: str) -> str:
    from .models import User

    email = User.objects.filter(phone=phone).values_list("email", flat=True).first()
    if not email:
        raise ValueError(f"No email address on file for {phone}.")
    return email


class OTPSender(Protocol):
    def send(self, phone: str, code: str, purpose: str) -> None: ...


class ConsoleOTPSender:
    """Development sender — writes the OTP to the server log."""

    def send(self, phone: str, code: str, purpose: str) -> None:
        logger.warning("[OTP:%s] %s -> %s", purpose, phone, code)


class WhatsAppCloudSender:
    """Meta WhatsApp Cloud API sender (not yet implemented).

    TODO: POST to https://graph.facebook.com/<v>/<PHONE_NUMBER_ID>/messages with a
    pre-approved *authentication* template carrying the one-time code, using
    WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_OTP_TEMPLATE from settings.
    """

    def send(self, phone: str, code: str, purpose: str) -> None:
        raise NotImplementedError(
            "WhatsAppCloudSender is not implemented yet. Configure Meta WhatsApp "
            "Cloud API credentials and an approved authentication template first."
        )


_OTP_COPY = {
    "en": {
        "VERIFY": ("Your Wisal verification code", "Use this code to verify your Wisal account:"),
        "RESET": ("Your Wisal password reset code", "Use this code to reset your Wisal password:"),
        "expires": "The code expires in {minutes} minutes.",
        "ignore": "If you didn't request this, you can safely ignore this email.",
    },
    "ar": {
        "VERIFY": ("رمز التحقق من وصال", "استخدم هذا الرمز لتأكيد حسابك على وصال:"),
        "RESET": ("رمز إعادة تعيين كلمة المرور في وصال", "استخدم هذا الرمز لإعادة تعيين كلمة مرورك على وصال:"),
        "expires": "تنتهي صلاحية الرمز خلال {minutes} دقائق.",
        "ignore": "إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة.",
    },
}


class EmailOTPSender:
    """Sends the OTP to the account's email address (localized to the user's locale)."""

    def send(self, phone: str, code: str, purpose: str) -> None:
        from .models import User

        user = User.objects.filter(phone=phone).only("email", "locale").first()
        if user is None or not user.email:
            raise ValueError(f"No email address on file for {phone}.")

        locale = user.locale if user.locale in _OTP_COPY else "ar"
        copy = _OTP_COPY[locale]
        subject, intro = copy.get(purpose, copy["VERIFY"])
        minutes = max(1, settings.OTP_TTL_SECONDS // 60)
        expires = copy["expires"].format(minutes=minutes)

        text = f"{intro}\n\n{code}\n\n{expires}\n{copy['ignore']}\n"
        direction = "rtl" if locale == "ar" else "ltr"
        html = (
            f'<div dir="{direction}" style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937">'
            f"<p>{escape(intro)}</p>"
            f'<p dir="ltr" style="font-size:30px;font-weight:bold;letter-spacing:6px;'
            f'color:#0c7c6e;margin:20px 0">{code}</p>'
            f"<p>{escape(expires)}</p>"
            f'<p style="color:#6b7280;font-size:13px">{escape(copy["ignore"])}</p>'
            "</div>"
        )
        send_mail(
            subject,
            text,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=html,
        )


def get_otp_sender() -> OTPSender:
    if uses_email():
        return EmailOTPSender()
    return import_string(settings.OTP_SENDER)()


class AccountMessageSender(Protocol):
    def send_message(self, phone: str, message: str) -> None: ...


class ConsoleAccountSender:
    """Development sender — writes account messages (e.g. temp passwords) to the log."""

    def send_message(self, phone: str, message: str) -> None:
        notify_logger.warning("[MSG] %s -> %s", phone, message)


class EmailAccountSender:
    """Emails account messages (e.g. an approved teacher's temp password)."""

    def send_message(self, phone: str, message: str) -> None:
        send_mail(
            "Your Wisal account",
            message,
            settings.DEFAULT_FROM_EMAIL,
            [_email_for_phone(phone)],
        )


def get_account_sender() -> AccountMessageSender:
    if uses_email():
        return EmailAccountSender()
    return import_string(settings.ACCOUNT_MESSAGE_SENDER)()
