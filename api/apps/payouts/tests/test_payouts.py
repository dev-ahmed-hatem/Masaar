from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.payouts.models import PayoutCycle, PayoutItem
from apps.teachers.models import TeacherProfile

pytestmark = pytest.mark.django_db

CYCLES = "/api/payout-cycles/"
MY = "/api/my-payouts/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ا")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="4")
    math = Subject.objects.create(name_en="Math", name_ar="ر")
    cat = LessonCategory.objects.create(
        market=eg, vertical=primary, grade_level=g4, subject=math,
        student_price_minor=6000, teacher_wage_minor=3500, currency="EGP",
    )

    def teacher(phone, name):
        u = User.objects.create_user(phone=phone, full_name=name, role=User.Role.TEACHER, market=eg, is_verified=True)
        return TeacherProfile.objects.create(user=u, market=eg, is_published=True)

    ta = teacher("+201000000600", "Teacher A")
    tb = teacher("+201000000601", "Teacher B")
    student = User.objects.create_user(phone="+201000000602", role=User.Role.STUDENT, market=eg, is_verified=True)
    staff = User.objects.create_user(phone="+201000000603", role=User.Role.MODERATOR, is_verified=True)
    return {"eg": eg, "cat": cat, "ta": ta, "tb": tb, "student": student, "staff": staff}


def _settled(world, teacher, wage, *, settled=True):
    return Booking.objects.create(
        student=world["student"], teacher=teacher, lesson_category=world["cat"],
        scheduled_start=timezone.now() - timedelta(days=2), duration_min=60,
        price_minor=6000, teacher_wage_minor=wage, currency="EGP",
        status=Booking.Status.COMPLETED, wage_settled=settled,
    )


def _generate(api, world):
    api.force_authenticate(user=world["staff"])
    return api.post(
        CYCLES, {"market": "EG", "period_start": "2026-07-01", "period_end": "2026-07-31"}, format="json"
    )


def test_generate_cycle_groups_by_teacher(api, world):
    _settled(world, world["ta"], 3500)
    _settled(world, world["ta"], 3500)
    _settled(world, world["tb"], 5000)

    res = _generate(api, world)
    assert res.status_code == 201
    items = {i["teacher_name"]: i for i in res.data["items"]}
    assert items["Teacher A"]["amount_minor"] == 7000 and items["Teacher A"]["lessons_count"] == 2
    assert items["Teacher B"]["amount_minor"] == 5000
    assert items["Teacher A"]["amount_display"] == "70.00 EGP"

    # Bookings are now linked so they can't be paid again.
    assert Booking.objects.filter(payout_item__isnull=True, wage_settled=True).count() == 0


def test_unsettled_and_already_paid_excluded(api, world):
    _settled(world, world["ta"], 3500)              # payable
    _settled(world, world["ta"], 3500, settled=False)  # not settled -> excluded
    _generate(api, world)

    # A second run has nothing new to pay.
    second = _generate(api, world)
    assert second.data["items"] == []


def test_mark_item_paid_closes_cycle(api, world):
    _settled(world, world["ta"], 3500)
    _settled(world, world["tb"], 5000)
    cycle_id = _generate(api, world).data["id"]

    detail = api.get(f"{CYCLES}{cycle_id}/").data
    item_ids = [i["id"] for i in detail["items"]]

    r1 = api.post(f"/api/payout-items/{item_ids[0]}/mark-paid/", {"reference": "TRX-1"}, format="json")
    assert r1.status_code == 200 and r1.data["status"] == "PAID" and r1.data["reference"] == "TRX-1"
    assert api.get(f"{CYCLES}{cycle_id}/").data["status"] == "PROCESSING"

    api.post(f"/api/payout-items/{item_ids[1]}/mark-paid/", {"reference": "TRX-2"}, format="json")
    assert api.get(f"{CYCLES}{cycle_id}/").data["status"] == "PAID"


def test_teacher_sees_own_statement(api, world):
    _settled(world, world["ta"], 3500)
    _settled(world, world["tb"], 5000)
    _generate(api, world)

    api.force_authenticate(user=world["ta"].user)
    res = api.get(MY)
    assert res.status_code == 200 and len(res.data) == 1
    assert res.data[0]["teacher_name"] == "Teacher A" and res.data[0]["amount_minor"] == 3500


def test_generation_requires_staff(api, world):
    api.force_authenticate(user=world["student"])
    res = api.post(CYCLES, {"market": "EG", "period_start": "2026-07-01", "period_end": "2026-07-31"}, format="json")
    assert res.status_code == 403
