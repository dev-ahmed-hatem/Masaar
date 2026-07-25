from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.payments import services as wallet
from apps.payments.models import Wallet
from apps.teachers.models import AvailabilityRule, TeacherProfile, TeacherSubject

pytestmark = pytest.mark.django_db

BOOKINGS = "/api/bookings/"
SLOTS = "/api/bookings/slots/"
WALLET = "/api/wallet/"


def slot_at(delta: timedelta):
    t = (timezone.now() + delta).replace(minute=0, second=0, microsecond=0)
    return t.replace(hour=22) if t.hour >= 23 else t


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    physics = Subject.objects.create(name_en="Physics", name_ar="فيزياء")

    eg_math = LessonCategory.objects.create(
        market=eg, vertical=primary, grade_level=g4, subject=math,
        student_price_minor=6000, teacher_wage_minor=3500, currency="EGP",
    )
    eg_physics = LessonCategory.objects.create(
        market=eg, vertical=primary, grade_level=g4, subject=physics,
        student_price_minor=8000, teacher_wage_minor=5000, currency="EGP",
    )

    tuser = User.objects.create_user(
        phone="+201000000200", full_name="Teacher T", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(
        user=tuser, market=eg, is_published=True, free_lessons_offered=1, bio_en="hi"
    )
    TeacherSubject.objects.create(teacher=teacher, lesson_category=eg_math)
    for wd in range(7):
        AvailabilityRule.objects.create(teacher=teacher, weekday=wd, start_time="00:00", end_time="23:59")

    student = User.objects.create_user(
        phone="+201000000201", full_name="Student S", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    wallet.credit(wallet.get_or_create_wallet(student), 100000)

    return {
        "eg": eg, "teacher": teacher, "tuser": tuser, "student": student,
        "eg_math": eg_math, "eg_physics": eg_physics,
    }


def _book(api, world, when, *, category=None, is_trial=False):
    api.force_authenticate(user=world["student"])
    return api.post(
        BOOKINGS,
        {
            "teacher": world["teacher"].id,
            "lesson_category": (category or world["eg_math"]).id,
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
    w = _wallet(world["student"])
    assert w.available_minor == 94000 and w.reserved_minor == 6000


def test_insufficient_balance(api, world):
    poor = User.objects.create_user(
        phone="+201000000209", role=User.Role.STUDENT, market=world["eg"], is_verified=True
    )
    wallet.credit(wallet.get_or_create_wallet(poor), 1000)
    api.force_authenticate(user=poor)
    res = api.post(
        BOOKINGS,
        {"teacher": world["teacher"].id, "lesson_category": world["eg_math"].id,
         "scheduled_start": slot_at(timedelta(days=2)).isoformat()},
        format="json",
    )
    assert res.status_code == 400 and res.data["error"]["code"] == "insufficient_balance"


def test_not_teaching_rejected(api, world):
    res = _book(api, world, slot_at(timedelta(days=3)), category=world["eg_physics"])
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


# --- Trials ----------------------------------------------------------------

def test_trial_is_free_and_single_use(api, world):
    res = _book(api, world, slot_at(timedelta(days=3)), is_trial=True)
    assert res.status_code == 201 and res.data["price_minor"] == 0
    assert _wallet(world["student"]).reserved_minor == 0  # nothing held

    second = _book(api, world, slot_at(timedelta(days=4)), is_trial=True)
    assert second.status_code == 400 and second.data["error"]["code"] == "trial_unavailable"


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
