"""Event catalogue: which channels each notification uses and how it renders."""
from .models import Notification

Channel = Notification.Channel


class _SafeDict(dict):
    def __missing__(self, key):
        return ""


EVENTS = {
    "booking_requested": {
        "channels": [Channel.WHATSAPP],
        "title": "New lesson request",
        "body": "New lesson request from {student}.",
    },
    "booking_confirmed": {
        "channels": [Channel.WHATSAPP],
        "title": "Lesson confirmed",
        "body": "Your lesson with {teacher} is confirmed. Join: {meeting_link}",
    },
    "booking_declined": {
        "channels": [Channel.WHATSAPP],
        "title": "Lesson declined",
        "body": "Your lesson request with {teacher} was declined.",
    },
    "booking_cancelled": {
        "channels": [Channel.WHATSAPP],
        "title": "Lesson cancelled",
        "body": "A lesson has been cancelled.",
    },
    "lesson_completed": {
        "channels": [Channel.WHATSAPP],
        "title": "Lesson completed",
        "body": "Your lesson with {teacher} is complete — leave a review!",
    },
    "receipt_approved": {
        "channels": [Channel.WHATSAPP],
        "title": "Payment approved",
        "body": "Your payment of {amount} was approved and added to your wallet.",
    },
    "receipt_rejected": {
        "channels": [Channel.WHATSAPP],
        "title": "Payment rejected",
        "body": "Your payment was rejected: {reason}",
    },
    "price_request_approved": {
        "channels": [Channel.WHATSAPP],
        "title": "Custom price approved",
        "body": "Your custom price of {amount} was approved and is now live.",
    },
    "price_request_rejected": {
        "channels": [Channel.WHATSAPP],
        "title": "Custom price rejected",
        "body": "Your custom price request was rejected: {reason}",
    },
    "chat_message": {
        "channels": [Channel.PUSH],
        "title": "New message",
        "body": "New message from {sender}: {preview}",
    },
    "payout_paid": {
        "channels": [Channel.WHATSAPP],
        "title": "Payout sent",
        "body": "Your payout of {amount} has been sent. Reference: {reference}",
    },
}

DEFAULT_CHANNELS = [Channel.WHATSAPP]


def channels_for(event_type) -> list[str]:
    return EVENTS.get(event_type, {}).get("channels", DEFAULT_CHANNELS)


def render(event_type, payload) -> tuple[str, str]:
    spec = EVENTS.get(event_type, {})
    title = spec.get("title", event_type.replace("_", " ").title())
    body = spec.get("body", "").format_map(_SafeDict(payload or {}))
    return title, body
