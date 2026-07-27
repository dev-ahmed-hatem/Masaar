import pytest

from apps.accounts.models import User
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.notifications.models import Notification
from apps.teachers.models import TeacherPrice, TeacherProfile

pytestmark = pytest.mark.django_db

PRICE_REQUESTS = "/api/price-requests/"
CATEGORIES = "/api/admin/lesson-categories/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    science = Subject.objects.create(name_en="Science", name_ar="علوم")
    cat = LessonCategory.objects.create(
        market=eg, vertical=primary, grade_level=g4, subject=math,
        student_price_minor=6000, teacher_wage_minor=3500, currency="EGP",
    )
    tuser = User.objects.create_user(
        phone="+201000000900", full_name="Price Teacher", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True)
    staff = User.objects.create_user(phone="+201000000901", role=User.Role.MODERATOR, is_verified=True)
    return {
        "eg": eg, "primary": primary, "g4": g4, "math": math, "science": science,
        "cat": cat, "teacher": teacher, "staff": staff,
    }


def test_price_request_queue_approve(api, world):
    price = TeacherPrice.objects.create(
        teacher=world["teacher"], lesson_category=world["cat"],
        custom_student_price_minor=7000, is_approved=False,
    )
    api.force_authenticate(user=world["staff"])
    res = api.get(PRICE_REQUESTS)
    assert res.status_code == 200 and res.data["count"] == 1
    assert res.data["results"][0]["default_price_minor"] == 6000

    res = api.post(f"{PRICE_REQUESTS}{price.id}/approve/")
    assert res.status_code == 200 and res.data["is_approved"] is True
    price.refresh_from_db()
    assert price.is_approved
    assert Notification.objects.filter(
        user=world["teacher"].user, event_type="price_request_approved"
    ).exists()
    # queue now empty; approved filter shows it
    assert api.get(PRICE_REQUESTS).data["count"] == 0
    assert api.get(f"{PRICE_REQUESTS}?status=approved").data["count"] == 1


def test_price_request_reject_deletes_and_notifies(api, world):
    price = TeacherPrice.objects.create(
        teacher=world["teacher"], lesson_category=world["cat"],
        custom_student_price_minor=9000, is_approved=False,
    )
    api.force_authenticate(user=world["staff"])
    res = api.post(f"{PRICE_REQUESTS}{price.id}/reject/", {"reason": "too high"}, format="json")
    assert res.status_code == 200
    assert not TeacherPrice.objects.filter(id=price.id).exists()
    n = Notification.objects.get(user=world["teacher"].user, event_type="price_request_rejected")
    assert n.payload["reason"] == "too high"


def test_price_requests_staff_only(api, world):
    api.force_authenticate(user=world["teacher"].user)
    assert api.get(PRICE_REQUESTS).status_code == 403


def test_lesson_category_crud(api, world):
    api.force_authenticate(user=world["staff"])
    res = api.get(f"{CATEGORIES}?market=EG")
    assert res.status_code == 200 and res.data["count"] == 1

    res = api.post(
        CATEGORIES,
        {
            "market": "EG", "vertical": world["primary"].id,
            "grade_level": world["g4"].id, "subject": world["science"].id,
            "student_price_minor": 5000, "teacher_wage_minor": 3000,
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["currency"] == "EGP"  # inherited from market

    # duplicate pricing key rejected cleanly
    res_dup = api.post(
        CATEGORIES,
        {
            "market": "EG", "vertical": world["primary"].id,
            "grade_level": world["g4"].id, "subject": world["science"].id,
            "student_price_minor": 1000, "teacher_wage_minor": 500,
        },
        format="json",
    )
    assert res_dup.status_code == 400

    # wage > price rejected
    res_bad = api.patch(f"{CATEGORIES}{world['cat'].id}/", {"teacher_wage_minor": 99999}, format="json")
    assert res_bad.status_code == 400

    res = api.patch(f"{CATEGORIES}{world['cat'].id}/", {"student_price_minor": 6500, "is_active": False}, format="json")
    assert res.status_code == 200
    world["cat"].refresh_from_db()
    assert world["cat"].student_price_minor == 6500 and world["cat"].is_active is False


def test_lesson_categories_staff_only(api, world):
    api.force_authenticate(user=world["teacher"].user)
    assert api.get(CATEGORIES).status_code == 403
