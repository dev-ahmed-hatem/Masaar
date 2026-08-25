"""Thin façade the bookings app calls on lifecycle transitions.

Every entry point is a no-op unless the integration is configured, and delegates
to the best-effort google_calendar service, so a booking transition can never be
broken by calendar sync. Callers schedule these via transaction.on_commit.
"""
import logging

from django.conf import settings

logger = logging.getLogger("masaar.gcal")


def _enabled() -> bool:
    return bool(getattr(settings, "GOOGLE_CALENDAR_ENABLED", False))


def teacher_can_autogenerate_meet(booking) -> bool:
    """True when a confirmed MEET booking's link can be auto-generated (the
    teacher has a connected Google account) — used to relax the manual-link
    requirement at confirm time."""
    if not _enabled():
        return False
    from . import google_calendar

    return google_calendar.is_connected(booking.teacher.user)


def on_booking_confirmed(booking):
    if not _enabled():
        return
    from apps.bookings.models import Booking

    from . import google_calendar

    want_meet = booking.meeting_provider == Booking.Provider.MEET
    teacher_user = booking.teacher.user
    student = booking.student
    meet_link = ""

    # Write the teacher's event first — this is where we mint the Meet link.
    if google_calendar.is_connected(teacher_user):
        m = google_calendar.upsert_event(booking, teacher_user, with_conference=want_meet)
        if m and m.meet_link:
            meet_link = m.meet_link

    # Student's event mirrors the same link; only mint here if the teacher couldn't.
    if google_calendar.is_connected(student):
        mint = want_meet and not meet_link
        m = google_calendar.upsert_event(
            booking, student, with_conference=mint, meet_link=meet_link
        )
        if m and m.meet_link and not meet_link:
            meet_link = m.meet_link

    if want_meet and meet_link and booking.meeting_link != meet_link:
        booking.meeting_link = meet_link
        booking.save(update_fields=["meeting_link", "updated_at"])


def on_booking_rescheduled(booking):
    if not _enabled():
        return
    from . import google_calendar

    # Only participants who already have an event get it moved.
    for mapping in booking.calendar_events.all():
        google_calendar.upsert_event(booking, mapping.user, with_conference=False)


def on_booking_cancelled(booking):
    if not _enabled():
        return
    from . import google_calendar

    for mapping in list(booking.calendar_events.all()):
        google_calendar.delete_event(booking, mapping.user)
