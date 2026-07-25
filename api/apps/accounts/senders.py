"""Pluggable OTP delivery.

Dev uses ConsoleOTPSender (logs the code). Production should point
settings.OTP_SENDER at a real WhatsApp Cloud API sender.
"""
import logging
from typing import Protocol

from django.conf import settings
from django.utils.module_loading import import_string

logger = logging.getLogger("masaar.otp")


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


def get_otp_sender() -> OTPSender:
    return import_string(settings.OTP_SENDER)()
