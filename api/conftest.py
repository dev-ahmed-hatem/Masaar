import pytest


@pytest.fixture(autouse=True)
def _relax_throttle_and_cache(settings):
    """Tests hit OTP endpoints repeatedly; relax throttling and clear the shared cache."""
    from django.core.cache import cache

    cache.clear()
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {
            "otp_request": "1000/min",
            "otp_verify": "1000/min",
            "login": "1000/min",
        },
    }
    # Remove the resend cooldown so back-to-back requests in a test don't 429.
    settings.OTP_RESEND_COOLDOWN_SECONDS = 0


@pytest.fixture
def api():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def market(db):
    from apps.markets.models import Market

    return Market.objects.create(code="EG", name="Egypt", currency="EGP", timezone="Africa/Cairo")


@pytest.fixture
def fixed_code(monkeypatch):
    from apps.accounts import services

    monkeypatch.setattr(services, "_generate_code", lambda: "123456")
    return "123456"
