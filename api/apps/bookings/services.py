"""Booking lifecycle: slot generation and the request→confirm→complete/settle
state machine, with wallet reserve/capture/refund at each transition.

Cancellation policy (configurable, see settings):
- Teacher cancels: always a full refund.
- Student cancels an unconfirmed (REQUESTED) booking: full refund.
- Student cancels a CONFIRMED booking >= BOOKING_CANCEL_CUTOFF_HOURS before the
  start: full refund; later than that: charged (reserve captured, teacher paid).
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.integrations import calendar_sync
from apps.notifications.services import notify
from apps.payments import services as wallet
from apps.teachers.models import TeacherPrice, TeacherSubject

from . import errors
from .models import Booking

UTC = ZoneInfo("UTC")
ACTIVE = [Booking.Status.REQUESTED, Booking.Status.CONFIRMED]


# --- Pricing ---------------------------------------------------------------

def effective_price_minor(teacher, category) -> int:
    override = (
        TeacherPrice.objects.filter(teacher=teacher, lesson_category=category, is_approved=True)
        .values_list("custom_student_price_minor", flat=True)
        .first()
    )
    return override if override is not None else category.student_price_minor


# --- Slot generation -------------------------------------------------------

def _busy_intervals(teacher, exclude_id=None):
    qs = teacher.bookings.filter(status__in=ACTIVE)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return [
        (b.scheduled_start, b.scheduled_start + timedelta(minutes=b.duration_min))
        for b in qs
    ]


def _overlaps(start, end, intervals) -> bool:
    return any(start < b_end and b_start < end for b_start, b_end in intervals)


def generate_slots(teacher, *, days=None, duration_min=None):
    """Concrete bookable slots from the teacher's recurring weekly availability."""
    days = days or settings.BOOKING_SLOT_HORIZON_DAYS
    duration = duration_min or settings.BOOKING_DEFAULT_DURATION_MIN
    tz = ZoneInfo(teacher.market.timezone)
    now = timezone.now()
    rules = list(teacher.availability.all())
    busy = _busy_intervals(teacher)

    slots = []
    today_local = now.astimezone(tz).date()
    for offset in range(days):
        day = today_local + timedelta(days=offset)
        for rule in rules:
            if rule.weekday != day.weekday():
                continue
            cursor = datetime.combine(day, rule.start_time, tzinfo=tz)
            window_end = datetime.combine(day, rule.end_time, tzinfo=tz)
            while cursor + timedelta(minutes=duration) <= window_end:
                start_utc = cursor.astimezone(UTC)
                end_utc = start_utc + timedelta(minutes=duration)
                if start_utc > now and not _overlaps(start_utc, end_utc, busy):
                    slots.append({"start": start_utc, "end": end_utc, "duration_min": duration})
                cursor += timedelta(minutes=duration)
    slots.sort(key=lambda s: s["start"])
    return slots


def _within_availability(teacher, start_utc, duration) -> bool:
    tz = ZoneInfo(teacher.market.timezone)
    local = start_utc.astimezone(tz)
    end_t = (local + timedelta(minutes=duration)).time()
    start_t = local.time()
    return any(
        rule.start_time <= start_t and end_t <= rule.end_time
        for rule in teacher.availability.filter(weekday=local.weekday())
    )


# --- Lifecycle -------------------------------------------------------------

def _guard(booking, new_status):
    if not booking.can_transition(new_status):
        raise errors.InvalidTransition()


