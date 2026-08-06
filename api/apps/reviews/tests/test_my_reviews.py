import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.teachers.models import TeacherProfile, TeacherSubject

pytestmark = pytest.mark.django_db
REVIEWS = "/api/reviews/"


@pytest.fixture
def setup():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    v = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g = GradeLevel.objects.create(vertical=v, name_en="Grade 4", name_ar="الصف 4")
    subj = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    cat = LessonCategory.objects.create(
        market=eg, vertical=v, grade_level=g, subject=subj,
        student_price_minor=6000, teacher_wage_minor=3500, currency="EGP",
    )
    tuser = User.objects.create_user(
        phone="+201000000500", role=User.Role.TEACHER, market=eg, is_verified=True, full_name="T"
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True)
    TeacherSubject.objects.create(teacher=teacher, lesson_category=cat)
    student = User.objects.create_user(
        phone="+201000000501", role=User.Role.STUDENT, market=eg, is_verified=True, full_name="S"
    )
    booking = Booking.objects.create(
        student=student, teacher=teacher, lesson_category=cat,
        scheduled_start=timezone.now(), duration_min=60, price_minor=6000,
        teacher_wage_minor=3500, currency="EGP", status=Booking.Status.COMPLETED,
        completed_at=timezone.now(),
    )
    return {"student": student, "booking": booking}


def test_my_reviews_returns_own(api, setup):
    api.force_authenticate(user=setup["student"])
    posted = api.post(
        REVIEWS, {"booking": setup["booking"].id, "rating": 5, "text": "Great"}, format="json"
    )
    assert posted.status_code == 201

    mine = api.get(REVIEWS, {"mine": "true"})
    assert mine.status_code == 200
    results = mine.data["results"] if isinstance(mine.data, dict) else mine.data
    assert len(results) == 1 and results[0]["rating"] == 5
