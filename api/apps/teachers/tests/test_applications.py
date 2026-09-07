import pytest

from apps.accounts.models import User
from apps.catalog.models import (
    GradeLevel,
    LessonCategory,
    StageSubject,
    Subject,
    Vertical,
)
from apps.teachers.models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherProfile,
    TeacherSpecialization,
    TeacherSubject,
)

pytestmark = pytest.mark.django_db

APPLICATIONS = "/api/teacher-applications/"
CHANGE_PW = "/api/auth/password/change/"


@pytest.fixture
def catalog(market):
    """Minimal catalog + a lesson category in the EG market for teaching setup."""
    primary = Vertical.objects.create(
        code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي"
    )
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    StageSubject.objects.create(vertical=primary, track=None, subject=math)
    category = LessonCategory.objects.create(
        market=market, vertical=primary, grade_level=g4, subject=math,
        student_price_minor=6000, teacher_wage_minor=3000, currency="EGP",
    )
    return {"stage": primary, "subject": math, "category": category}


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


# --- Full-profile submission + materialization -----------------------------

def _full_payload(catalog, **overrides):
    payload = _application_payload(
        gender="FEMALE",
        languages="ar,en",
        bio_ar="مدرّسة رياضيات ذات خبرة.",
        free_lessons_offered=1,
        specialties=["Algebra", "Geometry"],
        education=[{"degree": "BSc Math", "institution": "Cairo Uni", "start_year": "2010", "end_year": "2014", "description": ""}],
        work_experience=[{"title": "Tutor", "organization": "Self", "start_year": "2015", "end_year": "", "description": "Private lessons"}],
        certifications=[{"name": "TEFL", "issuer": "Board", "year": "2016", "description": ""}],
        subjects=[catalog["category"].id],
        specializations=[{"vertical": catalog["stage"].id, "track": None, "subject": catalog["subject"].id}],
        availability=[{"weekday": 0, "start_time": "09:00", "end_time": "11:00"}],
    )
    payload.update(overrides)
    return payload


def test_submit_full_profile_application(api, catalog):
    res = api.post(APPLICATIONS, _full_payload(catalog), format="json")
    assert res.status_code == 201, res.data
    assert res.data["status"] == "PENDING"

    app = TeacherApplication.objects.get(id=res.data["id"])
    assert app.gender == "FEMALE"
    assert app.languages == "ar,en"
    assert app.specialties == ["Algebra", "Geometry"]
    assert app.subjects == [catalog["category"].id]
    assert app.specializations == [
        {"vertical": catalog["stage"].id, "track": None, "subject": catalog["subject"].id}
    ]
    assert app.availability == [{"weekday": 0, "start_time": "09:00", "end_time": "11:00"}]


def _png_bytes():
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (2, 2), "blue").save(buf, format="PNG")
    return buf.getvalue()


def test_submit_multipart_with_photo(api, catalog):
    import json

    from django.core.files.uploadedfile import SimpleUploadedFile

    payload = _full_payload(catalog)
    data = {
        "full_name": payload["full_name"],
        "phone": payload["phone"],
        "email": payload["email"],
        "market": "EG",
        "bio": payload["bio"],
        "bio_ar": payload["bio_ar"],
        "gender": "FEMALE",
        "languages": "ar,en",
        "free_lessons_offered": 1,
        "specialties": json.dumps(payload["specialties"]),
        "education": json.dumps(payload["education"]),
        "work_experience": json.dumps(payload["work_experience"]),
        "certifications": json.dumps(payload["certifications"]),
        "subjects": json.dumps(payload["subjects"]),
        "specializations": json.dumps(payload["specializations"]),
        "availability": json.dumps(payload["availability"]),
        "photo": SimpleUploadedFile("p.png", _png_bytes(), content_type="image/png"),
    }
    res = api.post(APPLICATIONS, data, format="multipart")
    assert res.status_code == 201, res.data

    app = TeacherApplication.objects.get(id=res.data["id"])
    assert app.subjects == payload["subjects"]
    assert app.specializations == payload["specializations"]
    assert app.availability == payload["availability"]
    assert bool(app.photo)


def test_submit_rejects_subject_from_other_market(api, catalog):
    payload = _full_payload(catalog, subjects=[999999])
    res = api.post(APPLICATIONS, payload, format="json")
    assert res.status_code == 400 and "subjects" in str(res.data)


def test_submit_rejects_specialization_not_in_catalog(api, catalog):
    payload = _full_payload(
        catalog,
        specializations=[{"vertical": catalog["stage"].id, "track": None, "subject": 999999}],
    )
    res = api.post(APPLICATIONS, payload, format="json")
    assert res.status_code == 400


def test_approve_materializes_full_profile(api, catalog, staff):
    app_id = api.post(APPLICATIONS, _full_payload(catalog), format="json").data["id"]
    api.force_authenticate(user=staff)

    res = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert res.status_code == 200

    profile = TeacherProfile.objects.get(user__phone="+201000000010")
    assert profile.gender == "FEMALE"
    assert profile.languages == "ar,en"
    assert profile.bio_en == "Experienced physics teacher."
    assert profile.bio_ar == "مدرّسة رياضيات ذات خبرة."
    assert profile.free_lessons_offered == 1
    assert profile.specialties == ["Algebra", "Geometry"]
    assert len(profile.education) == 1 and profile.education[0]["degree"] == "BSc Math"
    assert TeacherSubject.objects.filter(
        teacher=profile, lesson_category=catalog["category"]
    ).exists()
    assert TeacherSpecialization.objects.filter(
        teacher=profile, vertical=catalog["stage"], track=None, subject=catalog["subject"]
    ).exists()
    assert AvailabilityRule.objects.filter(teacher=profile, weekday=0).exists()


def test_review_queue_exposes_display_labels(api, catalog, staff):
    api.post(APPLICATIONS, _full_payload(catalog), format="json")
    api.force_authenticate(user=staff)

    row = api.get(APPLICATIONS).data["results"][0]
    assert row["subjects_display"] == ["Primary · Grade 4 · Mathematics"]
    assert row["specializations_display"] == ["Primary · Mathematics"]
    assert row["availability_display"] == ["Monday 09:00–11:00"]


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
