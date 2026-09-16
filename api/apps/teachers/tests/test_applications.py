import json

import pytest

from apps.accounts.models import User
from apps.catalog.models import StagePricingRule, StageSubject, Subject, Track, Vertical
from apps.teachers.models import AvailabilityRule, TeacherApplication, TeacherProfile, TeacherStage

pytestmark = pytest.mark.django_db

APPLICATIONS = "/api/teacher-applications/"
CHANGE_PW = "/api/auth/password/change/"


@pytest.fixture
def catalog(market):
    """Primary (no tracks) + Secondary·Science, with stage minimums in EG."""
    primary = Vertical.objects.create(
        code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي"
    )
    secondary = Vertical.objects.create(
        code=Vertical.Code.SECONDARY, name_en="Secondary", name_ar="ثانوي",
        child_kind=Vertical.ChildKind.BRANCH,
    )
    science = Track.objects.create(vertical=secondary, name_en="Science", name_ar="علمي")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    physics = Subject.objects.create(name_en="Physics", name_ar="فيزياء")
    StageSubject.objects.create(vertical=primary, track=None, subject=math)
    StageSubject.objects.create(vertical=secondary, track=science, subject=physics)
    StagePricingRule.objects.create(
        market=market, vertical=primary, min_price_minor=5000, commission_pct=15
    )
    return {
        "market": market, "stage": primary, "secondary": secondary, "science": science,
        "subject": math, "physics": physics,
    }


def _card(catalog, **overrides):
    card = {
        "vertical": catalog["stage"].id,
        "track": None,
        "subjects": [catalog["subject"].id],
        "price_minor": 6000,
        "free_lessons_offered": 1,
        "availability": [{"weekday": 0, "start_time": "09:00", "end_time": "11:00"}],
    }
    card.update(overrides)
    return card


def _payload(catalog, **overrides):
    payload = {
        "full_name": "Mona Adel",
        "phone": "01000000010",
        "email": "mona@example.com",
        "market": "EG",
        "gender": "FEMALE",
        "languages": "ar,en",
        "bio": "Experienced physics teacher.",
        "intro_video_url": "https://youtu.be/abc",
        "stages": [_card(catalog)],
    }
    payload.update(overrides)
    return payload


def _full_payload(catalog, **overrides):
    payload = _payload(
        catalog,
        bio_ar="مدرّسة رياضيات ذات خبرة.",
        specialties=["Algebra", "Geometry"],
        education=[{"degree": "BSc Math", "institution": "Cairo Uni", "start_year": "2010", "end_year": "2014", "description": ""}],
        work_experience=[{"title": "Tutor", "organization": "Self", "start_year": "2015", "end_year": "", "description": "Private lessons"}],
        certifications=[{"name": "TEFL", "issuer": "Board", "year": "2016", "description": ""}],
        stages=[
            _card(catalog),
            _card(
                catalog, vertical=catalog["secondary"].id, track=catalog["science"].id,
                subjects=[catalog["physics"].id], price_minor=9000, free_lessons_offered=0,
                availability=[{"weekday": 5, "start_time": "17:00", "end_time": "19:00"}],
            ),
        ],
    )
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


def _submit(api, catalog, **overrides):
    return api.post(APPLICATIONS, _payload(catalog, **overrides), format="json")


# --- Submission ------------------------------------------------------------

def test_submit_application_public(api, catalog):
    res = _submit(api, catalog)
    assert res.status_code == 201, res.data
    assert res.data["status"] == "PENDING"
    assert res.data["phone"] == "+201000000010"  # normalized


def test_duplicate_application_blocked(api, catalog):
    _submit(api, catalog)
    res = _submit(api, catalog)
    assert res.status_code == 400 and res.data["error"]["code"] == "duplicate_application"


@pytest.mark.parametrize(
    "field", ["full_name", "phone", "email", "market", "gender", "languages", "intro_video_url"]
)
def test_submit_requires_core_fields(api, catalog, field):
    missing = _submit(api, catalog, **{field: ""})
    assert missing.status_code == 400
    assert field in missing.data["error"]["detail"]

    payload = _payload(catalog)
    del payload[field]
    absent = api.post(APPLICATIONS, payload, format="json")
    assert absent.status_code == 400
    assert not TeacherApplication.objects.exists()


