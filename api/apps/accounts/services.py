"""OTP issuance and verification.

Codes are stored hashed and never returned by the API. In dev the configured
sender logs the plaintext code so the full flow can be tested.
"""
import logging
import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone

from . import errors
from .models import PhoneOTP, User
from .senders import get_otp_sender, uses_email

logger = logging.getLogger("wisal.otp")


def _generate_code() -> str:
    length = settings.OTP_LENGTH
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def can_receive_otp(phone: str) -> bool:
    """Whether the active channel can reach this account (email mode needs an email)."""
    if not uses_email():
        return True
    return User.objects.filter(phone=phone).exclude(email="").exists()


def request_otp(phone: str, purpose: str) -> PhoneOTP | None:
    """Issue a new OTP for (phone, purpose), enforcing a resend cooldown.

    Returns None (silently, so callers keep their generic responses) when the
    active channel can't reach the account, e.g. email mode and no email on file.
    """
    if not can_receive_otp(phone):
        logger.warning("[OTP:%s] %s has no reachable destination; not sent", purpose, phone)
        return None

    now = timezone.now()
    cooldown = settings.OTP_RESEND_COOLDOWN_SECONDS

    latest = (
        PhoneOTP.objects.filter(phone=phone, purpose=purpose, consumed_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if latest and (now - latest.created_at).total_seconds() < cooldown:
        remaining = int(cooldown - (now - latest.created_at).total_seconds())
        raise errors.OTPCooldown(f"Please wait {remaining}s before requesting another code.")

    code = _generate_code()
    try:
        # Roll the new code back if delivery fails, so the cooldown doesn't
        # block an immediate retry and the previous code stays usable.
        with transaction.atomic():
            # Invalidate any outstanding codes for this (phone, purpose).
            PhoneOTP.objects.filter(
                phone=phone, purpose=purpose, consumed_at__isnull=True
            ).update(consumed_at=now)
            otp = PhoneOTP.objects.create(
                phone=phone,
                purpose=purpose,
                code_hash=make_password(code),
                expires_at=now + timezone.timedelta(seconds=settings.OTP_TTL_SECONDS),
            )
            get_otp_sender().send(phone, code, purpose)
    except Exception:
        logger.exception("[OTP:%s] delivery to %s failed", purpose, phone)
        raise errors.OTPDeliveryFailed()
    return otp


def verify_otp(phone: str, purpose: str, code: str) -> bool:
    """Verify a code. Raises a typed error on failure; returns True on success."""
    now = timezone.now()
    otp = (
        PhoneOTP.objects.filter(phone=phone, purpose=purpose, consumed_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if otp is None:
        raise errors.OTPInvalid()
    if otp.expires_at <= now:
        raise errors.OTPExpired()
    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        # Locked: stays unconsumed so repeated tries keep reporting the lockout
        # until it expires or a fresh code is requested (which invalidates it).
        raise errors.OTPAttemptsExceeded()

    if check_password(code, otp.code_hash):
        otp.consumed_at = now
        otp.save(update_fields=["consumed_at"])
        return True

    otp.attempts += 1
    otp.save(update_fields=["attempts"])
    raise errors.OTPInvalid()
