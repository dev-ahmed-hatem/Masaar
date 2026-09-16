from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import StagePricingRule, StageSubject, Subject, Track, Vertical
from apps.markets.models import Market
from apps.teachers.models import AvailabilityRule, TeacherProfile, TeacherStage
from apps.teachers.tests.factories import booking_lesson

pytestmark = pytest.mark.django_db

PROFILE = "/api/teacher/profile/"
PUBLISH = "/api/teacher/profile/publish/"
UNPUBLISH = "/api/teacher/profile/unpublish/"
STAGES = "/api/teacher/stages/"
DISCOVERY = "/api/teachers/"


@pytest.fixture
def world():
    eg = Market.objects.update_or_create(code="EG", defaults={"name": "Egypt", "currency": "EGP", "timezone": "Africa/Cairo"})[0]
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    secondary = Vertical.objects.create(
        code=Vertical.Code.SECONDARY, name_en="Secondary", name_ar="ثانوي",
        child_kind=Vertical.ChildKind.BRANCH,
    )
    science_track = Track.objects.create(vertical=secondary, name_en="Science", name_ar="علمي")
    arts_track = Track.objects.create(vertical=secondary, name_en="Arts", name_ar="أدبي")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    science = Subject.objects.create(name_en="Science", name_ar="علوم")
    physics = Subject.objects.create(name_en="Physics", name_ar="فيزياء")
    StageSubject.objects.create(vertical=primary, subject=math)
    StageSubject.objects.create(vertical=primary, subject=science)
    StageSubject.objects.create(vertical=secondary, track=science_track, subject=physics)
    StagePricingRule.objects.create(
        market=eg, vertical=primary, min_price_minor=1000, commission_pct=15
    )

    user = User.objects.create_user(
        phone="+201000000050", full_name="Ali Teacher", role=User.Role.TEACHER,
        market=eg, is_verified=True,
    )
    profile = TeacherProfile.objects.create(user=user, market=eg, is_published=False)
    return {
        "eg": eg, "primary": primary, "secondary": secondary, "science_track": science_track,
        "user": user, "profile": profile, "math": math, "science": science, "physics": physics,
        "arts": arts_track,
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


def test_patch_profile_persists_resume_fields(teacher_api, world):
    res = teacher_api.patch(
        PROFILE,
        {
            "specialties": ["IELTS", "IELTS", " Business English "],
            "education": [
                {"degree": "BSc", "institution": "Cairo Uni", "extra": "dropped", "description": ""},
                {"degree": "", "institution": "", "start_year": "", "end_year": "", "description": ""},
            ],
        },
        format="json",
    )
    assert res.status_code == 200
    # Duplicates removed, values trimmed.
    assert res.data["specialties"] == ["IELTS", "Business English"]
    # Unknown keys dropped; empty record removed; known keys coerced to strings.
    assert res.data["education"] == [
        {"degree": "BSc", "institution": "Cairo Uni", "start_year": "", "end_year": "", "description": ""}
    ]


def test_patch_profile_rejects_non_list_resume(teacher_api, world):
    res = teacher_api.patch(PROFILE, {"specialties": "IELTS"}, format="json")
    assert res.status_code == 400


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


# --- Stage cards -----------------------------------------------------------

def _card(world, **overrides):
    body = {
        "vertical": world["primary"].id,
        "subjects": [world["math"].id],
        "price_minor": 6000,
        "free_lessons_offered": 1,
        "availability": [{"weekday": 0, "start_time": "10:00", "end_time": "12:00"}],
    }
    body.update(overrides)
    return body


def test_create_and_list_stage_card(teacher_api, world):
    res = teacher_api.post(STAGES, _card(world), format="json")
    assert res.status_code == 201
    assert res.data["stage"]["name_en"] == "Primary" and res.data["track"] is None
    assert [s["name_en"] for s in res.data["subjects"]] == ["Mathematics"]
    assert res.data["price"]["amount_minor"] == 6000 and res.data["min_price_minor"] == 1000
    assert res.data["free_lessons_offered"] == 1
    assert res.data["availability"] == [{"weekday": 0, "start_time": "10:00", "end_time": "12:00"}]
    assert res.data["incomplete"] == []

    listed = teacher_api.get(STAGES)
    assert [c["id"] for c in listed.data] == [res.data["id"]]


def test_duplicate_stage_rejected(teacher_api, world):
    assert teacher_api.post(STAGES, _card(world), format="json").status_code == 201
    dup = teacher_api.post(STAGES, _card(world), format="json")
    assert dup.status_code == 400


def test_track_required_for_grouped_stage(teacher_api, world):
    no_track = teacher_api.post(
        STAGES, _card(world, vertical=world["secondary"].id, subjects=[world["physics"].id]), format="json"
    )
    assert no_track.status_code == 400

    ok = teacher_api.post(
        STAGES,
        _card(world, vertical=world["secondary"].id, track=world["science_track"].id, subjects=[world["physics"].id]),
        format="json",
    )
    assert ok.status_code == 201 and ok.data["track"]["name_en"] == "Science"
    # Same stage, other track is a separate card.
    other = teacher_api.post(
        STAGES,
        _card(world, vertical=world["secondary"].id, track=world["arts"].id, subjects=[world["physics"].id]),
        format="json",
    )
    assert other.status_code == 400  # Physics isn't offered under Arts


def test_subject_must_be_offered_under_stage(teacher_api, world):
    res = teacher_api.post(STAGES, _card(world, subjects=[world["physics"].id]), format="json")
    assert res.status_code == 400


def test_price_below_minimum_rejected(teacher_api, world):
    res = teacher_api.post(STAGES, _card(world, price_minor=500), format="json")
    assert res.status_code == 400


def test_overlapping_windows_rejected(teacher_api, world):
    res = teacher_api.post(
        STAGES,
        _card(world, availability=[
            {"weekday": 0, "start_time": "10:00", "end_time": "12:00"},
            {"weekday": 0, "start_time": "11:00", "end_time": "13:00"},
        ]),
        format="json",
    )
    assert res.status_code == 400


def test_patch_replaces_subjects_and_availability(teacher_api, world):
    card_id = teacher_api.post(STAGES, _card(world), format="json").data["id"]
    res = teacher_api.patch(
        f"{STAGES}{card_id}/",
        {"subjects": [world["math"].id, world["science"].id], "price_minor": 7000,
         "availability": [{"weekday": 3, "start_time": "16:00", "end_time": "18:00"}]},
        format="json",
    )
    assert res.status_code == 200
    assert {s["name_en"] for s in res.data["subjects"]} == {"Mathematics", "Science"}
    assert res.data["price"]["amount_minor"] == 7000
    assert res.data["availability"] == [{"weekday": 3, "start_time": "16:00", "end_time": "18:00"}]
    assert AvailabilityRule.objects.filter(teacher=world["profile"]).count() == 1

    # Stage can't be changed, other fields untouched by a partial update.
    res = teacher_api.patch(f"{STAGES}{card_id}/", {"vertical": world["secondary"].id}, format="json")
    assert res.status_code == 200 and res.data["stage"]["name_en"] == "Primary"


def test_delete_card_blocked_by_active_booking(teacher_api, world):
    card_id = teacher_api.post(STAGES, _card(world), format="json").data["id"]
    card = TeacherStage.objects.get(id=card_id)
    student = User.objects.create_user(phone="+201000000059", role=User.Role.STUDENT, market=world["eg"])
    booking = Booking.objects.create(
        student=student, teacher=world["profile"], **booking_lesson(card, world["math"]),
        scheduled_start=timezone.now() + timedelta(days=2), price_minor=6000,
        teacher_wage_minor=5100, currency="EGP", status=Booking.Status.CONFIRMED,
    )
    res = teacher_api.delete(f"{STAGES}{card_id}/")
    assert res.status_code == 409 and res.data["error"]["code"] == "stage_in_use"

    booking.status = Booking.Status.COMPLETED
    booking.save()
    assert teacher_api.delete(f"{STAGES}{card_id}/").status_code == 204
    booking.refresh_from_db()
    assert booking.teacher_stage_id is None and booking.subject_id == world["math"].id


def test_other_teachers_cards_not_accessible(teacher_api, world):
    other_user = User.objects.create_user(phone="+201000000058", role=User.Role.TEACHER, market=world["eg"])
    other = TeacherProfile.objects.create(user=other_user, market=world["eg"])
    card = TeacherStage.objects.create(teacher=other, vertical=world["primary"], price_minor=6000)
    assert teacher_api.get(f"{STAGES}{card.id}/").status_code == 404


# --- Publish flow ----------------------------------------------------------

def test_publish_requires_bio_and_stage(teacher_api, world):
    res = teacher_api.post(PUBLISH, format="json")
    assert res.status_code == 400
    assert res.data["error"]["code"] == "profile_incomplete"
    assert set(res.data["error"]["detail"]["missing"]) == {"stage", "bio"}


def test_publish_requires_complete_cards(teacher_api, world):
    teacher_api.patch(PROFILE, {"bio_en": "Ready to teach."}, format="json")
    card_id = teacher_api.post(STAGES, _card(world, availability=[]), format="json").data["id"]
    # A moderator raises the minimum above the card's price afterwards.
    StagePricingRule.objects.filter(market=world["eg"], vertical=world["primary"]).update(min_price_minor=8000)

    res = teacher_api.post(PUBLISH, format="json")
    assert res.status_code == 400
    detail = res.data["error"]["detail"]
    assert set(detail["missing"]) == {"price", "availability"}
    assert detail["incomplete_stages"] == [card_id]


def test_publish_then_visible_in_discovery(teacher_api, world):
    teacher_api.patch(PROFILE, {"bio_en": "Ready to teach."}, format="json")
    assert teacher_api.post(STAGES, _card(world), format="json").status_code == 201

    res = teacher_api.post(PUBLISH, format="json")
    assert res.status_code == 200 and res.data["is_published"] is True

    world["profile"].refresh_from_db()
    assert world["profile"].is_published is True

    # Now discoverable in the EG market, with the stage card.
    found = teacher_api.get(DISCOVERY, {"market": "EG"})
    row = next(r for r in found.data["results"] if r["full_name"] == "Ali Teacher")
    assert row["stages"][0]["price"]["amount_minor"] == 6000
    assert row["free_lessons_offered"] == 1

    # Unpublish removes them again.
    assert teacher_api.post(UNPUBLISH, format="json").data["is_published"] is False