def test_submit_rejects_bad_language_codes(api, catalog):
    assert _submit(api, catalog, languages=" , ").status_code == 400
    assert _submit(api, catalog, languages="ar,English").status_code == 400
    res = _submit(api, catalog, languages="AR, en, ar")
    assert res.status_code == 201
    assert TeacherApplication.objects.get().languages == "ar,en"


def test_submit_requires_a_stage(api, catalog):
    res = _submit(api, catalog, stages=[])
    assert res.status_code == 400 and "stages" in res.data["error"]["detail"]


def test_submit_rejects_stage_price_below_minimum(api, catalog):
    res = _submit(api, catalog, stages=[_card(catalog, price_minor=4000)])
    assert res.status_code == 400 and "stages" in res.data["error"]["detail"]


def test_submit_rejects_subject_not_in_stage(api, catalog):
    res = _submit(api, catalog, stages=[_card(catalog, subjects=[catalog["physics"].id])])
    assert res.status_code == 400


def test_submit_rejects_duplicate_stage(api, catalog):
    res = _submit(api, catalog, stages=[_card(catalog), _card(catalog)])
    assert res.status_code == 400


def test_submit_requires_track_for_grouped_stage(api, catalog):
    res = _submit(
        api, catalog,
        stages=[_card(catalog, vertical=catalog["secondary"].id, subjects=[catalog["physics"].id])],
    )
    assert res.status_code == 400


def test_submit_full_profile_application(api, catalog):
    res = api.post(APPLICATIONS, _full_payload(catalog), format="json")
    assert res.status_code == 201, res.data
    assert res.data["status"] == "PENDING"

    app = TeacherApplication.objects.get(id=res.data["id"])
    assert app.gender == "FEMALE"
    assert app.languages == "ar,en"
    assert app.specialties == ["Algebra", "Geometry"]
    assert len(app.stages) == 2
    assert app.stages[0] == {
        "vertical": catalog["stage"].id, "track": None, "subjects": [catalog["subject"].id],
        "price_minor": 6000, "free_lessons_offered": 1,
        "availability": [{"weekday": 0, "start_time": "09:00", "end_time": "11:00"}],
    }


def _png_bytes():
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (2, 2), "blue").save(buf, format="PNG")
    return buf.getvalue()


def test_submit_multipart_with_photo(api, catalog):
    from django.core.files.uploadedfile import SimpleUploadedFile

    payload = _full_payload(catalog)
    data = {
        **{k: payload[k] for k in ("full_name", "phone", "email", "market", "gender",
                                   "languages", "bio", "bio_ar", "intro_video_url")},
        "specialties": json.dumps(payload["specialties"]),
        "education": json.dumps(payload["education"]),
        "work_experience": json.dumps(payload["work_experience"]),
        "certifications": json.dumps(payload["certifications"]),
        "stages": json.dumps(payload["stages"]),
        "photo": SimpleUploadedFile("p.png", _png_bytes(), content_type="image/png"),
    }
    res = api.post(APPLICATIONS, data, format="multipart")
    assert res.status_code == 201, res.data

    app = TeacherApplication.objects.get(id=res.data["id"])
    assert len(app.stages) == 2
    assert bool(app.photo)
    assert res.data["photo"].startswith("http")  # absolute URL for the review drawer


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
    assert profile.intro_video_url == "https://youtu.be/abc"
    assert profile.specialties == ["Algebra", "Geometry"]
    assert len(profile.education) == 1 and profile.education[0]["degree"] == "BSc Math"

    primary = TeacherStage.objects.get(teacher=profile, vertical=catalog["stage"])
    assert primary.track is None and primary.price_minor == 6000 and primary.free_lessons_offered == 1
    assert list(primary.subjects.values_list("subject_id", flat=True)) == [catalog["subject"].id]
    assert list(primary.availability.values_list("weekday", flat=True)) == [0]

    science = TeacherStage.objects.get(teacher=profile, vertical=catalog["secondary"])
    assert science.track == catalog["science"] and science.price_minor == 9000
    assert AvailabilityRule.objects.filter(teacher=profile).count() == 2


