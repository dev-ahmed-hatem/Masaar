import pytest

from apps.accounts.models import User
from apps.chat.models import Thread
from apps.markets.models import Market
from apps.notifications.models import Notification
from apps.teachers.models import TeacherProfile

pytestmark = pytest.mark.django_db

THREADS = "/api/chat/threads/"
UNREAD = "/api/chat/unread-count/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    sa = Market.objects.create(code="SA", name="Saudi", currency="SAR", timezone="UTC")
    tuser = User.objects.create_user(
        phone="+201000000600", full_name="Chat Teacher", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    teacher = TeacherProfile.objects.create(user=tuser, market=eg, is_published=True)
    hidden_user = User.objects.create_user(
        phone="+201000000601", full_name="Hidden Teacher", role=User.Role.TEACHER, market=eg, is_verified=True
    )
    hidden = TeacherProfile.objects.create(user=hidden_user, market=eg, is_published=False)
    sa_user = User.objects.create_user(
        phone="+966500000601", full_name="SA Teacher", role=User.Role.TEACHER, market=sa, is_verified=True
    )
    sa_teacher = TeacherProfile.objects.create(user=sa_user, market=sa, is_published=True)
    student = User.objects.create_user(
        phone="+201000000602", full_name="Chat Student", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    other_student = User.objects.create_user(
        phone="+201000000603", full_name="Other Student", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    staff = User.objects.create_user(phone="+201000000604", role=User.Role.MODERATOR, is_verified=True)
    return {
        "eg": eg, "teacher": teacher, "hidden": hidden, "sa_teacher": sa_teacher,
        "student": student, "other_student": other_student, "staff": staff,
    }


def _start_thread(api, world):
    api.force_authenticate(user=world["student"])
    return api.post(THREADS, {"teacher": world["teacher"].id}, format="json")


def _messages_url(thread_id):
    return f"{THREADS}{thread_id}/messages/"


def test_student_creates_thread_and_recreate_is_idempotent(api, world):
    res = _start_thread(api, world)
    assert res.status_code == 201
    tid = res.data["id"]
    res2 = api.post(THREADS, {"teacher": world["teacher"].id}, format="json")
    assert res2.status_code == 200
    assert res2.data["id"] == tid
    assert Thread.objects.count() == 1
    assert Thread.objects.get().market_id == world["eg"].id


def test_cannot_message_unpublished_or_other_market_teacher(api, world):
    api.force_authenticate(user=world["student"])
    res = api.post(THREADS, {"teacher": world["hidden"].id}, format="json")
    assert res.status_code == 400  # not in the published queryset
    res = api.post(THREADS, {"teacher": world["sa_teacher"].id}, format="json")
    assert res.status_code == 400
    assert res.data["error"]["code"] == "market_mismatch"


def test_teacher_cannot_create_thread(api, world):
    api.force_authenticate(user=world["teacher"].user)
    res = api.post(THREADS, {"teacher": world["teacher"].id}, format="json")
    assert res.status_code == 403


def test_send_and_list_messages_newest_first_with_validation(api, world):
    tid = _start_thread(api, world).data["id"]
    for body in ("first", "second", "third"):
        res = api.post(_messages_url(tid), {"body": body}, format="json")
        assert res.status_code == 201
    res = api.get(_messages_url(tid))
    assert res.status_code == 200
    assert [m["body"] for m in res.data["results"]] == ["third", "second", "first"]
    assert api.post(_messages_url(tid), {"body": ""}, format="json").status_code == 400
    assert api.post(_messages_url(tid), {"body": "x" * 2001}, format="json").status_code == 400


def test_non_participant_cannot_read_or_post_staff_read_only(api, world):
    tid = _start_thread(api, world).data["id"]
    api.post(_messages_url(tid), {"body": "hello"}, format="json")

    api.force_authenticate(user=world["other_student"])
    assert api.get(_messages_url(tid)).status_code == 403
    assert api.post(_messages_url(tid), {"body": "intrude"}, format="json").status_code == 403

    api.force_authenticate(user=world["staff"])
    assert api.get(_messages_url(tid)).status_code == 200
    assert api.post(_messages_url(tid), {"body": "staff"}, format="json").status_code == 403


def test_unread_count_and_mark_read(api, world):
    tid = _start_thread(api, world).data["id"]
    api.post(_messages_url(tid), {"body": "one"}, format="json")
    api.post(_messages_url(tid), {"body": "two"}, format="json")

    api.force_authenticate(user=world["teacher"].user)
    rows = api.get(THREADS).data["results"]
    assert rows[0]["unread_count"] == 2
    assert rows[0]["last_message"]["body"] == "two"

    assert api.post(f"{THREADS}{tid}/read/").data["unread_count"] == 0
    assert api.get(THREADS).data["results"][0]["unread_count"] == 0

    # Teacher replies: own message never counts as unread for the sender.
    api.post(_messages_url(tid), {"body": "reply"}, format="json")
    assert api.get(THREADS).data["results"][0]["unread_count"] == 0
    api.force_authenticate(user=world["student"])
    assert api.get(THREADS).data["results"][0]["unread_count"] == 1


def test_unread_total_endpoint(api, world):
    tid = _start_thread(api, world).data["id"]
    api.post(_messages_url(tid), {"body": "one"}, format="json")

    api.force_authenticate(user=world["other_student"])
    tid2 = api.post(THREADS, {"teacher": world["teacher"].id}, format="json").data["id"]
    api.post(_messages_url(tid2), {"body": "hi"}, format="json")
    api.post(_messages_url(tid2), {"body": "there"}, format="json")

    api.force_authenticate(user=world["teacher"].user)
    assert api.get(UNREAD).data["unread_count"] == 3
    api.post(f"{THREADS}{tid2}/read/")
    assert api.get(UNREAD).data["unread_count"] == 1


def test_notification_on_first_unread_only(api, world):
    tid = _start_thread(api, world).data["id"]
    api.post(_messages_url(tid), {"body": "one"}, format="json")
    api.post(_messages_url(tid), {"body": "two"}, format="json")
    tuser = world["teacher"].user
    assert Notification.objects.filter(user=tuser, event_type="chat_message").count() == 1

    api.force_authenticate(user=tuser)
    api.post(f"{THREADS}{tid}/read/")
    api.force_authenticate(user=world["student"])
    api.post(_messages_url(tid), {"body": "three"}, format="json")
    assert Notification.objects.filter(user=tuser, event_type="chat_message").count() == 2


def test_thread_list_ordering_by_last_message(api, world):
    tid1 = _start_thread(api, world).data["id"]
    api.post(_messages_url(tid1), {"body": "old"}, format="json")

    api.force_authenticate(user=world["other_student"])
    tid2 = api.post(THREADS, {"teacher": world["teacher"].id}, format="json").data["id"]
    api.post(_messages_url(tid2), {"body": "new"}, format="json")

    api.force_authenticate(user=world["teacher"].user)
    ids = [t["id"] for t in api.get(THREADS).data["results"]]
    assert ids == [tid2, tid1]
