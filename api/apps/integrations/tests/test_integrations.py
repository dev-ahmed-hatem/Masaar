"""Google Calendar integration tests.

Network is never touched: google_calendar._service is replaced with a fake, and
the OAuth exchange is mocked. The best-effort design means callers never see
Google errors, so we assert on the DB side effects (mappings, meeting_link).
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.integrations import google_calendar, oauth
from apps.integrations.models import BookingCalendarEvent, GoogleCredential
from apps.markets.models import Market
from apps.payments import services as wallet
from apps.teachers.models import AvailabilityRule, TeacherProfile, TeacherSubject

pytestmark = pytest.mark.django_db

BOOKINGS = "/api/bookings/"
STATUS = "/api/integrations/google/status/"
CALLBACK = "/api/integrations/google/callback/"

MEET_LINK = "https://meet.google.com/abc-defg-hij"


# --- Fakes -----------------------------------------------------------------

class _Exec:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return self._data


class _Events:
    def __init__(self, log):
        self.log = log

    def insert(self, calendarId, body, **kw):  # noqa: N803 (Google API kwarg)
        self.log.append(("insert", calendarId))
        return _Exec({"id": "evt-1", "htmlLink": "https://cal/evt-1", "hangoutLink": MEET_LINK})

    def patch(self, calendarId, eventId, body, **kw):  # noqa: N803
        self.log.append(("patch", eventId))
        return _Exec({"id": eventId, "htmlLink": "https://cal/evt-1", "hangoutLink": MEET_LINK})

    def delete(self, calendarId, eventId):  # noqa: N803
        self.log.append(("delete", eventId))
        return _Exec({})


class _Service:
    def __init__(self, log):
        self._events = _Events(log)

    def events(self):
        return self._events


@pytest.fixture
def fake_gcal(monkeypatch):
    """Replace the Calendar client with an in-memory fake; return the call log."""
    log = []
    monkeypatch.setattr(google_calendar, "_service", lambda cred: _Service(log))
    return log


@pytest.fixture
def enabled(settings):
    from cryptography.fernet import Fernet

    settings.GOOGLE_CALENDAR_ENABLED = True
    settings.GOOGLE_TOKEN_ENCRYPTION_KEY = Fernet.generate_key().decode()
    return settings


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="Africa/Cairo")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    g4 = GradeLevel.objects.create(vertical=primary, name_en="Grade 4", name_ar="الصف 4")
    math = Subject.objects.create(name_en="Mathematics", name_ar="رياضيات")
    eg_math = LessonCategory.objects.create(
        market=eg, vertical=primary, grade_level=g4, subject=math,
        student_price_minor=6000, teacher_wage_minor=3500, currency="EGP",
    )
    tuser = User.objects.create_user(
        phone="+201000000300", full_name="Teacher T", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True, bio_en="hi")
    TeacherSubject.objects.create(teacher=teacher, lesson_category=eg_math)
    for wd in range(7):
        AvailabilityRule.objects.create(teacher=teacher, weekday=wd, start_time="00:00", end_time="23:59")
    student = User.objects.create_user(
        phone="+201000000301", full_name="Student S", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    wallet.credit(wallet.get_or_create_wallet(student), 100000)
    return {"eg": eg, "teacher": teacher, "tuser": tuser, "student": student, "eg_math": eg_math}


def _slot(delta):
    t = (timezone.now() + delta).replace(minute=0, second=0, microsecond=0)
    return t.replace(hour=22) if t.hour >= 23 else t


def _book(api, world, delta=timedelta(days=3)):
    api.force_authenticate(user=world["student"])
    res = api.post(
        BOOKINGS,
        {"teacher": world["teacher"].id, "lesson_category": world["eg_math"].id,
         "scheduled_start": _slot(delta).isoformat(), "is_trial": False},
        format="json",
    )
    return res.data["id"]


def _connect(user):
    return GoogleCredential.objects.create(user=user, sync_enabled=True, google_email=f"{user.id}@g.com")


# --- Crypto ----------------------------------------------------------------

def test_token_encryption_roundtrip(enabled):
    cred = GoogleCredential(user_id=1)
    cred.access_token = "secret-access"
    cred.refresh_token = "secret-refresh"
    # Stored ciphertext differs from plaintext; properties decrypt back.
    assert cred.access_token_enc and cred.access_token_enc != "secret-access"
    assert cred.access_token == "secret-access"
    assert cred.refresh_token == "secret-refresh"
    # An empty refresh value never clobbers a stored one (Google omits it on re-consent).
    cred.refresh_token = ""
    assert cred.refresh_token == "secret-refresh"


# --- Status + OAuth callback ----------------------------------------------

def test_status_not_connected(api, world):
    api.force_authenticate(user=world["student"])
    res = api.get(STATUS)
    assert res.status_code == 200
    assert res.data == {"connected": False, "google_email": "", "sync_enabled": False}


def test_oauth_callback_stores_credential(api, world, enabled, monkeypatch):
    from django.core import signing

    from apps.integrations.views import STATE_SALT

    class FakeCreds:
        token = "at-123"
        refresh_token = "rt-456"
        expiry = None
        scopes = ["openid", "https://www.googleapis.com/auth/calendar.events"]

    monkeypatch.setattr(oauth, "exchange_code", lambda code, state, redirect_uri=None: FakeCreds())
    monkeypatch.setattr(oauth, "fetch_email", lambda creds: "user@gmail.com")

    api.force_authenticate(user=world["student"])
    state = signing.dumps({"uid": world["student"].id}, salt=STATE_SALT)
    res = api.post(CALLBACK, {"code": "auth-code", "state": state}, format="json")

    assert res.status_code == 200
    assert res.data["connected"] is True and res.data["google_email"] == "user@gmail.com"
    cred = GoogleCredential.objects.get(user=world["student"])
    assert cred.access_token == "at-123" and cred.refresh_token == "rt-456"


def test_oauth_callback_rejects_foreign_state(api, world, enabled):
    from django.core import signing

    from apps.integrations.views import STATE_SALT

    api.force_authenticate(user=world["student"])
    # State minted for a different user id.
    state = signing.dumps({"uid": 999999}, salt=STATE_SALT)
    res = api.post(CALLBACK, {"code": "x", "state": state}, format="json")
    assert res.status_code == 403


# --- Confirm: auto Meet link + dual push ----------------------------------

def test_confirm_meet_autogenerates_and_pushes_both(
    api, world, enabled, fake_gcal, django_capture_on_commit_callbacks
):
    _connect(world["tuser"])
    _connect(world["student"])
    booking_id = _book(api, world)

    api.force_authenticate(user=world["tuser"])
    with django_capture_on_commit_callbacks(execute=True):
        res = api.post(f"{BOOKINGS}{booking_id}/confirm/", {"meeting_provider": "MEET"}, format="json")
    assert res.status_code == 200

    booking = Booking.objects.get(id=booking_id)
    assert booking.status == Booking.Status.CONFIRMED
    assert booking.meeting_link == MEET_LINK
    events = BookingCalendarEvent.objects.filter(booking=booking)
    assert events.count() == 2
    assert all(e.synced_at is not None and e.meet_link == MEET_LINK for e in events)
    # Exactly one conference (insert) minted the Meet link; both sides got an event.
    assert [c[0] for c in fake_gcal].count("insert") == 2


def test_confirm_without_link_requires_connected_teacher(api, world, enabled):
    # Teacher NOT connected + no link => still required.
    booking_id = _book(api, world)
    api.force_authenticate(user=world["tuser"])
    res = api.post(f"{BOOKINGS}{booking_id}/confirm/", {"meeting_provider": "MEET"}, format="json")
    assert res.status_code == 400


def test_confirm_zoom_still_requires_link(api, world, enabled):
    _connect(world["tuser"])  # connected, but ZOOM never auto-generates
    booking_id = _book(api, world)
    api.force_authenticate(user=world["tuser"])
    res = api.post(f"{BOOKINGS}{booking_id}/confirm/", {"meeting_provider": "ZOOM"}, format="json")
    assert res.status_code == 400


def test_confirm_unconnected_behaves_as_before(
    api, world, enabled, fake_gcal, django_capture_on_commit_callbacks
):
    booking_id = _book(api, world)
    api.force_authenticate(user=world["tuser"])
    with django_capture_on_commit_callbacks(execute=True):
        res = api.post(
            f"{BOOKINGS}{booking_id}/confirm/",
            {"meeting_provider": "ZOOM", "meeting_link": "https://zoom.us/j/1"},
            format="json",
        )
    assert res.status_code == 200 and res.data["meeting_link"] == "https://zoom.us/j/1"
    assert BookingCalendarEvent.objects.count() == 0
    assert fake_gcal == []


# --- Reschedule patches, cancel deletes ------------------------------------

def _confirm_meet(api, world, booking_id, capture):
    api.force_authenticate(user=world["tuser"])
    with capture(execute=True):
        api.post(f"{BOOKINGS}{booking_id}/confirm/", {"meeting_provider": "MEET"}, format="json")


def test_reschedule_patches_events(
    api, world, enabled, fake_gcal, django_capture_on_commit_callbacks
):
    _connect(world["tuser"])
    booking_id = _book(api, world)
    _confirm_meet(api, world, booking_id, django_capture_on_commit_callbacks)
    fake_gcal.clear()

    api.force_authenticate(user=world["student"])
    with django_capture_on_commit_callbacks(execute=True):
        res = api.post(
            f"{BOOKINGS}{booking_id}/reschedule/",
            {"scheduled_start": _slot(timedelta(days=4)).isoformat()},
            format="json",
        )
    assert res.status_code == 200
    assert [c[0] for c in fake_gcal] == ["patch"]  # the one existing (teacher) event moved


def test_cancel_deletes_events(
    api, world, enabled, fake_gcal, django_capture_on_commit_callbacks
):
    _connect(world["tuser"])
    booking_id = _book(api, world)
    _confirm_meet(api, world, booking_id, django_capture_on_commit_callbacks)
    assert BookingCalendarEvent.objects.filter(booking_id=booking_id).count() == 1
    fake_gcal.clear()

    api.force_authenticate(user=world["tuser"])
    with django_capture_on_commit_callbacks(execute=True):
        res = api.post(f"{BOOKINGS}{booking_id}/cancel/", format="json")
    assert res.status_code == 200
    assert BookingCalendarEvent.objects.filter(booking_id=booking_id).count() == 0
    assert [c[0] for c in fake_gcal] == ["delete"]


# --- Disabled integration is inert -----------------------------------------

def test_disabled_integration_no_calls(api, world, settings, fake_gcal, django_capture_on_commit_callbacks):
    # Force the integration off (a real .env may have configured it on).
    settings.GOOGLE_CALENDAR_ENABLED = False
    _connect(world["tuser"])
    booking_id = _book(api, world)
    api.force_authenticate(user=world["tuser"])
    with django_capture_on_commit_callbacks(execute=True):
        res = api.post(
            f"{BOOKINGS}{booking_id}/confirm/",
            {"meeting_provider": "ZOOM", "meeting_link": "https://zoom.us/j/9"},
            format="json",
        )
    assert res.status_code == 200
    assert fake_gcal == [] and BookingCalendarEvent.objects.count() == 0
