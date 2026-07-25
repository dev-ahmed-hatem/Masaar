import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import User
from apps.markets.models import Market, PaymentAccount
from apps.payments.models import LedgerEntry, Receipt, Wallet

pytestmark = pytest.mark.django_db

ACCOUNTS = "/api/payment-accounts/"
RECEIPTS = "/api/receipts/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="Africa/Cairo")
    sa = Market.objects.create(code="SA", name="Saudi Arabia", currency="SAR", timezone="Asia/Riyadh")
    PaymentAccount.objects.create(
        market=eg, kind=PaymentAccount.Kind.BANK, display_name="Masaar EG Bank",
        details="IBAN EG...", sort_order=0,
    )
    PaymentAccount.objects.create(
        market=sa, kind=PaymentAccount.Kind.BANK, display_name="Masaar SA Bank",
        details="IBAN SA...", sort_order=0,
    )
    student = User.objects.create_user(
        phone="+201000000300", full_name="Omar S", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    staff = User.objects.create_user(
        phone="+201000000301", role=User.Role.MODERATOR, is_verified=True
    )
    return {"eg": eg, "sa": sa, "student": student, "staff": staff}


def _upload(api, amount=5000, with_image=False):
    data = {"amount_minor": amount, "method": "BANK", "reference": "TXN123"}
    if with_image:
        data["image"] = SimpleUploadedFile("r.png", b"fakeimage", content_type="image/png")
    return api.post(RECEIPTS, data, format="multipart")


def test_payment_accounts_market_scoped(api, world):
    api.force_authenticate(user=world["student"])
    res = api.get(ACCOUNTS)
    assert res.status_code == 200
    assert [a["display_name"] for a in res.data] == ["Masaar EG Bank"]


def test_upload_receipt_is_pending_topup(api, world, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    api.force_authenticate(user=world["student"])
    res = _upload(api, with_image=True)
    assert res.status_code == 201
    assert res.data["status"] == "PENDING"
    assert res.data["purpose"] == "TOPUP"
    assert res.data["market"] == "EG" and res.data["currency"] == "EGP"
    assert res.data["image"]  # stored


def test_student_sees_own_staff_sees_queue(api, world):
    api.force_authenticate(user=world["student"])
    _upload(api)
    assert api.get(RECEIPTS).data["count"] == 1  # own

    other = User.objects.create_user(
        phone="+201000000309", role=User.Role.STUDENT, market=world["eg"], is_verified=True
    )
    api.force_authenticate(user=other)
    assert api.get(RECEIPTS).data["count"] == 0  # sees only own

    api.force_authenticate(user=world["staff"])
    assert api.get(RECEIPTS).data["count"] == 1  # queue


def test_approve_credits_wallet(api, world):
    api.force_authenticate(user=world["student"])
    receipt_id = _upload(api, amount=7500).data["id"]

    api.force_authenticate(user=world["staff"])
    res = api.post(f"{RECEIPTS}{receipt_id}/approve/", format="json")
    assert res.status_code == 200 and res.data["status"] == "APPROVED"
    assert res.data["reviewed_by"] == world["staff"].full_name or res.data["reviewed_by"] is None

    wallet = Wallet.objects.get(user=world["student"])
    assert wallet.available_minor == 7500
    entry = LedgerEntry.objects.get(wallet=wallet, kind=LedgerEntry.Kind.TOPUP)
    assert entry.amount_minor == 7500 and entry.receipt_id == receipt_id

    # Re-approving is rejected.
    again = api.post(f"{RECEIPTS}{receipt_id}/approve/", format="json")
    assert again.status_code == 400 and again.data["error"]["code"] == "receipt_not_pending"


def test_reject_with_reason_leaves_wallet_untouched(api, world):
    api.force_authenticate(user=world["student"])
    receipt_id = _upload(api).data["id"]

    api.force_authenticate(user=world["staff"])
    res = api.post(f"{RECEIPTS}{receipt_id}/reject/", {"reason": "Blurry image"}, format="json")
    assert res.status_code == 200 and res.data["status"] == "REJECTED"
    assert Receipt.objects.get(id=receipt_id).reject_reason == "Blurry image"
    assert not Wallet.objects.filter(user=world["student"], available_minor__gt=0).exists()


def test_non_staff_cannot_approve(api, world):
    api.force_authenticate(user=world["student"])
    receipt_id = _upload(api).data["id"]
    # Still the student (not staff) tries to approve.
    assert api.post(f"{RECEIPTS}{receipt_id}/approve/", format="json").status_code == 403
