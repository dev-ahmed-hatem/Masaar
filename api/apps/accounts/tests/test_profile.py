import pytest

from apps.accounts.models import StudentProfile, User
from apps.catalog.models import GradeLevel, Vertical
from apps.markets.models import Market

pytestmark = pytest.mark.django_db
ME = "/api/auth/me/"
ME_PROFILE = "/api/auth/me/profile/"


@pytest.fixture
def student():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    return User.objects.create_user(
        phone="+201000000400", role=User.Role.STUDENT, market=eg,
        is_verified=True, full_name="Old Name", locale="ar",
    )


def test_patch_me_updates_safe_fields_only(api, student):
    api.force_authenticate(user=student)
    res = api.patch(
        ME,
        {"full_name": "New Name", "locale": "en", "role": "TEACHER", "market": "SA"},
        format="json",
    )
    assert res.status_code == 200
    student.refresh_from_db()
    assert student.full_name == "New Name" and student.locale == "en"
    # role/market are not writable and must be ignored.
    assert student.role == User.Role.STUDENT
    assert student.market.code == "EG"
    assert res.data["full_name"] == "New Name"


def test_student_profile_get_and_patch(api, student):
    v = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g = GradeLevel.objects.create(vertical=v, name_en="Grade 4", name_ar="الصف 4")
    api.force_authenticate(user=student)

    assert api.get(ME_PROFILE).status_code == 200
    res = api.patch(ME_PROFILE, {"grade_level": g.id, "date_of_birth": "2010-05-01"}, format="json")
    assert res.status_code == 200

    prof = StudentProfile.objects.get(user=student)
    assert prof.grade_level_id == g.id and str(prof.date_of_birth) == "2010-05-01"
