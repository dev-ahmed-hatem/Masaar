from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market
from apps.payouts.models import PayoutCycle, PayoutItem
from apps.teachers.models import TeacherProfile

pytestmark = pytest.mark.django_db

DASHBOARD = "/api/teacher/dashboard/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    cat = LessonCategory.objects.create(
        market=eg, vertical=primary, grade_level=g4, subject=math,
        student_price_minor=6000, teacher_wage_minor=3500, currency="EGP",
    )
    tuser = User.objects.create_user(
        phone="+201000000800", full_name="Dash Teacher", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True)
    student = User.objects.create_user(
        phone="+201000000801", full_name="Dash Student", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    return {"eg": eg, "cat": cat, "teacher": teacher, "student": student}


def _booking(world, status, start_delta_h=24, wage_settled=False, payout_item=None):
    return Booking.objects.create(
        student=world["student"], teacher=world["teacher"], lesson_category=world["cat"],
        scheduled_start=timezone.now() + timedelta(hours=start_delta_h), duration_min=60,
        price_minor=6000, teacher_wage_minor=3500, currency="EGP", status=status,
        wage_settled=wage_settled, payout_item=payout_item,
    )


def test_dashboard_aggregates(api, world):
    _booking(world, Booking.Status.REQUESTED, 48)
    nxt = _booking(world, Booking.Status.CONFIRMED, 2)
    _booking(world, Booking.Status.CONFIRMED, 72)
    _booking(world, Booking.Status.COMPLETED, -24, wage_settled=True)

    cycle = PayoutCycle.objects.create(
        market=world["eg"],
        period_start=timezone.now().date() - timedelta(days=30),
        period_end=timezone.now().date(),
        status=PayoutCycle.Status.PAID,
    )
    item = PayoutItem.objects.create(
        cycle=cycle, teacher=world["teacher"], amount_minor=7000, currency="EGP",
        lessons_count=2, status=PayoutItem.Status.PAID,
    )
    _booking(world, Booking.Status.COMPLETED, -48, wage_settled=True, payout_item=item)

    api.force_authenticate(user=world["teacher"].user)
    res = api.get(DASHBOARD)
    assert res.status_code == 200
    data = res.data
    assert data["pending_requests"] == 1
    assert data["upcoming_count"] == 2
    assert data["next_lesson"]["id"] == nxt.id
    assert data["earnings"] == {"pending_minor": 3500, "paid_minor": 7000, "currency": "EGP"}
    assert data["profile"]["is_published"] is True
    assert data["unread_notifications"] == 0
    assert data["unread_messages"] == 0


def test_dashboard_requires_teacher(api, world):
    api.force_authenticate(user=world["student"])
    assert api.get(DASHBOARD).status_code == 403


def _png_bytes():
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


def test_photo_upload_and_delete(api, world, tmp_path, settings):
    from django.core.files.uploadedfile import SimpleUploadedFile

    settings.MEDIA_ROOT = tmp_path
    api.force_authenticate(user=world["teacher"].user)

    up = SimpleUploadedFile("me.png", _png_bytes(), content_type="image/png")
    res = api.post("/api/teacher/profile/photo/", {"photo": up}, format="multipart")
    assert res.status_code == 200
    assert res.data["photo_url"] and "teacher_photos/" in res.data["photo_url"]

    # discovery list carries the photo
    lst = api.get("/api/teachers/?market=EG")
    row = [t for t in lst.data["results"] if t["id"] == world["teacher"].id][0]
    assert row["photo_url"]

    res = api.delete("/api/teacher/profile/photo/")
    assert res.status_code == 200 and res.data["photo_url"] is None


def test_photo_rejects_non_image(api, world, tmp_path, settings):
    from django.core.files.uploadedfile import SimpleUploadedFile

    settings.MEDIA_ROOT = tmp_path
    api.force_authenticate(user=world["teacher"].user)
    up = SimpleUploadedFile("evil.txt", b"not an image", content_type="text/plain")
    assert api.post("/api/teacher/profile/photo/", {"photo": up}, format="multipart").status_code == 400


def test_bookings_date_range_filter(api, world):
    early = _booking(world, Booking.Status.CONFIRMED, 24)
    late = _booking(world, Booking.Status.CONFIRMED, 24 * 10)

    api.force_authenticate(user=world["teacher"].user)
    start = (timezone.now() + timedelta(days=2)).isoformat()
    end = (timezone.now() + timedelta(days=20)).isoformat()
    ids = [
        b["id"]
        for b in api.get("/api/bookings/", {"from": start, "to": end}).data["results"]
    ]
    assert ids == [late.id]
    ids = [b["id"] for b in api.get("/api/bookings/", {"to": start}).data["results"]]
    assert ids == [early.id]