@transaction.atomic
def request_booking(student, teacher, category, scheduled_start, *, duration_min=None, is_trial=False):
    duration = duration_min or settings.BOOKING_DEFAULT_DURATION_MIN

    if not teacher.is_published:
        raise errors.SlotUnavailable("This teacher is not accepting bookings.")
    if student.market_id != teacher.market_id:
        raise errors.MarketMismatch()
    if not TeacherSubject.objects.filter(teacher=teacher, lesson_category=category).exists():
        raise errors.NotTeaching()

    end = scheduled_start + timedelta(minutes=duration)
    if scheduled_start <= timezone.now():
        raise errors.SlotUnavailable("Choose a future time.")
    if not _within_availability(teacher, scheduled_start, duration):
        raise errors.SlotUnavailable()
    if _overlaps(scheduled_start, end, _busy_intervals(teacher)):
        raise errors.SlotUnavailable()

    if is_trial:
        if teacher.free_lessons_offered <= 0:
            raise errors.TrialUnavailable()
        prior = Booking.objects.filter(student=student, teacher=teacher, is_trial=True).exclude(
            status__in=[Booking.Status.DECLINED, Booking.Status.CANCELLED]
        )
        if prior.exists():
            raise errors.TrialUnavailable()
        price, wage = 0, 0
    else:
        price = effective_price_minor(teacher, category)
        wage = category.teacher_wage_minor

    booking = Booking.objects.create(
        student=student,
        teacher=teacher,
        lesson_category=category,
        scheduled_start=scheduled_start,
        duration_min=duration,
        price_minor=price,
        teacher_wage_minor=wage,
        currency=category.currency,
        is_trial=is_trial,
        status=Booking.Status.REQUESTED,
    )
    if price > 0:
        wallet.reserve(wallet.get_or_create_wallet(student), price, booking=booking)
    notify(teacher.user, "booking_requested", {"student": student.full_name, "booking_id": booking.id})
    return booking


@transaction.atomic
def reschedule_booking(booking, actor, new_start, *, duration_min=None):
    """Move a REQUESTED/CONFIRMED lesson to a new time (same teacher, category,
    and price — so the wallet reservation is untouched). Re-runs availability
    and overlap checks, excluding this booking from the busy set."""
    if booking.status not in ACTIVE:
        raise errors.SlotUnavailable("This lesson can no longer be rescheduled.")
    teacher = booking.teacher
    duration = duration_min or booking.duration_min
    if new_start <= timezone.now():
        raise errors.SlotUnavailable("Choose a future time.")
    if not _within_availability(teacher, new_start, duration):
        raise errors.SlotUnavailable()
    end = new_start + timedelta(minutes=duration)
    if _overlaps(new_start, end, _busy_intervals(teacher, exclude_id=booking.id)):
        raise errors.SlotUnavailable()
    booking.scheduled_start = new_start
    booking.duration_min = duration
    booking.save(update_fields=["scheduled_start", "duration_min", "updated_at"])
    recipient = teacher.user if actor == booking.student else booking.student
    notify(recipient, "booking_rescheduled", {"booking_id": booking.id})
    transaction.on_commit(lambda: calendar_sync.on_booking_rescheduled(booking))
    return booking


@transaction.atomic
def confirm_booking(booking, *, meeting_provider, meeting_link):
    _guard(booking, Booking.Status.CONFIRMED)
    booking.meeting_provider = meeting_provider
    booking.meeting_link = meeting_link
    booking.status = Booking.Status.CONFIRMED
    booking.save(update_fields=["meeting_provider", "meeting_link", "status", "updated_at"])
    notify(
        booking.student, "booking_confirmed",
        {"teacher": booking.teacher.user.full_name, "meeting_link": meeting_link},
    )
    # Push to connected Google Calendars (auto-generating the Meet link) once the
    # confirmation has committed — best-effort, never blocks the transition.
    transaction.on_commit(lambda: calendar_sync.on_booking_confirmed(booking))
    return booking


@transaction.atomic
def decline_booking(booking):
    _guard(booking, Booking.Status.DECLINED)
    if booking.price_minor > 0:
        wallet.refund(
            wallet.get_or_create_wallet(booking.student), booking.price_minor,
            booking=booking, note="Declined by teacher",
        )
    booking.status = Booking.Status.DECLINED
    booking.save(update_fields=["status", "updated_at"])
    notify(booking.student, "booking_declined", {"teacher": booking.teacher.user.full_name})
    transaction.on_commit(lambda: calendar_sync.on_booking_cancelled(booking))
    return booking


def _cancel_is_free(booking, actor) -> bool:
    if actor == booking.teacher.user:
        return True
    if booking.status == Booking.Status.REQUESTED:
        return True
    cutoff = timedelta(hours=settings.BOOKING_CANCEL_CUTOFF_HOURS)
    return timezone.now() <= booking.scheduled_start - cutoff


