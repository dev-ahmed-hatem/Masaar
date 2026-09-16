from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import StagePricingRule, Subject, Track, Vertical
from apps.markets.models import Market
from apps.payments import services as wallet
from apps.payments.models import Wallet
from apps.teachers.models import TeacherProfile
from apps.teachers.tests.factories import booking_lesson, make_stage_card

pytestmark = pytest.mark.django_db

BOOKINGS = "/api/bookings/"
SLOTS = "/api/bookings/slots/"
WALLET = "/api/wallet/"


def slot_at(delta: timedelta):
    t = (timezone.now() + delta).replace(minute=0, second=0, microsecond=0)
    return t.replace(hour=22) if t.hour >= 23 else t


@pytest.fixture
def world():
    eg = Market.objects.update_or_create(code="EG", defaults={"name": "Egypt", "currency": "EGP", "timezone": "UTC"})[0]
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    physics = Subject.objects.create(name_en="Physics", name_ar="فيزياء")

    # Stage pricing: primary min 1000, 15% commission; the teacher prices at 6000.
    StagePricingRule.objects.create(
        market=eg, vertical=primary, min_price_minor=1000, commission_pct=15
    )

    tuser = User.objects.create_user(
        phone="+201000000200", full_name="Teacher T", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True, bio_en="hi")
    # Primary card: Math only, 6000/lesson, one free trial, available all week.
    card = make_stage_card(teacher, primary, [math], price_minor=6000, free_lessons_offered=1)

    student = User.objects.create_user(
        phone="+201000000201", full_name="Student S", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    wallet.credit(wallet.get_or_create_wallet(student), 100000)

    return {
        "eg": eg, "teacher": teacher, "tuser": tuser, "student": student,
        "primary": primary, "card": card, "math": math, "physics": physics,
    }


def _book(api, world, when, *, card=None, subject=None, is_trial=False):
    api.force_authenticate(user=world["student"])
    return api.post(
        BOOKINGS,
        {
            "teacher_stage": (card or world["card"]).id,
            "subject": (subject or world["math"]).id,
            "scheduled_start": when.isoformat(),
            "is_trial": is_trial,
        },
        format="json",
    )


def _confirm(api, world, booking_id):
    api.force_authenticate(user=world["tuser"])
    return api.post(
        f"{BOOKINGS}{booking_id}/confirm/",
        {"meeting_provider": "ZOOM", "meeting_link": "https://zoom.us/j/1"},
        format="json",
    )


def _wallet(student):
    return Wallet.objects.get(user=student)


# --- Slots -----------------------------------------------------------------

def test_slots_listing(api, world):
    api.force_authenticate(user=world["student"])
    res = api.get(SLOTS, {"teacher": world["teacher"].id, "days": 3})
    assert res.status_code == 200 and len(res.data) > 0
    assert all(s["start"] > timezone.now().isoformat() for s in res.data)


# --- Request + reserve -----------------------------------------------------

def test_request_reserves_wallet(api, world):
    res = _book(api, world, slot_at(timedelta(days=3)))
    assert res.status_code == 201 and res.data["status"] == "REQUESTED"
    assert res.data["price_minor"] == 6000
    assert res.data["teacher_stage"] == world["card"].id
    assert res.data["lesson"]["label"] == "Primary · Mathematics"
    w = _wallet(world["student"])
    assert w.available_minor == 94000 and w.reserved_minor == 6000


def test_commission_split_freezes_wage(api, world):
    # price 6000 @ 15% -> commission 900, wage 5100; wage + commission == price.
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    b = Booking.objects.get(id=booking_id)
    assert b.price_minor == 6000
    assert b.teacher_wage_minor == 5100
    assert b.price_minor - b.teacher_wage_minor == 900


def test_insufficient_balance(api, world):
    poor = User.objects.create_user(
        phone="+201000000209", role=User.Role.STUDENT, market=world["eg"], is_verified=True
    )
    wallet.credit(wallet.get_or_create_wallet(poor), 1000)
    api.force_authenticate(user=poor)
    res = api.post(
        BOOKINGS,
        {"teacher_stage": world["card"].id, "subject": world["math"].id,
         "scheduled_start": slot_at(timedelta(days=2)).isoformat()},
        format="json",
    )
    assert res.status_code == 400 and res.data["error"]["code"] == "insufficient_balance"


def test_not_teaching_rejected(api, world):
    res = _book(api, world, slot_at(timedelta(days=3)), subject=world["physics"])
    assert res.status_code == 400 and res.data["error"]["code"] == "not_teaching"


# --- Confirm + complete ----------------------------------------------------

def test_confirm_then_complete_captures_and_credits(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]

    confirmed = _confirm(api, world, booking_id)
    assert confirmed.status_code == 200 and confirmed.data["status"] == "CONFIRMED"
    assert confirmed.data["meeting_link"] == "https://zoom.us/j/1"

    api.force_authenticate(user=world["student"])
    done = api.post(f"{BOOKINGS}{booking_id}/complete/", format="json")
    assert done.status_code == 200 and done.data["status"] == "COMPLETED"

    w = _wallet(world["student"])
    assert w.available_minor == 94000 and w.reserved_minor == 0  # captured
    world["teacher"].refresh_from_db()
    assert world["teacher"].lessons_count == 1


def test_complete_requires_confirmed(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    api.force_authenticate(user=world["student"])
    res = api.post(f"{BOOKINGS}{booking_id}/complete/", format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "invalid_transition"


def test_cancel_frees_the_slot(api, world):
    from apps.bookings import services

    when = slot_at(timedelta(days=3))
    booking_id = _book(api, world, when).data["id"]

    def has_slot(t):
        return any(s["start"] == t for s in services.generate_slots(world["teacher"], days=5))

    assert not has_slot(when)  # booked -> the slot is blocked
    api.force_authenticate(user=world["student"])
    api.post(f"{BOOKINGS}{booking_id}/cancel/", {"reason": "x"}, format="json")
    assert has_slot(when)  # cancelling frees it again


def test_reschedule_moves_the_blocked_slot(api, world):
    from apps.bookings import services

    old_when = slot_at(timedelta(days=3))
    new_when = slot_at(timedelta(days=4))
    booking_id = _book(api, world, old_when).data["id"]

    def has_slot(t):
        return any(s["start"] == t for s in services.generate_slots(world["teacher"], days=6))

    assert not has_slot(old_when) and has_slot(new_when)
    api.force_authenticate(user=world["student"])
    api.post(
        f"{BOOKINGS}{booking_id}/reschedule/",
        {"scheduled_start": new_when.isoformat()},
        format="json",
    )
    assert has_slot(old_when) and not has_slot(new_when)  # old freed, new blocked


def test_decline_refunds(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    api.force_authenticate(user=world["tuser"])
    res = api.post(f"{BOOKINGS}{booking_id}/decline/", format="json")
    assert res.status_code == 200 and res.data["status"] == "DECLINED"
    w = _wallet(world["student"])
    assert w.available_minor == 100000 and w.reserved_minor == 0  # refunded


# --- Cancellation policy ---------------------------------------------------

def test_cancel_before_cutoff_refunds(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    _confirm(api, world, booking_id)
    api.force_authenticate(user=world["student"])
    res = api.post(f"{BOOKINGS}{booking_id}/cancel/", {"reason": "sick"}, format="json")
    assert res.status_code == 200 and res.data["status"] == "CANCELLED"
    assert _wallet(world["student"]).available_minor == 100000  # full refund


def test_late_cancel_forfeits(api, world):
    booking_id = _book(api, world, slot_at(timedelta(hours=6))).data["id"]
    _confirm(api, world, booking_id)
    api.force_authenticate(user=world["student"])
    res = api.post(f"{BOOKINGS}{booking_id}/cancel/", format="json")
    assert res.status_code == 200
    w = _wallet(world["student"])
    assert w.available_minor == 94000 and w.reserved_minor == 0  # charged
    world["teacher"].refresh_from_db()
    assert world["teacher"].lessons_count == 1


def test_teacher_cancel_always_refunds(api, world):
    booking_id = _book(api, world, slot_at(timedelta(hours=6))).data["id"]
    _confirm(api, world, booking_id)
    api.force_authenticate(user=world["tuser"])
    res = api.post(f"{BOOKINGS}{booking_id}/cancel/", format="json")
    assert res.status_code == 200
    assert _wallet(world["student"]).available_minor == 100000  # full refund even though late


# --- Disputes --------------------------------------------------------------

def test_dispute_then_resolve_complete(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    _confirm(api, world, booking_id)
    api.force_authenticate(user=world["student"])
    disp = api.post(f"{BOOKINGS}{booking_id}/dispute/", {"reason": "no show"}, format="json")
    assert disp.data["status"] == "DISPUTED"
    assert _wallet(world["student"]).reserved_minor == 6000  # still held

    staff = User.objects.create_user(phone="+201000000250", role=User.Role.MODERATOR, is_verified=True)
    api.force_authenticate(user=staff)
    res = api.post(f"{BOOKINGS}{booking_id}/resolve/", {"complete": True}, format="json")
    assert res.status_code == 200 and res.data["status"] == "COMPLETED"
    assert _wallet(world["student"]).reserved_minor == 0


def test_dispute_resolve_cancel_refunds(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    _confirm(api, world, booking_id)
    api.force_authenticate(user=world["student"])
    api.post(f"{BOOKINGS}{booking_id}/dispute/", format="json")
    staff = User.objects.create_user(phone="+201000000251", role=User.Role.MODERATOR, is_verified=True)
    api.force_authenticate(user=staff)
    res = api.post(f"{BOOKINGS}{booking_id}/resolve/", {"complete": False}, format="json")
    assert res.status_code == 200 and res.data["status"] == "CANCELLED"
    assert _wallet(world["student"]).available_minor == 100000  # refunded


# --- Disputes are staff-only to resolve ------------------------------------

def test_disputed_booking_blocks_participant_complete_and_cancel(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    _confirm(api, world, booking_id)
    api.force_authenticate(user=world["student"])
    api.post(f"{BOOKINGS}{booking_id}/dispute/", {"reason": "no show"}, format="json")

    # Student cannot self-complete a disputed lesson.
    res = api.post(f"{BOOKINGS}{booking_id}/complete/", format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "invalid_transition"

    # Teacher cannot cancel (which would auto-refund and nullify the dispute).
    api.force_authenticate(user=world["tuser"])
    res = api.post(f"{BOOKINGS}{booking_id}/cancel/", format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "invalid_transition"

    # Only a moderator can resolve it.
    staff = User.objects.create_user(phone="+201000000280", role=User.Role.MODERATOR, is_verified=True)
    api.force_authenticate(user=staff)
    res = api.post(f"{BOOKINGS}{booking_id}/resolve/", {"complete": True}, format="json")
    assert res.status_code == 200 and res.data["status"] == "COMPLETED"


# --- Group filter ----------------------------------------------------------

def test_group_past_returns_only_terminal(api, world):
    # One requested (active) + one declined (terminal).
    _book(api, world, slot_at(timedelta(days=3)))
    declined_id = _book(api, world, slot_at(timedelta(days=4))).data["id"]
    api.force_authenticate(user=world["tuser"])
    api.post(f"{BOOKINGS}{declined_id}/decline/", format="json")

    api.force_authenticate(user=world["student"])
    res = api.get(BOOKINGS, {"group": "past"})
    assert res.status_code == 200
    statuses = {r["status"] for r in res.data["results"]}
    assert statuses == {"DECLINED"}
    # Requested tab excludes the declined one.
    req = api.get(BOOKINGS, {"group": "requested"})
    assert all(r["status"] == "REQUESTED" for r in req.data["results"])


# --- Trials ----------------------------------------------------------------

def test_trial_is_free_and_limited_per_card(api, world):
    res = _book(api, world, slot_at(timedelta(days=3)), is_trial=True)
    assert res.status_code == 201 and res.data["price_minor"] == 0
    assert _wallet(world["student"]).reserved_minor == 0  # nothing held

    second = _book(api, world, slot_at(timedelta(days=4)), is_trial=True)
    assert second.status_code == 400 and second.data["error"]["code"] == "trial_unavailable"


# --- Reschedule ------------------------------------------------------------

def test_student_reschedule_moves_time_keeps_reserve(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    new_when = slot_at(timedelta(days=4))
    api.force_authenticate(user=world["student"])
    res = api.post(
        f"{BOOKINGS}{booking_id}/reschedule/",
        {"scheduled_start": new_when.isoformat()},
        format="json",
    )
    assert res.status_code == 200 and res.data["status"] == "REQUESTED"
    assert res.data["scheduled_start"][:19] == new_when.isoformat()[:19]
    assert _wallet(world["student"]).reserved_minor == 6000  # reserve untouched


def test_reschedule_rejects_past_time(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    api.force_authenticate(user=world["student"])
    res = api.post(
        f"{BOOKINGS}{booking_id}/reschedule/",
        {"scheduled_start": (timezone.now() - timedelta(days=1)).isoformat()},
        format="json",
    )
    assert res.status_code == 400 and res.data["error"]["code"] == "slot_unavailable"


def test_reschedule_rejects_non_participant(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    intruder = User.objects.create_user(
        phone="+201000000270", role=User.Role.STUDENT, market=world["eg"], is_verified=True
    )
    api.force_authenticate(user=intruder)
    res = api.post(
        f"{BOOKINGS}{booking_id}/reschedule/",
        {"scheduled_start": slot_at(timedelta(days=4)).isoformat()},
        format="json",
    )
    assert res.status_code == 403


# --- Scoping ---------------------------------------------------------------

def test_other_student_cannot_view_booking(api, world):
    booking_id = _book(api, world, slot_at(timedelta(days=3))).data["id"]
    intruder = User.objects.create_user(
        phone="+201000000260", role=User.Role.STUDENT, market=world["eg"], is_verified=True
    )
    api.force_authenticate(user=intruder)
    assert api.get(f"{BOOKINGS}{booking_id}/").status_code == 403


def test_wallet_endpoint(api, world):
    api.force_authenticate(user=world["student"])
    res = api.get(WALLET)
    assert res.status_code == 200
    assert res.data["wallet"]["available_minor"] == 100000


# --- Auto-complete job -----------------------------------------------------

def test_autocomplete_settles_only_elapsed(api, world):
    from apps.bookings import services

    w = wallet.get_or_create_wallet(world["student"])

    def _confirmed(start):
        b = Booking.objects.create(
            student=world["student"], teacher=world["teacher"],
            **booking_lesson(world["card"], world["math"]),
            scheduled_start=start, duration_min=60, price_minor=6000, teacher_wage_minor=3500,
            currency="EGP", status=Booking.Status.CONFIRMED,
        )
        wallet.reserve(w, 6000, booking=b)
        return b

    # Ended > 24h ago -> due; ended just now -> not due.
    due = _confirmed(timezone.now() - timedelta(hours=26))
    fresh = _confirmed(timezone.now() - timedelta(minutes=30))

    settled = services.autocomplete_due()
    assert settled == 1

    due.refresh_from_db()
    fresh.refresh_from_db()
    assert due.status == Booking.Status.COMPLETED
    assert fresh.status == Booking.Status.CONFIRMED
    # One lesson captured (6000 of the 12000 reserved).
    assert _wallet(world["student"]).reserved_minor == 6000


# --- Stage cards -----------------------------------------------------------

@pytest.fixture
def science_card(world):
    """A second card (Secondary · Science: Physics) with its own hours/price/trials."""
    secondary = Vertical.objects.create(
        code=Vertical.Code.SECONDARY, name_en="Secondary", name_ar="ثانوي",
        child_kind=Vertical.ChildKind.BRANCH,
    )
    science = Track.objects.create(vertical=secondary, name_en="Science", name_ar="علمي")
    tomorrow = (timezone.now() + timedelta(days=1)).weekday()
    return make_stage_card(
        world["teacher"], secondary, [world["physics"]], track=science,
        price_minor=9000, free_lessons_offered=2, windows=[(tomorrow, "10:00", "12:00")],
    )


def test_slots_scoped_to_stage_card(api, world, science_card):
    res = api.get(SLOTS, {"teacher": world["teacher"].id, "stage": science_card.id, "days": 7})
    assert res.status_code == 200 and res.data
    # Only the science card's 10:00-12:00 window (two 60-min slots per week).
    assert {s["start"][11:16] for s in res.data} <= {"10:00", "11:00"}

    other_teacher_card = api.get(SLOTS, {"teacher": 999999, "stage": science_card.id})
    assert other_teacher_card.status_code == 404


def test_booking_outside_card_availability_rejected(api, world, science_card):
    when = slot_at(timedelta(days=3)).replace(hour=15)  # outside 10:00-12:00
    res = _book(api, world, when, card=science_card, subject=world["physics"])
    assert res.status_code == 400 and res.data["error"]["code"] == "slot_unavailable"


def test_booking_uses_card_price_and_snapshot(api, world, science_card):
    when = (timezone.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    res = _book(api, world, when, card=science_card, subject=world["physics"])
    assert res.status_code == 201 and res.data["price_minor"] == 9000
    b = Booking.objects.get(id=res.data["id"])
    assert (b.vertical_id, b.track_id, b.subject_id) == (
        science_card.vertical_id, science_card.track_id, world["physics"].id
    )
    assert res.data["lesson"]["label"] == "Secondary · Science · Physics"


def test_subject_must_belong_to_card(api, world, science_card):
    res = _book(api, world, slot_at(timedelta(days=3)), card=world["card"], subject=world["physics"])
    assert res.status_code == 400 and res.data["error"]["code"] == "not_teaching"


def test_busy_time_blocks_across_cards(api, world, science_card):
    when = (timezone.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    assert _book(api, world, when).status_code == 201  # primary card, all-week hours
    res = _book(api, world, when, card=science_card, subject=world["physics"])
    assert res.status_code == 400 and res.data["error"]["code"] == "slot_unavailable"


def test_trial_allowance_counts_per_card(api, world, science_card):
    # Primary card offers 1 trial, science card offers 2 — counted separately.
    assert _book(api, world, slot_at(timedelta(days=3)), is_trial=True).status_code == 201
    assert _book(api, world, slot_at(timedelta(days=4)), is_trial=True).status_code == 400

    day = timezone.now() + timedelta(days=1)
    at = lambda h, weeks=0: (day + timedelta(weeks=weeks)).replace(  # noqa: E731
        hour=h, minute=0, second=0, microsecond=0
    )
    first = _book(api, world, at(10), card=science_card, subject=world["physics"], is_trial=True)
    second = _book(api, world, at(11), card=science_card, subject=world["physics"], is_trial=True)
    third = _book(api, world, at(10, 1), card=science_card, subject=world["physics"], is_trial=True)
    assert first.status_code == 201 and second.status_code == 201
    assert third.status_code == 400 and third.data["error"]["code"] == "trial_unavailable"

    # A cancelled trial gives the allowance back.
    api.force_authenticate(user=world["student"])
    api.post(f"{BOOKINGS}{second.data['id']}/cancel/", format="json")
    assert _book(api, world, at(10, 1), card=science_card, subject=world["physics"], is_trial=True).status_code == 201


def test_no_trial_when_card_offers_none(api, world, science_card):
    science_card.free_lessons_offered = 0
    science_card.save()
    when = (timezone.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    res = _book(api, world, when, card=science_card, subject=world["physics"], is_trial=True)
    assert res.status_code == 400 and res.data["error"]["code"] == "trial_unavailable"


def test_reschedule_uses_card_availability(api, world, science_card):
    when = (timezone.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    booking_id = _book(api, world, when, card=science_card, subject=world["physics"]).data["id"]
    api.force_authenticate(user=world["student"])
    outside = api.post(
        f"{BOOKINGS}{booking_id}/reschedule/",
        {"scheduled_start": when.replace(hour=15).isoformat()}, format="json",
    )
    assert outside.status_code == 400
    inside = api.post(
        f"{BOOKINGS}{booking_id}/reschedule/",
        {"scheduled_start": (when + timedelta(weeks=1)).isoformat()}, format="json",
    )
    assert inside.status_code == 200
