import pytest

from apps.accounts.models import User
from apps.markets.models import Market
from apps.payments.models import (
    LedgerEntry,
    Package,
    PackagePurchase,
    Receipt,
    Wallet,
)

pytestmark = pytest.mark.django_db

PACKAGES = "/api/packages/"
PURCHASES = "/api/package-purchases/"
RECEIPTS = "/api/receipts/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="Africa/Cairo")
    sa = Market.objects.create(code="SA", name="Saudi Arabia", currency="SAR", timezone="Asia/Riyadh")
    eg_pkg = Package.objects.create(
        market=eg, name="Value 10", credits=10, price_minor=60000, currency="EGP"
    )
    sa_pkg = Package.objects.create(
        market=sa, name="SA 5", credits=5, price_minor=20000, currency="SAR"
    )
    student = User.objects.create_user(
        phone="+201000000400", full_name="Buyer B", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    staff = User.objects.create_user(phone="+201000000401", role=User.Role.MODERATOR, is_verified=True)
    return {"eg": eg, "sa": sa, "eg_pkg": eg_pkg, "sa_pkg": sa_pkg, "student": student, "staff": staff}


def test_packages_market_scoped(api, world):
    api.force_authenticate(user=world["student"])
    res = api.get(PACKAGES)
    assert res.status_code == 200
    assert [p["name"] for p in res.data] == ["Value 10"]
    assert res.data[0]["price_display"] == "600.00 EGP"


def test_purchase_creates_pending_purchase_and_receipt(api, world):
    api.force_authenticate(user=world["student"])
    res = api.post(f"{PACKAGES}{world['eg_pkg'].id}/purchase/", {"method": "BANK", "reference": "P1"}, format="multipart")
    assert res.status_code == 201 and res.data["status"] == "PENDING"

    purchase = PackagePurchase.objects.get(id=res.data["id"])
    assert purchase.receipt.purpose == Receipt.Purpose.PACKAGE
    assert purchase.receipt.amount_minor == 60000 and purchase.receipt.status == Receipt.Status.PENDING


def test_cannot_purchase_other_market_package(api, world):
    api.force_authenticate(user=world["student"])
    res = api.post(f"{PACKAGES}{world['sa_pkg'].id}/purchase/", {"method": "BANK"}, format="multipart")
    assert res.status_code == 400


def test_approve_package_grants_wallet_and_marks_granted(api, world):
    api.force_authenticate(user=world["student"])
    purchase_id = api.post(
        f"{PACKAGES}{world['eg_pkg'].id}/purchase/", {"method": "BANK"}, format="multipart"
    ).data["id"]
    receipt = PackagePurchase.objects.get(id=purchase_id).receipt

    api.force_authenticate(user=world["staff"])
    res = api.post(f"{RECEIPTS}{receipt.id}/approve/", format="json")
    assert res.status_code == 200 and res.data["status"] == "APPROVED"

    wallet = Wallet.objects.get(user=world["student"])
    assert wallet.available_minor == 60000
    assert LedgerEntry.objects.filter(wallet=wallet, kind=LedgerEntry.Kind.PACKAGE_GRANT).exists()

    purchase = PackagePurchase.objects.get(id=purchase_id)
    assert purchase.status == PackagePurchase.Status.GRANTED and purchase.credits_granted == 10


def test_reject_package_marks_purchase_rejected(api, world):
    api.force_authenticate(user=world["student"])
    purchase_id = api.post(
        f"{PACKAGES}{world['eg_pkg'].id}/purchase/", {"method": "BANK"}, format="multipart"
    ).data["id"]
    receipt = PackagePurchase.objects.get(id=purchase_id).receipt

    api.force_authenticate(user=world["staff"])
    res = api.post(f"{RECEIPTS}{receipt.id}/reject/", {"reason": "wrong amount"}, format="json")
    assert res.status_code == 200
    assert PackagePurchase.objects.get(id=purchase_id).status == PackagePurchase.Status.REJECTED
    assert not Wallet.objects.filter(user=world["student"], available_minor__gt=0).exists()


def test_pay_per_booking_receipt_credits_wallet(api, world):
    api.force_authenticate(user=world["student"])
    receipt_id = api.post(
        RECEIPTS, {"amount_minor": 6000, "method": "BANK", "purpose": "BOOKING"}, format="multipart"
    ).data["id"]

    api.force_authenticate(user=world["staff"])
    api.post(f"{RECEIPTS}{receipt_id}/approve/", format="json")
    wallet = Wallet.objects.get(user=world["student"])
    assert wallet.available_minor == 6000
    assert LedgerEntry.objects.filter(wallet=wallet, kind=LedgerEntry.Kind.TOPUP).exists()
