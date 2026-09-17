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
from django.template.loader import render_to_string
from django.utils import timezone
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


_BRAND = {"en": "Wisal", "ar": "وصال"}

_OTP_COPY = {
    "en": {
        "VERIFY": {
            "subject": "Your Wisal verification code",
            "heading": "Verify your account",
            "intro": "Enter this code in Wisal to confirm your account:",
        },
        "RESET": {
            "subject": "Your Wisal password reset code",
            "heading": "Reset your password",
            "intro": "Enter this code in Wisal to choose a new password:",
        },
        "greeting": "Hi {name},",
        "greeting_anon": "Hi,",
        "preheader": "{code} is your Wisal code. It expires in {minutes} minutes.",
        "expires": "This code expires in {minutes} minutes and can only be used once.",
        "never_share_title": "Keep it private.",
        "never_share": "Wisal will never ask you for this code by phone, chat, or email.",
        "ignore": "Didn't request this? You can safely ignore this email — your account stays secure.",
        "footer": "You're receiving this because a code was requested for your Wisal account.",
    },
    "ar": {
        "VERIFY": {
            "subject": "رمز التحقق من حسابك على وصال",
            "heading": "تأكيد حسابك",
            "intro": "أدخل هذا الرمز في وصال لتأكيد حسابك:",
        },
        "RESET": {
            "subject": "رمز إعادة تعيين كلمة المرور على وصال",
            "heading": "إعادة تعيين كلمة المرور",
            "intro": "أدخل هذا الرمز في وصال لاختيار كلمة مرور جديدة:",
        },
        "greeting": "مرحبًا {name}،",
        "greeting_anon": "مرحبًا،",
        "preheader": "رمزك على وصال هو {code}، وتنتهي صلاحيته خلال {minutes} دقائق.",
        "expires": "تنتهي صلاحية هذا الرمز خلال {minutes} دقائق، ويُستخدم مرة واحدة فقط.",
        "never_share_title": "لا تشاركه مع أحد.",
        "never_share": "لن يطلب منك فريق وصال هذا الرمز أبدًا عبر الهاتف أو المحادثة أو البريد.",
        "ignore": "لم تطلب هذا الرمز؟ يمكنك تجاهل هذه الرسالة بأمان، فحسابك ما زال محميًا.",
        "footer": "وصلتك هذه الرسالة لأنه تم طلب رمز لحسابك على وصال.",
    },
}

_FONTS = {
    "en": "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    "ar": "Tahoma,'Segoe UI',Arial,sans-serif",
}


class EmailOTPSender:
    """Sends the OTP to the account's email address (localized to the user's locale)."""

    def send(self, phone: str, code: str, purpose: str) -> None:
        from .models import User

        user = User.objects.filter(phone=phone).only("email", "locale", "full_name").first()
        if user is None or not user.email:
            raise ValueError(f"No email address on file for {phone}.")

        locale = user.locale if user.locale in _OTP_COPY else "ar"
        copy = _OTP_COPY[locale]
        variant = copy.get(purpose, copy["VERIFY"])
        minutes = max(1, settings.OTP_TTL_SECONDS // 60)
        first_name = (user.full_name or "").split(" ")[0]
        rtl = locale == "ar"

        context = {
            "lang": locale,
            "dir": "rtl" if rtl else "ltr",
            "align": "right" if rtl else "left",
            "font": _FONTS[locale],
            "brand": _BRAND[locale],
            "code": code,
            "subject": variant["subject"],
            "heading": variant["heading"],
            "intro": variant["intro"],
            "greeting": copy["greeting"].format(name=first_name) if first_name else copy["greeting_anon"],
            "preheader": copy["preheader"].format(code=code, minutes=minutes),
            "expires": copy["expires"].format(minutes=minutes),
            "never_share_title": copy["never_share_title"],
            "never_share": copy["never_share"],
            "ignore": copy["ignore"],
            "footer": copy["footer"],
            "year": timezone.now().year,
        }
        send_mail(
            variant["subject"],
            render_to_string("accounts/email/otp.txt", context),
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=render_to_string("accounts/email/otp.html", context),
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