@transaction.atomic
def cancel_booking(booking, actor, *, reason=""):
    if booking.status == Booking.Status.DISPUTED:
        raise errors.InvalidTransition("A disputed lesson can only be resolved by a moderator.")
    _guard(booking, Booking.Status.CANCELLED)
    if booking.price_minor > 0:
        w = wallet.get_or_create_wallet(booking.student)
        if _cancel_is_free(booking, actor):
            wallet.refund(w, booking.price_minor, booking=booking, note="Cancelled")
        else:
            # Late student cancellation of a confirmed lesson — charged.
            wallet.capture(w, booking.price_minor, booking=booking, note="Late cancellation")
            _credit_teacher(booking)
    booking.status = Booking.Status.CANCELLED
    booking.cancel_reason = reason
    booking.save(update_fields=["status", "cancel_reason", "updated_at"])
    # Notify the other party.
    recipient = booking.teacher.user if actor == booking.student else booking.student
    notify(recipient, "booking_cancelled", {"booking_id": booking.id})
    transaction.on_commit(lambda: calendar_sync.on_booking_cancelled(booking))
    return booking


def _credit_teacher(booking):
    """A settled lesson counts toward the teacher's earnings and becomes payable
    (picked up by the next payout cycle — Slice 7)."""
    teacher = booking.teacher
    teacher.lessons_count = (teacher.lessons_count or 0) + 1
    teacher.save(update_fields=["lessons_count", "updated_at"])
    if not booking.wage_settled:
        booking.wage_settled = True
        booking.save(update_fields=["wage_settled", "updated_at"])


@transaction.atomic
def complete_booking(booking):
    if booking.status == Booking.Status.DISPUTED:
        raise errors.InvalidTransition("A disputed lesson can only be resolved by a moderator.")
    _guard(booking, Booking.Status.COMPLETED)
    if booking.price_minor > 0:
        wallet.capture(
            wallet.get_or_create_wallet(booking.student), booking.price_minor,
            booking=booking, note="Lesson completed",
        )
    booking.status = Booking.Status.COMPLETED
    booking.completed_at = timezone.now()
    booking.save(update_fields=["status", "completed_at", "updated_at"])
    _credit_teacher(booking)
    notify(booking.student, "lesson_completed", {"teacher": booking.teacher.user.full_name})
    return booking


@transaction.atomic
def dispute_booking(booking, *, reason=""):
    _guard(booking, Booking.Status.DISPUTED)
    booking.status = Booking.Status.DISPUTED
    booking.cancel_reason = reason
    booking.save(update_fields=["status", "cancel_reason", "updated_at"])
    return booking


@transaction.atomic
def resolve_dispute(booking, *, complete: bool):
    """Moderator resolution: complete (capture + credit) or cancel (refund)."""
    target = Booking.Status.COMPLETED if complete else Booking.Status.CANCELLED
    _guard(booking, target)
    if booking.price_minor > 0:
        w = wallet.get_or_create_wallet(booking.student)
        if complete:
            wallet.capture(w, booking.price_minor, booking=booking, note="Dispute resolved")
        else:
            wallet.refund(w, booking.price_minor, booking=booking, note="Dispute resolved")
    booking.status = target
    if complete:
        booking.completed_at = timezone.now()
        booking.save(update_fields=["status", "completed_at", "updated_at"])
        _credit_teacher(booking)
    else:
        booking.save(update_fields=["status", "updated_at"])
    return booking


def autocomplete_due(now=None) -> int:
    """Auto-complete confirmed lessons whose auto-complete window has elapsed.

    Run periodically (management command / cron). Returns how many settled.
    """
    now = now or timezone.now()
    window = timedelta(hours=settings.BOOKING_AUTOCOMPLETE_HOURS)
    # Coarse DB filter (start <= now - window is a valid superset of due lessons).
    candidates = Booking.objects.filter(
        status=Booking.Status.CONFIRMED, scheduled_start__lte=now - window
    )
    settled = 0
    for booking in candidates:
        lesson_end = booking.scheduled_start + timedelta(minutes=booking.duration_min)
        if lesson_end + window <= now:
            complete_booking(booking)
            settled += 1
    return settled


@transaction.atomic
def mark_no_show(booking):
    """Teacher reports a student no-show: the lesson is charged (reserve captured)."""
    _guard(booking, Booking.Status.NO_SHOW)
    if booking.price_minor > 0:
        wallet.capture(
            wallet.get_or_create_wallet(booking.student), booking.price_minor,
            booking=booking, note="Student no-show",
        )
        _credit_teacher(booking)
    booking.status = Booking.Status.NO_SHOW
    booking.save(update_fields=["status", "updated_at"])
    return booking
