import pytest

from apps.accounts.models import PhoneOTP, User

pytestmark = pytest.mark.django_db

SIGNUP = "/api/auth/signup/"
VERIFY = "/api/auth/otp/verify/"
RESEND = "/api/auth/otp/resend/"
LOGIN = "/api/auth/login/"
RESET = "/api/auth/password/reset/"
RESET_CONFIRM = "/api/auth/password/reset/confirm/"
ME = "/api/auth/me/"

PWD = "Sup3rSecret!"


def _signup(api, market, phone="01000000001"):
    return api.post(
        SIGNUP,
        {"phone": phone, "full_name": "Test Student", "password": PWD, "market": "EG", "locale": "ar"},
        format="json",
    )


def test_signup_verify_login_me(api, market, fixed_code):
    res = _signup(api, market)
    assert res.status_code == 201
    phone = res.data["phone"]
    assert phone == "+201000000001"  # normalized

    user = User.objects.get(phone=phone)
    assert user.role == User.Role.STUDENT and user.is_verified is False

    # Unverified login is blocked.
    blocked = api.post(LOGIN, {"phone": phone, "password": PWD}, format="json")
    assert blocked.status_code == 403
    assert blocked.data["error"]["code"] == "phone_not_verified"

    # Verify with the OTP.
    res = api.post(VERIFY, {"phone": phone, "code": fixed_code}, format="json")
    assert res.status_code == 200
    assert "access" in res.data and res.data["user"]["is_verified"] is True

    # Authenticated /me.
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    me = api.get(ME)
    assert me.status_code == 200 and me.data["role"] == "STUDENT"
    api.credentials()

    # Password login now works.
    res = api.post(LOGIN, {"phone": phone, "password": PWD}, format="json")
    assert res.status_code == 200 and "access" in res.data


def test_verify_wrong_code(api, market, fixed_code):
    phone = _signup(api, market).data["phone"]
    res = api.post(VERIFY, {"phone": phone, "code": "000000"}, format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "otp_invalid"


def test_attempts_exceeded(api, market, fixed_code, settings):
    settings.OTP_MAX_ATTEMPTS = 3
    phone = _signup(api, market).data["phone"]
    for _ in range(3):
        api.post(VERIFY, {"phone": phone, "code": "000000"}, format="json")
    res = api.post(VERIFY, {"phone": phone, "code": fixed_code}, format="json")
    assert res.status_code == 429 and res.data["error"]["code"] == "otp_attempts_exceeded"


def test_expired_code(api, market, fixed_code, settings):
    from django.utils import timezone

    phone = _signup(api, market).data["phone"]
    otp = PhoneOTP.objects.filter(phone=phone).latest("created_at")
    otp.expires_at = timezone.now() - timezone.timedelta(seconds=1)
    otp.save(update_fields=["expires_at"])
    res = api.post(VERIFY, {"phone": phone, "code": fixed_code}, format="json")
    assert res.status_code == 400 and res.data["error"]["code"] == "otp_expired"


def test_duplicate_phone(api, market, fixed_code):
    _signup(api, market)
    res = _signup(api, market)
    assert res.status_code == 400 and res.data["error"]["code"] == "phone_taken"


def test_password_reset_flow(api, market, fixed_code):
    phone = _signup(api, market).data["phone"]
    api.post(VERIFY, {"phone": phone, "code": fixed_code}, format="json")

    assert api.post(RESET, {"phone": phone}, format="json").status_code == 200
    new_pwd = "Even-Str0nger!"
    res = api.post(
        RESET_CONFIRM, {"phone": phone, "code": fixed_code, "new_password": new_pwd}, format="json"
    )
    assert res.status_code == 200

    assert api.post(LOGIN, {"phone": phone, "password": new_pwd}, format="json").status_code == 200


def test_reset_request_unknown_phone_is_generic(api, market):
    # No account -> still 200, no code issued (no enumeration).
    res = api.post(RESET, {"phone": "01099999999"}, format="json")
    assert res.status_code == 200
    assert not PhoneOTP.objects.filter(purpose=PhoneOTP.Purpose.RESET).exists()


def test_me_requires_auth(api, market):
    # Protected endpoints reject anonymous callers.
    res = api.get(ME)
    assert res.status_code == 401


def test_resend_cooldown(api, market, fixed_code, settings):
    # A resend within the cooldown window is rejected.
    settings.OTP_RESEND_COOLDOWN_SECONDS = 60
    phone = _signup(api, market).data["phone"]  # issues the first VERIFY code
    res = api.post(RESEND, {"phone": phone, "purpose": "VERIFY"}, format="json")
    assert res.status_code == 429 and res.data["error"]["code"] == "otp_cooldown"
