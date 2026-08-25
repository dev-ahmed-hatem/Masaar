"""Google Calendar API operations, all best-effort (never raise into callers).

Handles token refresh (persisting the new access token), event create/patch/
delete, and Meet-link generation. google-* imports are lazy.
"""
import logging
from datetime import timedelta
from datetime import timezone as dt_timezone

from django.conf import settings
from django.utils import timezone

from .models import BookingCalendarEvent, GoogleCredential

logger = logging.getLogger("masaar.gcal")

TOKEN_URI = "https://oauth2.googleapis.com/token"


def _connected_credential(user):
    """Return the user's GoogleCredential if it exists and sync is enabled."""
    cred = GoogleCredential.objects.filter(user=user, sync_enabled=True).first()
    return cred


def is_connected(user) -> bool:
    return _connected_credential(user) is not None


def _aware(dt):
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return dt.replace(tzinfo=dt_timezone.utc)
    return dt


def _service(cred):
    """Build a Calendar API client, refreshing + persisting the token if stale."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=cred.access_token or None,
        refresh_token=cred.refresh_token or None,
        token_uri=TOKEN_URI,
        client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
        client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
        scopes=settings.GOOGLE_OAUTH_SCOPES,
    )
    expired = cred.token_expiry is not None and cred.token_expiry <= timezone.now()
    if creds.refresh_token and (not creds.token or expired):
        creds.refresh(Request())
        cred.access_token = creds.token
        cred.token_expiry = _aware(creds.expiry)
        cred.save(update_fields=["access_token_enc", "token_expiry", "updated_at"])
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _mark_reconnect(cred, exc):
    cred.sync_enabled = False
    cred.last_error = f"{type(exc).__name__}: {exc}"[:2000]
    cred.save(update_fields=["sync_enabled", "last_error", "updated_at"])
    logger.warning("Google credential for user=%s needs reconnect: %s", cred.user_id, exc)


def _event_body(booking, user, meet_link=""):
    tz = user.timezone or booking.teacher.market.timezone or "UTC"
    start = booking.scheduled_start
    end = start + timedelta(minutes=booking.duration_min)
    teacher_name = booking.teacher.user.full_name or "Teacher"
    student_name = booking.student.full_name or "Student"
    subject = getattr(getattr(booking.lesson_category, "subject", None), "name_en", "") or "Lesson"

    if user.id == booking.student_id:
        summary = f"{subject} lesson with {teacher_name}"
        counterpart = f"Teacher: {teacher_name}"
    else:
        summary = f"{subject} lesson with {student_name}"
        counterpart = f"Student: {student_name}"

    link = meet_link or booking.meeting_link
    desc = ["Masaar lesson", counterpart, f"Duration: {booking.duration_min} min"]
    if link:
        desc.append(f"Join: {link}")

    body = {
        "summary": summary,
        "description": "\n".join(desc),
        "start": {"dateTime": start.isoformat(), "timeZone": tz},
        "end": {"dateTime": end.isoformat(), "timeZone": tz},
    }
    if link:
        body["location"] = link
    return body


def upsert_event(booking, user, *, with_conference=False, meet_link=""):
    """Create (or patch, if we already have one) the calendar event for ``user``.

    With ``with_conference`` a Google Meet link is minted. Returns the
    BookingCalendarEvent on success, or None on any failure (logged, recorded).
    """
    cred = _connected_credential(user)
    if cred is None:
        return None

    mapping, _ = BookingCalendarEvent.objects.get_or_create(
        booking=booking, user=user, defaults={"calendar_id": cred.calendar_id}
    )
    try:
        service = _service(cred)
        body = _event_body(booking, user, meet_link=meet_link)
        params = {}
        if with_conference:
            body["conferenceData"] = {
                "createRequest": {
                    "requestId": f"masaar-booking-{booking.id}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }
            params["conferenceDataVersion"] = 1

        if mapping.google_event_id:
            event = (
                service.events()
                .patch(
                    calendarId=mapping.calendar_id,
                    eventId=mapping.google_event_id,
                    body=body,
                    **params,
                )
                .execute()
            )
        else:
            event = (
                service.events()
                .insert(calendarId=cred.calendar_id, body=body, **params)
                .execute()
            )

        mapping.google_event_id = event["id"]
        mapping.calendar_id = cred.calendar_id
        mapping.html_link = event.get("htmlLink", "")
        mapping.meet_link = event.get("hangoutLink", "") or meet_link
        mapping.synced_at = timezone.now()
        mapping.last_error = ""
        mapping.save()
        return mapping
    except Exception as exc:  # noqa: BLE001 — best-effort by design
        from google.auth.exceptions import RefreshError

        if isinstance(exc, RefreshError):
            _mark_reconnect(cred, exc)
        else:
            logger.exception("gcal upsert failed booking=%s user=%s", booking.id, user.id)
            mapping.last_error = f"{type(exc).__name__}: {exc}"[:2000]
            mapping.save(update_fields=["last_error", "updated_at"])
        return None


def delete_event(booking, user):
    """Delete the mapped event (and the mapping row). Best-effort."""
    mapping = BookingCalendarEvent.objects.filter(booking=booking, user=user).first()
    if mapping is None:
        return
    cred = _connected_credential(user)
    if cred is not None and mapping.google_event_id:
        try:
            service = _service(cred)
            service.events().delete(
                calendarId=mapping.calendar_id, eventId=mapping.google_event_id
            ).execute()
        except Exception:  # noqa: BLE001 — event may already be gone
            logger.warning(
                "gcal delete failed booking=%s user=%s (ignored)",
                booking.id,
                user.id,
                exc_info=True,
            )
    mapping.delete()
