import pytest

from apps.accounts.models import User
from apps.catalog.models import StagePricingRule, Vertical
from apps.markets.models import Market

pytestmark = pytest.mark.django_db

ADMIN = "/api/admin/stage-pricing/"
PUBLIC = "/api/catalog/stage-pricing/"


@pytest.fixture
def world():
    eg = Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="UTC")
    sa = Market.objects.create(code="SA", name="Saudi Arabia", currency="SAR", timezone="UTC")
    primary = Vertical.objects.create(code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي")
    secondary = Vertical.objects.create(code=Vertical.Code.SECONDARY, name_en="Secondary", name_ar="ثانوي")
    staff = User.objects.create_user(phone="+201000000901", role=User.Role.MODERATOR, is_verified=True)
    student = User.objects.create_user(phone="+201000000902", role=User.Role.STUDENT, is_verified=True)
    return {"eg": eg, "sa": sa, "primary": primary, "secondary": secondary, "staff": staff, "student": student}


def test_stage_rule_crud(api, world):
    api.force_authenticate(user=world["staff"])

    res = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["primary"].id, "min_price_minor": 10000, "commission_pct": "15.00"},
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.data["currency"] == "EGP"
    assert res.data["stage_name_en"] == "Primary"
    rule_id = res.data["id"]

    # list filtered by market
    res = api.get(f"{ADMIN}?market=EG")
    assert res.status_code == 200 and res.data["count"] == 1

    # duplicate (market, stage) rejected
    dup = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["primary"].id, "min_price_minor": 5000, "commission_pct": "10.00"},
        format="json",
    )
    assert dup.status_code == 400

    # patch
    res = api.patch(f"{ADMIN}{rule_id}/", {"min_price_minor": 12000}, format="json")
    assert res.status_code == 200
    world_rule = StagePricingRule.objects.get(id=rule_id)
    assert world_rule.min_price_minor == 12000


def test_stage_rule_validation(api, world):
    api.force_authenticate(user=world["staff"])
    bad_pct = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["primary"].id, "min_price_minor": 10000, "commission_pct": "150.00"},
        format="json",
    )
    assert bad_pct.status_code == 400
    bad_min = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["secondary"].id, "min_price_minor": -1, "commission_pct": "10.00"},
        format="json",
    )
    assert bad_min.status_code == 400


def test_stage_rule_staff_only(api, world):
    api.force_authenticate(user=world["student"])
    assert api.get(ADMIN).status_code == 403


def test_public_stage_pricing_read(api, world):
    StagePricingRule.objects.create(market=world["eg"], vertical=world["primary"], min_price_minor=10000, commission_pct=15)
    StagePricingRule.objects.create(market=world["sa"], vertical=world["primary"], min_price_minor=8000, commission_pct=20)

    res = api.get(f"{PUBLIC}?market=EG")
    assert res.status_code == 200
    assert len(res.data) == 1
    assert res.data[0]["min_price_minor"] == 10000
    assert res.data[0]["currency"] == "EGP"

    # market is required
    assert api.get(PUBLIC).status_code == 400
