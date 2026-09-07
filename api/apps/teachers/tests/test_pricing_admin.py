import pytest

from apps.accounts.models import User
from apps.catalog.models import GradeLevel, LessonCategory, StagePricingRule, Subject, Vertical
from apps.markets.models import Market
from apps.teachers.models import TeacherProfile, TeacherStagePrice, TeacherSubject

pytestmark = pytest.mark.django_db

CATEGORIES = "/api/admin/lesson-categories/"
STAGE_PRICES = "/api/teacher/stage-prices/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    science = Subject.objects.create(name_en="Science", name_ar="علوم")
    cat = LessonCategory.objects.create(market=eg, vertical=primary, grade_level=g4, subject=math)
    StagePricingRule.objects.create(market=eg, vertical=primary, min_price_minor=5000, commission_pct=15)
    tuser = User.objects.create_user(
        phone="+201000000900", full_name="Price Teacher", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True)
    TeacherSubject.objects.create(teacher=teacher, lesson_category=cat)
    staff = User.objects.create_user(phone="+201000000901", role=User.Role.MODERATOR, is_verified=True)
    return {
        "eg": eg, "primary": primary, "g4": g4, "math": math, "science": science,
        "cat": cat, "teacher": teacher, "tuser": tuser, "staff": staff,
    }


# --- Teacher stage price honors the moderator minimum ----------------------

def test_stage_price_below_minimum_rejected(api, world):
    api.force_authenticate(user=world["tuser"])
    res = api.post(
        STAGE_PRICES, {"vertical": world["primary"].id, "price_minor": 4000}, format="json"
    )
    assert res.status_code == 400
    assert not TeacherStagePrice.objects.filter(teacher=world["teacher"]).exists()


def test_stage_price_at_minimum_accepted(api, world):
    api.force_authenticate(user=world["tuser"])
    res = api.post(
        STAGE_PRICES, {"vertical": world["primary"].id, "price_minor": 5000}, format="json"
    )
    assert res.status_code == 201
    sp = TeacherStagePrice.objects.get(teacher=world["teacher"], vertical=world["primary"])
    assert sp.price_minor == 5000
    # The response echoes the stage minimum for the UI.
    assert res.data["min_price_minor"] == 5000


# --- Lesson-category admin is taxonomy only now -----------------------------

def test_lesson_category_crud(api, world):
    api.force_authenticate(user=world["staff"])
    res = api.get(f"{CATEGORIES}?market=EG")
    assert res.status_code == 200 and res.data["count"] == 1
    assert "student_price_minor" not in res.data["results"][0]

    res = api.post(
        CATEGORIES,
        {"market": "EG", "vertical": world["primary"].id,
         "grade_level": world["g4"].id, "subject": world["science"].id},
        format="json",
    )
    assert res.status_code == 201

    # Duplicate taxonomy key rejected cleanly.
    dup = api.post(
        CATEGORIES,
        {"market": "EG", "vertical": world["primary"].id,
         "grade_level": world["g4"].id, "subject": world["science"].id},
        format="json",
    )
    assert dup.status_code == 400

    res = api.patch(f"{CATEGORIES}{world['cat'].id}/", {"is_active": False}, format="json")
    assert res.status_code == 200
    world["cat"].refresh_from_db()
    assert world["cat"].is_active is False


def test_lesson_categories_staff_only(api, world):
    api.force_authenticate(user=world["tuser"])
    assert api.get(CATEGORIES).status_code == 403
