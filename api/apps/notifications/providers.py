"""Pluggable notification channel providers.

Dev routes every channel to a console logger; production points the
NOTIFICATION_PROVIDERS settings at real WhatsApp Cloud / FCM / SMTP providers.
"""
import logging
from typing import Protocol

from django.conf import settings
from django.core.mail import send_mail
from django.utils.module_loading import import_string

from .events import render

logger = logging.getLogger("masaar.notify")


class NotificationProvider(Protocol):
    def send(self, notification) -> None: ...


class ConsoleProvider:
    """Development provider — logs the rendered notification."""

    def send(self, notification) -> None:
        title, body = render(notification.event_type, notification.payload)
        logger.warning(
            "[NOTIFY:%s:%s] %s | %s — %s",
            notification.channel, notification.event_type, notification.user, title, body,
        )


class EmailProvider:
    """Sends via Django email (dev uses the console email backend)."""

    def send(self, notification) -> None:
        email = getattr(notification.user, "email", "")
        if not email:
            raise ValueError("User has no email address.")
        title, body = render(notification.event_type, notification.payload)
        send_mail(title, body, settings.DEFAULT_FROM_EMAIL, [email])


class WhatsAppProvider:
    """Meta WhatsApp Cloud API provider (Track D — not yet implemented)."""

    def send(self, notification) -> None:
        raise NotImplementedError(
            "WhatsAppProvider is not implemented. Configure Meta WhatsApp Cloud API credentials."
        )


class PushProvider:
    """FCM/APNs push provider (Track D — not yet implemented)."""

    def send(self, notification) -> None:
        raise NotImplementedError("PushProvider is not implemented. Configure FCM/APNs credentials.")


def get_provider(channel) -> NotificationProvider:
    return import_string(settings.NOTIFICATION_PROVIDERS[channel])()
