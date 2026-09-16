import pytest

from apps.accounts.utils import normalize_phone
from apps.markets.countries import ARAB_COUNTRIES
from apps.markets.models import Market

pytestmark = pytest.mark.django_db

MARKETS = "/api/markets/"


def test_all_arab_countries_are_seeded_and_listed(api):
    res = api.get(MARKETS)
    assert res.status_code == 200
    codes = {m["code"] for m in res.data}
    assert codes == {c[0] for c in ARAB_COUNTRIES} and len(codes) == 22
    uae = next(m for m in res.data if m["code"] == "AE")
    assert uae == {
        "code": "AE", "name": "United Arab Emirates", "name_ar": "الإمارات",
        "currency": "AED", "timezone": "Asia/Dubai", "dial_code": "+971",
    }


def test_inactive_markets_are_hidden_and_not_selectable(api):
    Market.objects.filter(code="YE").update(is_active=False)
    assert "YE" not in {m["code"] for m in api.get(MARKETS).data}

    res = api.post(
        "/api/auth/signup/",
        {"phone": "0712345678", "full_name": "X", "password": "Sup3rSecret!", "market": "YE", "vertical": 1},
        format="json",
    )
    assert res.status_code == 400 and "market" in res.data["error"]["detail"]


@pytest.mark.parametrize(
    "local,market,expected",
    [("0501234567", "AE", "+971501234567"), ("33123456", "QA", "+97433123456"), ("0612345678", "MA", "+212612345678")],
)
def test_phone_normalized_with_market_dial_code(local, market, expected):
    assert normalize_phone(local, market) == expected