def test_review_queue_exposes_all_submitted_data(api, catalog, staff):
    api.post(APPLICATIONS, _full_payload(catalog), format="json")
    api.force_authenticate(user=staff)

    row = api.get(APPLICATIONS).data["results"][0]
    for key in ("full_name", "phone", "email", "market", "currency", "gender", "bio", "bio_ar",
                "intro_video_url", "photo", "document", "specialties", "education",
                "work_experience", "certifications", "created_at"):
        assert key in row
    assert row["languages"] == ["ar", "en"]
    assert row["email"] == "mona@example.com" and row["gender"] == "FEMALE"
    first, second = row["stages_display"]
    assert first["stage"]["name_ar"] == "ابتدائي" and first["track"] is None
    assert first["subjects"] == [{"id": catalog["subject"].id, "name_en": "Mathematics", "name_ar": "رياضيات"}]
    assert first["price"]["display"] == "60.00 EGP" and first["free_lessons_offered"] == 1
    assert first["availability"] == [{"weekday": 0, "start_time": "09:00", "end_time": "11:00"}]
    assert second["track"]["name_en"] == "Science"


# --- Review queue permissions ---------------------------------------------

def test_list_requires_staff(api, catalog, staff, student):
    _submit(api, catalog)

    assert api.get(APPLICATIONS).status_code in (401, 403)  # anonymous

    api.force_authenticate(user=student)
    assert api.get(APPLICATIONS).status_code == 403
    api.force_authenticate(user=None)

    api.force_authenticate(user=staff)
    res = api.get(APPLICATIONS)
    assert res.status_code == 200 and res.data["count"] == 1


# --- Approve / reject ------------------------------------------------------

def test_approve_creates_teacher_with_temp_password(api, catalog, staff):
    app_id = _submit(api, catalog).data["id"]
    api.force_authenticate(user=staff)

    res = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert res.status_code == 200
    assert res.data["application"]["status"] == "APPROVED"

    user = User.objects.get(phone="+201000000010")
    assert user.role == User.Role.TEACHER
    assert user.is_verified is True
    assert user.must_change_password is True
    assert user.email == "mona@example.com"
    profile = TeacherProfile.objects.get(user=user)
    assert profile.is_published is False
    assert profile.bio_en == "Experienced physics teacher."

    application = TeacherApplication.objects.get(id=app_id)
    assert application.created_profile_id == profile.id
    assert application.reviewed_by_id == staff.id

    # Re-approving a reviewed application is rejected.
    again = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert again.status_code == 400 and again.data["error"]["code"] == "application_not_pending"


def test_approve_conflicts_with_existing_account(api, catalog, staff):
    app_id = _submit(api, catalog).data["id"]
    # Someone already registered with that phone.
    User.objects.create_user(phone="+201000000010", role=User.Role.STUDENT)
    api.force_authenticate(user=staff)

    res = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "phone_taken"


def test_reject_application(api, catalog, staff):
    app_id = _submit(api, catalog).data["id"]
    api.force_authenticate(user=staff)

    res = api.post(
        f"{APPLICATIONS}{app_id}/reject/", {"notes": "Insufficient credentials."}, format="json"
    )
    assert res.status_code == 200 and res.data["status"] == "REJECTED"
    assert TeacherApplication.objects.get(id=app_id).review_notes == "Insufficient credentials."


def test_non_staff_cannot_approve(api, catalog, student):
    app_id = _submit(api, catalog).data["id"]
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


# --- Email OTP channel (OTP_CHANNEL=email) -----------------------------------

def test_email_mode_emails_temp_password(api, catalog, staff, settings, mailoutbox):
    settings.OTP_CHANNEL = "email"
    app_id = _submit(api, catalog).data["id"]
    api.force_authenticate(user=staff)

    res = api.post(f"{APPLICATIONS}{app_id}/approve/", format="json")
    assert res.status_code == 200
    assert len(mailoutbox) == 1 and mailoutbox[0].to == ["mona@example.com"]
    assert "Temporary password" in mailoutbox[0].body


def test_email_mode_approve_legacy_application_without_email_rejected(api, catalog, staff, settings):
    # Applications submitted before email became mandatory may lack one.
    application = TeacherApplication.objects.create(
        full_name="Old Applicant", phone="+201000000010", market=catalog["market"],
    )
    settings.OTP_CHANNEL = "email"
    api.force_authenticate(user=staff)

    res = api.post(f"{APPLICATIONS}{application.id}/approve/", format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "application_email_missing"
    assert not User.objects.filter(phone="+201000000010").exists()
