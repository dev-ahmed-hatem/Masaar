import pytest

from apps.accounts.models import User
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.teachers.models import TeacherPrice, TeacherProfile, TeacherSubject

pytestmark = pytest.mark.django_db

PROFILE = "/api/teacher/profile/"
PUBLISH = "/api/teacher/profile/publish/"
UNPUBLISH = "/api/teacher/profile/unpublish/"
CATEGORIES = "/api/teacher/lesson-categories/"
SUBJECTS = "/api/teacher/subjects/"
AVAILABILITY = "/api/teacher/availability/"
PRICES = "/api/teacher/prices/"
DISCOVERY = "/api/teachers/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="Africa/Cairo")
    sa = Market.objects.create(code="SA", name="Saudi Arabia", currency="SAR", timezone="Asia/Riyadh")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    physics = Subject.objects.create(name_en="Physics", name_ar="فيزياء")

    def category(market, subject, price, currency):
        return LessonCategory.objects.create(
            market=market, vertical=primary, grade_level=g4, subject=subject,
            student_price_minor=price, teacher_wage_minor=price // 2, currency=currency,
        )

    eg_math = category(eg, math, 6000, "EGP")
    eg_physics = category(eg, physics, 8000, "EGP")
    sa_math = category(sa, math, 4000, "SAR")

    user = User.objects.create_user(
        phone="+201000000050", full_name="Ali Teacher", role=User.Role.TEACHER,
        market=eg, is_verified=True,
    )
    profile = TeacherProfile.objects.create(user=user, market=eg, is_published=False)
    return {
        "eg": eg, "sa": sa, "user": user, "profile": profile,
        "eg_math": eg_math, "eg_physics": eg_physics, "sa_math": sa_math,
    }


@pytest.fixture
def teacher_api(api, world):
    api.force_authenticate(user=world["user"])
    return api


# --- Profile ---------------------------------------------------------------

def test_get_own_profile(teacher_api, world):
    res = teacher_api.get(PROFILE)
    assert res.status_code == 200
    assert res.data["market"] == "EG" and res.data["is_published"] is False


def test_patch_profile_updates_name_and_bio(teacher_api, world):
    res = teacher_api.patch(
        PROFILE,
        {"full_name": "Ali Hassan", "bio_en": "10 years teaching.", "gender": "MALE", "languages": "ar,en"},
        format="json",
    )
    assert res.status_code == 200
    world["user"].refresh_from_db()
    world["profile"].refresh_from_db()
    assert world["user"].full_name == "Ali Hassan"
    assert world["profile"].bio_en == "10 years teaching."


def test_profile_requires_teacher_role(api, world):
    student = User.objects.create_user(phone="+201000000051", role=User.Role.STUDENT)
    api.force_authenticate(user=student)
    assert api.get(PROFILE).status_code == 403


# --- Subjects --------------------------------------------------------------

def test_lesson_categories_scoped_to_market(teacher_api, world):
    res = teacher_api.get(CATEGORIES)
    assert res.status_code == 200
    # EG has 2 categories; SA one is excluded.
    assert {c["id"] for c in res.data} == {world["eg_math"].id, world["eg_physics"].id}


def test_add_list_and_delete_subject(teacher_api, world):
    res = teacher_api.post(SUBJECTS, {"lesson_category": world["eg_math"].id}, format="json")
    assert res.status_code == 201
    assert res.data["effective_price"]["amount_minor"] == 6000

    listed = teacher_api.get(SUBJECTS)
    assert len(listed.data) == 1
    subject_id = listed.data[0]["id"]

    # Duplicate rejected.
    dup = teacher_api.post(SUBJECTS, {"lesson_category": world["eg_math"].id}, format="json")
    assert dup.status_code == 400

    assert teacher_api.delete(f"{SUBJECTS}{subject_id}/").status_code == 204
    assert teacher_api.get(SUBJECTS).data == []


def test_cannot_add_subject_from_other_market(teacher_api, world):
    res = teacher_api.post(SUBJECTS, {"lesson_category": world["sa_math"].id}, format="json")
    assert res.status_code == 400


# --- Availability ----------------------------------------------------------

def test_availability_crud(teacher_api, world):
    res = teacher_api.post(
        AVAILABILITY, {"weekday": 0, "start_time": "10:00", "end_time": "12:00"}, format="json"
    )
    assert res.status_code == 201
    rule_id = res.data["id"]

    bad = teacher_api.post(
        AVAILABILITY, {"weekday": 1, "start_time": "12:00", "end_time": "11:00"}, format="json"
    )
    assert bad.status_code == 400

    assert len(teacher_api.get(AVAILABILITY).data) == 1
    assert teacher_api.delete(f"{AVAILABILITY}{rule_id}/").status_code == 204


# --- Custom price requests -------------------------------------------------

def test_price_request_is_unapproved_and_resets_on_change(teacher_api, world):
    res = teacher_api.post(
        PRICES, {"lesson_category": world["eg_math"].id, "custom_student_price_minor": 5000}, format="json"
    )
    assert res.status_code == 201 and res.data["is_approved"] is False

    # Simulate moderator approval, then a changed request resets approval.
    TeacherPrice.objects.filter(teacher=world["profile"]).update(is_approved=True)
    res2 = teacher_api.post(
        PRICES, {"lesson_category": world["eg_math"].id, "custom_student_price_minor": 4800}, format="json"
    )
    assert res2.status_code == 201 and res2.data["is_approved"] is False
    price = TeacherPrice.objects.get(teacher=world["profile"], lesson_category=world["eg_math"])
    assert price.custom_student_price_minor == 4800


# --- Publish flow ----------------------------------------------------------

def test_publish_requires_subject_and_bio(teacher_api, world):
    res = teacher_api.post(PUBLISH, format="json")
    assert res.status_code == 400
    assert res.data["error"]["code"] == "profile_incomplete"
    assert set(res.data["error"]["detail"]["missing"]) == {"subject", "bio"}


def test_publish_then_visible_in_discovery(teacher_api, world):
    teacher_api.post(SUBJECTS, {"lesson_category": world["eg_math"].id}, format="json")
    teacher_api.patch(PROFILE, {"bio_en": "Ready to teach."}, format="json")

    res = teacher_api.post(PUBLISH, format="json")
    assert res.status_code == 200 and res.data["is_published"] is True

    world["profile"].refresh_from_db()
    assert world["profile"].is_published is True

    # Now discoverable in the EG market.
    found = teacher_api.get(DISCOVERY, {"market": "EG"})
    assert any(r["full_name"] == "Ali Teacher" for r in found.data["results"])

    # Unpublish removes them again.
    assert teacher_api.post(UNPUBLISH, format="json").data["is_published"] is False
