import pytest

from apps.accounts.models import User
from apps.catalog.models import StagePricingRule, Vertical
from apps.markets.models import Market

pytestmark = pytest.mark.django_db

ADMIN = "/api/admin/stage-pricing/"
PUBLIC = "/api/catalog/stage-pricing/"


@pytest.fixture
def world():
    eg = Market.objects.update_or_create(code="EG", defaults={"name": "Egypt", "currency": "EGP", "timezone": "UTC"})[0]
    sa = Market.objects.update_or_create(code="SA", defaults={"name": "Saudi Arabia", "currency": "SAR", "timezone": "UTC"})[0]
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


def test_stage_rule_max_price(api, world):
    api.force_authenticate(user=world["staff"])

    # A rule may be created without a ceiling, then given one later.
    res = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["primary"].id, "min_price_minor": 10000, "commission_pct": "15.00"},
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.data["max_price_minor"] is None
    rule_id = res.data["id"]

    res = api.patch(f"{ADMIN}{rule_id}/", {"max_price_minor": 30000}, format="json")
    assert res.status_code == 200 and res.data["max_price_minor"] == 30000
    assert StagePricingRule.objects.get(id=rule_id).max_price_minor == 30000

    # Clearing it lifts the ceiling again.
    res = api.patch(f"{ADMIN}{rule_id}/", {"max_price_minor": None}, format="json")
    assert res.status_code == 200 and res.data["max_price_minor"] is None

    # Created with both ends at once.
    res = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["secondary"].id, "min_price_minor": 8000,
         "max_price_minor": 20000, "commission_pct": "18.00"},
        format="json",
    )
    assert res.status_code == 201 and res.data["max_price_minor"] == 20000


def _field_errors(res) -> dict:
    """Field errors out of the API's error envelope."""
    return res.data["error"]["detail"]


def test_stage_rule_max_cannot_sit_below_min(api, world):
    api.force_authenticate(user=world["staff"])

    bad = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["primary"].id, "min_price_minor": 10000,
         "max_price_minor": 9000, "commission_pct": "15.00"},
        format="json",
    )
    assert bad.status_code == 400 and "max_price_minor" in _field_errors(bad)

    zero = api.post(
        ADMIN,
        {"market": "EG", "vertical": world["primary"].id, "min_price_minor": 0,
         "max_price_minor": 0, "commission_pct": "15.00"},
        format="json",
    )
    assert zero.status_code == 400 and "max_price_minor" in _field_errors(zero)

    rule = StagePricingRule.objects.create(
        market=world["eg"], vertical=world["secondary"], min_price_minor=8000,
        max_price_minor=20000, commission_pct=18,
    )
    # A PATCH is checked against the instance's other end, not just the payload.
    raise_min = api.patch(f"{ADMIN}{rule.id}/", {"min_price_minor": 25000}, format="json")
    assert raise_min.status_code == 400 and "max_price_minor" in _field_errors(raise_min)
    lower_max = api.patch(f"{ADMIN}{rule.id}/", {"max_price_minor": 5000}, format="json")
    assert lower_max.status_code == 400 and "max_price_minor" in _field_errors(lower_max)


def test_stage_rule_staff_only(api, world):
    api.force_authenticate(user=world["student"])
    assert api.get(ADMIN).status_code == 403


def test_public_stage_pricing_read(api, world):
    StagePricingRule.objects.create(market=world["eg"], vertical=world["primary"], min_price_minor=10000, max_price_minor=30000, commission_pct=15)
    StagePricingRule.objects.create(market=world["sa"], vertical=world["primary"], min_price_minor=8000, commission_pct=20)

    res = api.get(f"{PUBLIC}?market=EG")
    assert res.status_code == 200
    assert len(res.data) == 1
    assert res.data[0]["min_price_minor"] == 10000
    assert res.data[0]["max_price_minor"] == 30000
    assert res.data[0]["currency"] == "EGP"

    # market is required
    assert api.get(PUBLIC).status_code == 400
