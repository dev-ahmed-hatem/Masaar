import pytest

from apps.accounts.models import User
from apps.markets.models import Market
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.payments import services as payments
from apps.payments.models import Receipt

pytestmark = pytest.mark.django_db

FEED = "/api/notifications/"


@pytest.fixture
def user(db):
    return User.objects.create_user(phone="+201000000700", full_name="Nabil N", role=User.Role.STUDENT)


def test_notify_creates_and_sends(user):
    result = notify(user, "receipt_approved", {"amount": "100.00 EGP"})
    assert len(result) == 1
    n = result[0]
    assert n.channel == Notification.Channel.WHATSAPP
    assert n.status == Notification.Status.SENT and n.sent_at is not None


def test_provider_failure_marks_failed(user, settings):
    settings.NOTIFICATION_PROVIDERS = {
        **settings.NOTIFICATION_PROVIDERS,
        "WHATSAPP": "apps.notifications.providers.WhatsAppProvider",  # raises NotImplementedError
    }
    n = notify(user, "booking_confirmed", {"teacher": "T"})[0]
    assert n.status == Notification.Status.FAILED and n.sent_at is None


def test_email_channel_sends(mailoutbox):
    user = User.objects.create_user(
        phone="+201000000701", full_name="Emailed E", email="e@example.com", role=User.Role.STUDENT
    )
    n = notify(user, "receipt_approved", {"amount": "50.00 EGP"}, channels=["EMAIL"])[0]
    assert n.status == Notification.Status.SENT
    assert len(mailoutbox) == 1
    assert mailoutbox[0].to == ["e@example.com"]
    assert "50.00 EGP" in mailoutbox[0].body


def test_receipt_approval_notifies_student(db):
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    student = User.objects.create_user(phone="+201000000702", role=User.Role.STUDENT, market=eg)
    staff = User.objects.create_user(phone="+201000000703", role=User.Role.MODERATOR)
    receipt = Receipt.objects.create(
        user=student, market=eg, amount_minor=10000, currency="EGP",
        method=Receipt.Method.BANK, purpose=Receipt.Purpose.TOPUP,
    )
    payments.approve_receipt(receipt, staff)
    assert Notification.objects.filter(user=student, event_type="receipt_approved").exists()


def test_feed_lists_own(api, user):
    notify(user, "receipt_approved", {"amount": "1.00 EGP"})
    other = User.objects.create_user(phone="+201000000709", role=User.Role.STUDENT)
    notify(other, "receipt_rejected", {"reason": "x"})

    api.force_authenticate(user=user)
    res = api.get(FEED)
    assert res.status_code == 200 and res.data["count"] == 1
    row = res.data["results"][0]
    assert row["title"] == "Payment approved" and "1.00 EGP" in row["body"]
