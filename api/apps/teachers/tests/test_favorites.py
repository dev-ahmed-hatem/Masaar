import pytest

from apps.accounts.models import User
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.teachers.models import FavoriteTeacher, TeacherProfile, TeacherSubject

pytestmark = pytest.mark.django_db
FAV = "/api/favorites/"


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
        phone="+201000000300", role=User.Role.TEACHER, market=eg, is_verified=True, full_name="T"
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True)
    TeacherSubject.objects.create(teacher=teacher, lesson_category=cat)
    student = User.objects.create_user(
        phone="+201000000301", role=User.Role.STUDENT, market=eg, is_verified=True, full_name="S"
    )
    return {"teacher": teacher, "student": student}


def test_favorite_add_list_dedupe_remove(api, setup):
    api.force_authenticate(user=setup["student"])
    tid = setup["teacher"].id

    assert api.post(FAV, {"teacher": tid}, format="json").status_code == 201
    assert api.post(FAV, {"teacher": tid}, format="json").status_code == 201  # idempotent
    assert FavoriteTeacher.objects.filter(student=setup["student"]).count() == 1

    lst = api.get(FAV)
    assert lst.status_code == 200 and len(lst.data) == 1
    assert lst.data[0]["id"] == tid and lst.data[0]["from_price"]["amount_minor"] == 6000

    assert api.delete(f"{FAV}{tid}/").status_code == 204
    assert api.get(FAV).data == []


def test_favorites_requires_student(api, setup):
    api.force_authenticate(user=setup["teacher"].user)
    assert api.get(FAV).status_code == 403
