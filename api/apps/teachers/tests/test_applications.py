import pytest

from apps.accounts.models import User
from apps.teachers.models import TeacherApplication, TeacherProfile

pytestmark = pytest.mark.django_db

APPLICATIONS = "/api/teacher-applications/"
CHANGE_PW = "/api/auth/password/change/"


def _application_payload(**overrides):
    payload = {
        "full_name": "Mona Adel",
        "phone": "01000000010",
        "email": "mona@example.com",
        "market": "EG",
        "bio": "Experienced physics teacher.",
        "intro_video_url": "https://youtu.be/abc",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def staff(db):
    return User.objects.create_user(
        phone="+201111100000", role=User.Role.MODERATOR, is_verified=True
    )


@pytest.fixture
def student(db):
    return User.objects.create_user(
        phone="+201111100001", role=User.Role.STUDENT, is_verified=True
    )


def _submit(api, market, **overrides):
    return api.post(APPLICATIONS, _application_payload(**overrides), format="json")


# --- Submission ------------------------------------------------------------

def test_submit_application_public(api, market):
    res = _submit(api, market)
    assert res.status_code == 201
    assert res.data["status"] == "PENDING"
    assert res.data["phone"] == "+201000000010"  # normalized


def test_duplicate_application_blocked(api, market):
    _submit(api, market)
    res = _submit(api, market)
    assert res.status_code == 400 and res.data["error"]["code"] == "duplicate_application"


# --- Review queue permissions ---------------------------------------------

def test_list_requires_staff(api, market, staff, student):
    _submit(api, market)

    assert api.get(APPLICATIONS).status_code in (401, 403)  # anonymous

    api.force_authenticate(user=student)
    assert api.get(APPLICATIONS).status_code == 403
    api.force_authenticate(user=None)

    api.force_authenticate(user=staff)
    res = api.get(APPLICATIONS)
    assert res.status_code == 200 and res.data["count"] == 1


# --- Approve / reject ------------------------------------------------------

def test_approve_creates_teacher_with_temp_password(api, market, staff):
    app_id = _submit(api, market).data["id"]
    api.force_authenticate(user=staff)

    res = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert res.status_code == 200
    assert res.data["application"]["status"] == "APPROVED"

    user = User.objects.get(phone="+201000000010")
    assert user.role == User.Role.TEACHER
    assert user.is_verified is True
    assert user.must_change_password is True
    profile = TeacherProfile.objects.get(user=user)
    assert profile.is_published is False
    assert profile.bio_en == "Experienced physics teacher."

    application = TeacherApplication.objects.get(id=app_id)
    assert application.created_profile_id == profile.id
    assert application.reviewed_by_id == staff.id

    # Re-approving a reviewed application is rejected.
    again = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert again.status_code == 400 and again.data["error"]["code"] == "application_not_pending"


def test_approve_conflicts_with_existing_account(api, market, staff):
    app_id = _submit(api, market).data["id"]
    # Someone already registered with that phone.
    User.objects.create_user(phone="+201000000010", role=User.Role.STUDENT)
    api.force_authenticate(user=staff)

    res = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "phone_taken"


def test_reject_application(api, market, staff):
    app_id = _submit(api, market).data["id"]
    api.force_authenticate(user=staff)

    res = api.post(
        f"{APPLICATIONS}{app_id}/reject/", {"notes": "Insufficient credentials."}, format="json"
    )
    assert res.status_code == 200 and res.data["status"] == "REJECTED"
    assert TeacherApplication.objects.get(id=app_id).review_notes == "Insufficient credentials."


def test_non_staff_cannot_approve(api, market, student):
    app_id = _submit(api, market).data["id"]
    api.force_authenticate(user=student)
    assert api.post(f"{APPLICATIONS}{app_id}/approve/", format="json").status_code == 403


# --- Forced password change ------------------------------------------------

def test_change_password_clears_flag(api, market):
    user = User.objects.create_user(
        phone="+201000000099", password="Temp12345!", role=User.Role.TEACHER,
        is_verified=True, must_change_password=True,
    )
    api.force_authenticate(user=user)
    res = api.post(
        CHANGE_PW, {"old_password": "Temp12345!", "new_password": "Brand-New-99!"}, format="json"
    )
    assert res.status_code == 200
    user.refresh_from_db()
    assert user.must_change_password is False
    assert user.check_password("Brand-New-99!")


def test_change_password_wrong_old_rejected(api, market):
    user = User.objects.create_user(
        phone="+201000000098", password="Temp12345!", role=User.Role.TEACHER, is_verified=True
    )
    api.force_authenticate(user=user)
    res = api.post(
        CHANGE_PW, {"old_password": "wrong", "new_password": "Brand-New-99!"}, format="json"
    )
    assert res.status_code == 400
