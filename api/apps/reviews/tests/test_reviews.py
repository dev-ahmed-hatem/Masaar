from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.reviews.models import Review
from apps.teachers.models import TeacherProfile

pytestmark = pytest.mark.django_db

REVIEWS = "/api/reviews/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    cat = LessonCategory.objects.create(
        market=eg, vertical=primary, grade_level=g4, subject=math,
        student_price_minor=6000, teacher_wage_minor=3500, currency="EGP",
    )
    tuser = User.objects.create_user(
        phone="+201000000500", full_name="Rated Teacher", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True)
    student = User.objects.create_user(
        phone="+201000000501", full_name="Reviewer One", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    staff = User.objects.create_user(phone="+201000000502", role=User.Role.MODERATOR, is_verified=True)
    return {"eg": eg, "cat": cat, "teacher": teacher, "student": student, "staff": staff}


def _booking(world, student, status=Booking.Status.COMPLETED):
    return Booking.objects.create(
        student=student, teacher=world["teacher"], lesson_category=world["cat"],
        scheduled_start=timezone.now() - timedelta(days=1), duration_min=60,
        price_minor=6000, teacher_wage_minor=3500, currency="EGP", status=status,
    )


def _rating(world):
    world["teacher"].refresh_from_db()
    return float(world["teacher"].rating_avg), world["teacher"].rating_count


def test_create_review_recomputes_rating(api, world):
    api.force_authenticate(user=world["student"])
    b1 = _booking(world, world["student"])
    res = api.post(REVIEWS, {"booking": b1.id, "rating": 5, "text": "Great"}, format="json")
    assert res.status_code == 201
    assert _rating(world) == (5.0, 1)

    other = User.objects.create_user(
        phone="+201000000509", full_name="Reviewer Two", role=User.Role.STUDENT, market=world["eg"], is_verified=True
    )
    b2 = _booking(world, other)
    api.force_authenticate(user=other)
    api.post(REVIEWS, {"booking": b2.id, "rating": 3}, format="json")
    assert _rating(world) == (4.0, 2)  # (5 + 3) / 2


def test_cannot_review_uncompleted_booking(api, world):
    api.force_authenticate(user=world["student"])
    b = _booking(world, world["student"], status=Booking.Status.CONFIRMED)
    res = api.post(REVIEWS, {"booking": b.id, "rating": 5}, format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "booking_not_completed"


def test_cannot_review_others_booking(api, world):
    b = _booking(world, world["student"])
    intruder = User.objects.create_user(
        phone="+201000000508", role=User.Role.STUDENT, market=world["eg"], is_verified=True
    )
    api.force_authenticate(user=intruder)
    assert api.post(REVIEWS, {"booking": b.id, "rating": 1}, format="json").status_code == 403


def test_one_review_per_booking(api, world):
    api.force_authenticate(user=world["student"])
    b = _booking(world, world["student"])
    api.post(REVIEWS, {"booking": b.id, "rating": 5}, format="json")
    again = api.post(REVIEWS, {"booking": b.id, "rating": 4}, format="json")
    assert again.status_code == 400 and again.data["error"]["code"] == "already_reviewed"


def test_public_list_shows_published_only(api, world):
    api.force_authenticate(user=world["student"])
    b = _booking(world, world["student"])
    api.post(REVIEWS, {"booking": b.id, "rating": 5}, format="json")
    Review.objects.filter(booking=b).update(is_published=False)

    api.force_authenticate(user=None)
    res = api.get(REVIEWS, {"teacher": world["teacher"].id})
    assert res.data["count"] == 0


def test_unpublish_recomputes_and_moderation_is_staff_only(api, world):
    api.force_authenticate(user=world["student"])
    b = _booking(world, world["student"])
    review_id = api.post(REVIEWS, {"booking": b.id, "rating": 5}, format="json").data["id"]
    assert _rating(world) == (5.0, 1)

    # Student cannot moderate.
    assert api.post(f"{REVIEWS}{review_id}/unpublish/", format="json").status_code == 403

    api.force_authenticate(user=world["staff"])
    res = api.post(f"{REVIEWS}{review_id}/unpublish/", format="json")
    assert res.status_code == 200 and res.data["is_published"] is False
    assert _rating(world) == (0.0, 0)  # excluded from the average

    api.post(f"{REVIEWS}{review_id}/republish/", format="json")
    assert _rating(world) == (5.0, 1)
