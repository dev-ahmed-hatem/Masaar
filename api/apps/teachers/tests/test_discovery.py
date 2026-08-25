import pytest

from apps.accounts.models import User
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.teachers.models import (
    AvailabilityRule,
    TeacherPrice,
    TeacherProfile,
    TeacherSpecialization,
    TeacherSubject,
)

pytestmark = pytest.mark.django_db

TEACHERS = "/api/teachers/"
VERTICALS = "/api/catalog/verticals/"
SUBJECTS = "/api/catalog/subjects/"
GRADES = "/api/catalog/grade-levels/"


@pytest.fixture
def world():
    """A small two-market catalog with three EG teachers and one SA teacher."""
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="Africa/Cairo")
    sa = Market.objects.create(code="SA", name="Saudi Arabia", currency="SAR", timezone="Asia/Riyadh")

    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    physics = Subject.objects.create(name_en="Physics", name_ar="فيزياء")

    def category(market, subject, price, wage, currency):
        return LessonCategory.objects.create(
            market=market, vertical=primary, grade_level=g4, subject=subject,
            student_price_minor=price, teacher_wage_minor=wage, currency=currency,
        )

    eg_math = category(eg, math, 6000, 3500, "EGP")
    eg_physics = category(eg, physics, 8000, 5000, "EGP")
    sa_math = category(sa, math, 4000, 2500, "SAR")

    def teacher(phone, market, name, rating, published=True):
        user = User.objects.create_user(
            phone=phone, password="x", full_name=name, role=User.Role.TEACHER, market=market
        )
        return TeacherProfile.objects.create(
            user=user, market=market, gender=TeacherProfile.Gender.MALE,
            languages="ar,en", rating_avg=rating, rating_count=2, lessons_count=10,
            is_published=published,
        )

    # Mirror offerings into specialization tags (as the backfill migration does),
    # since discovery's subject/stage filters run off specializations.
    def specialize(t, subject):
        TeacherSpecialization.objects.create(teacher=t, vertical=primary, track=None, subject=subject)

    # T1: Math (6000) + Physics (8000) -> from 6000
    t1 = teacher("+201000000001", eg, "Ahmed Ali", 4.5)
    TeacherSubject.objects.create(teacher=t1, lesson_category=eg_math)
    TeacherSubject.objects.create(teacher=t1, lesson_category=eg_physics)
    specialize(t1, math)
    specialize(t1, physics)

    # T2: Math with an APPROVED override to 5000 -> from 5000
    t2 = teacher("+201000000002", eg, "Sara Nabil", 4.0)
    TeacherSubject.objects.create(teacher=t2, lesson_category=eg_math)
    specialize(t2, math)
    TeacherPrice.objects.create(
        teacher=t2, lesson_category=eg_math, custom_student_price_minor=5000, is_approved=True
    )
    AvailabilityRule.objects.create(
        teacher=t2, weekday=AvailabilityRule.Weekday.MON, start_time="10:00", end_time="12:00"
    )

    # T3: EG but unpublished -> excluded
    t3 = teacher("+201000000003", eg, "Hidden Teacher", 5.0, published=False)
    TeacherSubject.objects.create(teacher=t3, lesson_category=eg_math)

    # T4: SA teacher -> outside the EG market scope
    t4 = teacher("+966500000004", sa, "Riyadh Teacher", 4.8)
    TeacherSubject.objects.create(teacher=t4, lesson_category=sa_math)

    return {
        "eg": eg, "sa": sa, "math": math, "physics": physics, "g4": g4, "primary": primary,
        "t1": t1, "t2": t2, "t3": t3, "t4": t4, "eg_math": eg_math,
    }


# --- Catalog ---------------------------------------------------------------

def test_catalog_endpoints(api, world):
    assert {v["code"] for v in api.get(VERTICALS).data} == {"PRIMARY"}

    subjects = api.get(SUBJECTS).data
    assert {s["name_en"] for s in subjects} == {"Mathematics", "Physics"}

    grades = api.get(GRADES, {"vertical": world["primary"].id}).data
    assert [g["name_en"] for g in grades] == ["Grade 4"]


# --- Teacher discovery -----------------------------------------------------

def test_list_scoped_to_market(api, world):
    res = api.get(TEACHERS, {"market": "EG"})
    assert res.status_code == 200
    # Only published EG teachers (T1, T2) — not unpublished T3, not SA T4.
    assert res.data["count"] == 2
    names = {row["full_name"] for row in res.data["results"]}
    assert names == {"Ahmed Ali", "Sara Nabil"}


def test_market_required_when_absent_and_anonymous(api, world):
    res = api.get(TEACHERS)
    assert res.status_code == 400 and res.data["error"]["code"] == "market_required"


