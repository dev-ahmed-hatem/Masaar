"""OTP issuance and verification.

Codes are stored hashed and never returned by the API. In dev the configured
sender logs the plaintext code so the full flow can be tested.
"""
import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from . import errors
from .models import PhoneOTP
from .senders import get_otp_sender


def _generate_code() -> str:
    length = settings.OTP_LENGTH
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def request_otp(phone: str, purpose: str) -> PhoneOTP:
    """Issue a new OTP for (phone, purpose), enforcing a resend cooldown."""
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

    # Invalidate any outstanding codes for this (phone, purpose).
    PhoneOTP.objects.filter(
        phone=phone, purpose=purpose, consumed_at__isnull=True
    ).update(consumed_at=now)

    code = _generate_code()
    otp = PhoneOTP.objects.create(
        phone=phone,
        purpose=purpose,
        code_hash=make_password(code),
        expires_at=now + timezone.timedelta(seconds=settings.OTP_TTL_SECONDS),
    )
    get_otp_sender().send(phone, code, purpose)
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
