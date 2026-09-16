import pytest

from apps.accounts.models import User
from apps.markets.models import Market, PaymentAccount
from apps.payments.models import Receipt

pytestmark = pytest.mark.django_db

ADMIN = "/api/admin/payment-accounts/"
STUDENT_LIST = "/api/payment-accounts/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="Africa/Cairo")
    sa = Market.objects.create(code="SA", name="Saudi Arabia", currency="SAR", timezone="Asia/Riyadh")
    staff = User.objects.create_user(phone="+201000000700", role=User.Role.MODERATOR, is_verified=True)
    student = User.objects.create_user(
        phone="+201000000701", role=User.Role.STUDENT, market=eg, is_verified=True
    )
    return {"eg": eg, "sa": sa, "staff": staff, "student": student}


def _account(**overrides):
    body = {
        "market": "EG", "kind": "WALLET", "display_name": "Vodafone Cash",
        "details": "01000000000", "instructions": "Send, then upload the screenshot.",
        "sort_order": 1,
    }
    body.update(overrides)
    return body


def test_staff_creates_account_visible_to_students(api, world):
    api.force_authenticate(user=world["staff"])
    res = api.post(ADMIN, _account(), format="json")
    assert res.status_code == 201
    assert res.data["market"] == "EG" and res.data["is_active"] is True

    api.force_authenticate(user=world["student"])
    listed = api.get(STUDENT_LIST).data
    assert [a["display_name"] for a in listed] == ["Vodafone Cash"]


def test_list_filters_by_market_and_active(api, world):
    api.force_authenticate(user=world["staff"])
    api.post(ADMIN, _account(), format="json")
    api.post(ADMIN, _account(market="SA", kind="BANK", display_name="Al Rajhi"), format="json")
    api.post(ADMIN, _account(display_name="Old wallet", is_active=False), format="json")

    assert len(api.get(ADMIN).data) == 3
    assert {a["display_name"] for a in api.get(ADMIN, {"market": "eg"}).data} == {"Vodafone Cash", "Old wallet"}
    assert [a["display_name"] for a in api.get(ADMIN, {"market": "EG", "active": "true"}).data] == ["Vodafone Cash"]


def test_update_and_deactivate_hides_from_students(api, world):
    api.force_authenticate(user=world["staff"])
    account_id = api.post(ADMIN, _account(), format="json").data["id"]
    res = api.patch(f"{ADMIN}{account_id}/", {"details": "01111111111", "is_active": False}, format="json")
    assert res.status_code == 200 and res.data["details"] == "01111111111"

    api.force_authenticate(user=world["student"])
    assert api.get(STUDENT_LIST).data == []


def test_validation(api, world):
    api.force_authenticate(user=world["staff"])
    assert api.post(ADMIN, _account(display_name="  "), format="json").status_code == 400
    assert api.post(ADMIN, _account(details=""), format="json").status_code == 400
    assert api.post(ADMIN, _account(kind="CASH"), format="json").status_code == 400
    assert api.post(ADMIN, _account(market="ZZ"), format="json").status_code == 400


def test_delete_unused_ok_used_conflicts(api, world):
    api.force_authenticate(user=world["staff"])
    unused = api.post(ADMIN, _account(display_name="Unused"), format="json").data["id"]
    assert api.delete(f"{ADMIN}{unused}/").status_code == 204

    used = PaymentAccount.objects.create(
        market=world["eg"], kind="BANK", display_name="Used bank", details="IBAN"
    )
    Receipt.objects.create(
        user=world["student"], market=world["eg"], amount_minor=1000, currency="EGP",
        method="BANK", payment_account=used, purpose=Receipt.Purpose.TOPUP,
    )
    res = api.delete(f"{ADMIN}{used.id}/")
    assert res.status_code == 409 and res.data["error"]["code"] == "in_use"


def test_staff_only(api, world):
    api.force_authenticate(user=world["student"])
    assert api.get(ADMIN).status_code == 403
    assert api.post(ADMIN, _account(), format="json").status_code == 403