def test_unknown_market(api, world):
    res = api.get(TEACHERS, {"market": "ZZ"})
    assert res.status_code == 400 and res.data["error"]["code"] == "unknown_market"


def test_filter_by_subject(api, world):
    res = api.get(TEACHERS, {"market": "EG", "subject": world["physics"].id})
    assert res.data["count"] == 1
    assert res.data["results"][0]["full_name"] == "Ahmed Ali"


def test_from_price_reflects_override_and_ordering(api, world):
    res = api.get(TEACHERS, {"market": "EG", "ordering": "from_price_minor"})
    rows = res.data["results"]
    # Cheapest first: T2's approved override (5000) beats T1's default (6000).
    assert rows[0]["full_name"] == "Sara Nabil"
    assert rows[0]["from_price"]["amount_minor"] == 5000
    assert rows[0]["from_price"]["display"] == "50.00 EGP"
    assert rows[1]["from_price"]["amount_minor"] == 6000


def test_price_range_filter(api, world):
    res = api.get(TEACHERS, {"market": "EG", "price_max": 5500})
    assert res.data["count"] == 1
    assert res.data["results"][0]["full_name"] == "Sara Nabil"


def test_detail_resolves_price_override(api, world):
    res = api.get(f"{TEACHERS}{world['t2'].id}/")
    assert res.status_code == 200
    offering = next(o for o in res.data["offerings"] if o["subject"] == "Mathematics")
    assert offering["is_custom_price"] is True
    assert offering["price"]["amount_minor"] == 5000
    assert res.data["reviews_summary"]["rating_count"] == 2
    assert len(res.data["availability"]) == 1


def test_detail_falls_back_to_category_default(api, world):
    res = api.get(f"{TEACHERS}{world['t1'].id}/")
    math_offering = next(o for o in res.data["offerings"] if o["subject"] == "Mathematics")
    assert math_offering["is_custom_price"] is False
    assert math_offering["price"]["amount_minor"] == 6000


def test_unpublished_teacher_detail_404(api, world):
    assert api.get(f"{TEACHERS}{world['t3'].id}/").status_code == 404


def test_detail_includes_resume_fields(api, world):
    t1 = world["t1"]
    t1.specialties = ["IELTS", "Conversation"]
    t1.education = [{"degree": "BSc Math", "institution": "Cairo Uni",
                     "start_year": "2010", "end_year": "2014", "description": ""}]
    t1.work_experience = [{"title": "Tutor", "organization": "Self",
                           "start_year": "2015", "end_year": "", "description": "Online"}]
    t1.certifications = [{"name": "TEFL", "issuer": "X", "year": "2016", "description": ""}]
    t1.save()

    res = api.get(f"{TEACHERS}{t1.id}/")
    assert res.status_code == 200
    assert res.data["specialties"] == ["IELTS", "Conversation"]
    assert res.data["education"][0]["degree"] == "BSc Math"
    assert res.data["work_experience"][0]["title"] == "Tutor"
    assert res.data["certifications"][0]["name"] == "TEFL"


def test_filter_by_stage(api, world):
    stage_id = world["primary"].id
    res = api.get(TEACHERS, {"market": "EG", "stage": stage_id})
    assert res.status_code == 200
    assert {r["full_name"] for r in res.data["results"]} == {"Ahmed Ali", "Sara Nabil"}


def test_list_exposes_specializations(api, world):
    res = api.get(TEACHERS, {"market": "EG", "subject": world["physics"].id})
    row = next(r for r in res.data["results"] if r["full_name"] == "Ahmed Ali")
    subjects = {s["subject"]["name_en"] for s in row["specializations"]}
    assert {"Mathematics", "Physics"} <= subjects
    assert row["specializations"][0]["stage"]["name_en"] == "Primary"


def test_slots_endpoint_public_for_anonymous(api, world):
    # No auth: an anonymous visitor browsing a profile can still see open times.
    res = api.get("/api/bookings/slots/", {"teacher": world["t2"].id})
    assert res.status_code == 200
    assert isinstance(res.data, list)


def test_filter_by_name(api, world):
    # Case-insensitive substring match on the teacher's name, market-scoped.
    res = api.get(TEACHERS, {"market": "EG", "name": "sara"})
    names = {r["full_name"] for r in res.data["results"]}
    assert names == {"Sara Nabil"}

    # Partial substring matches multiple.
    res = api.get(TEACHERS, {"market": "EG", "name": "a"})
    names = {r["full_name"] for r in res.data["results"]}
    assert {"Ahmed Ali", "Sara Nabil"} <= names

    # No match -> empty.
    assert api.get(TEACHERS, {"market": "EG", "name": "zzz"}).data["results"] == []
