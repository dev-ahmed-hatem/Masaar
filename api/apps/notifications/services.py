"""Notification dispatch.

`notify()` records a Notification per channel and delivers it via the configured
provider. Delivery failures are captured on the row (status FAILED) and never
propagate — a booking/payment must not fail because a message couldn't be sent.
Production should move dispatch to a queue / transaction.on_commit.
"""
import logging

from django.utils import timezone

from . import events
from .models import Notification
from .providers import get_provider

logger = logging.getLogger("masaar.notify")


def notify(user, event_type, payload=None, channels=None) -> list[Notification]:
    payload = payload or {}
    channels = channels or events.channels_for(event_type)
    created = []
    for channel in channels:
        notification = Notification.objects.create(
            user=user, channel=channel, event_type=event_type, payload=payload
        )
        try:
            get_provider(channel).send(notification)
            notification.status = Notification.Status.SENT
            notification.sent_at = timezone.now()
        except Exception:
            notification.status = Notification.Status.FAILED
            logger.exception("Notification %s (%s) failed to send", notification.id, event_type)
        notification.save(update_fields=["status", "sent_at", "updated_at"])
        created.append(notification)
    return created
