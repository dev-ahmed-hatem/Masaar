"""Base settings shared by all environments."""
from datetime import timedelta
from pathlib import Path

import environ

# BASE_DIR points at the `api/` directory (settings is config/settings/base.py).
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="django-insecure-dev-only-change-me")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    # Local apps
    "apps.common",
    "apps.accounts",
    "apps.markets",
    "apps.catalog",
    "apps.teachers",
    "apps.bookings",
    "apps.payments",
    "apps.payouts",
    "apps.reviews",
    "apps.notifications",
    "apps.chat",
    "apps.integrations",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    ),
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization — Arabic (RTL) + English.
LANGUAGE_CODE = "en"
LANGUAGES = [("ar", "Arabic"), ("en", "English")]
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
LOCALE_PATHS = [BASE_DIR / "locale"]

# Static & media
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.masaar_exception_handler",
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": env.int("API_PAGE_SIZE", default=20),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "otp_request": env("THROTTLE_OTP_REQUEST", default="5/min"),
        "otp_verify": env("THROTTLE_OTP_VERIFY", default="10/min"),
        "login": env("THROTTLE_LOGIN", default="10/min"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Masaar API",
    "DESCRIPTION": "Tutoring reservation marketplace — Egypt & Saudi Arabia.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# --- OTP (phone verification + password reset via WhatsApp) ---
OTP_LENGTH = env.int("OTP_LENGTH", default=6)
OTP_TTL_SECONDS = env.int("OTP_TTL_SECONDS", default=300)
OTP_MAX_ATTEMPTS = env.int("OTP_MAX_ATTEMPTS", default=5)
OTP_RESEND_COOLDOWN_SECONDS = env.int("OTP_RESEND_COOLDOWN_SECONDS", default=60)
# Dotted path to the OTP sender implementation. Dev logs the code; swap for the
# WhatsApp Cloud API sender in production.
OTP_SENDER = env("OTP_SENDER", default="apps.accounts.senders.ConsoleOTPSender")
# Sender for non-OTP account messages (e.g. an approved teacher's temporary password).
ACCOUNT_MESSAGE_SENDER = env(
    "ACCOUNT_MESSAGE_SENDER", default="apps.accounts.senders.ConsoleAccountSender"
)

# --- Notifications (Track D integrations behind these providers) ---
# Dev routes every channel to a console logger; production points these at real
# WhatsApp Cloud / FCM / SMTP providers.
NOTIFICATION_PROVIDERS = {
    "WHATSAPP": env("NOTIFY_WHATSAPP_PROVIDER", default="apps.notifications.providers.ConsoleProvider"),
    "PUSH": env("NOTIFY_PUSH_PROVIDER", default="apps.notifications.providers.ConsoleProvider"),
    "EMAIL": env("NOTIFY_EMAIL_PROVIDER", default="apps.notifications.providers.EmailProvider"),
}
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Masaar <no-reply@masaar.local>")

# --- Google Calendar integration ---
# Teachers/students connect their Google account so confirmed lessons are pushed
# to their calendar with an auto-generated Meet link. All hooks no-op cleanly
# when unconfigured (GOOGLE_CALENDAR_ENABLED is False), so dev/CI needs nothing.
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default="")
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET", default="")
# The frontend callback route the browser is redirected to after consent; must
# match a redirect URI registered on the Google OAuth client.
GOOGLE_OAUTH_REDIRECT_URI = env(
    "GOOGLE_OAUTH_REDIRECT_URI", default="http://localhost:3000/en/settings/google/callback"
)
GOOGLE_OAUTH_SCOPES = env.list(
    "GOOGLE_OAUTH_SCOPES",
    default=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/calendar.events",
    ],
)
# Fernet key (base64, 32 bytes) used to encrypt stored OAuth tokens at rest.
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
GOOGLE_TOKEN_ENCRYPTION_KEY = env("GOOGLE_TOKEN_ENCRYPTION_KEY", default="")
# Master kill-switch: every calendar hook short-circuits unless creds are set.
GOOGLE_CALENDAR_ENABLED = bool(GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)
# Signed-state TTL for the OAuth handshake (seconds).
GOOGLE_OAUTH_STATE_TTL = env.int("GOOGLE_OAUTH_STATE_TTL", default=600)

# --- Booking lifecycle policy (§16) ---
# Free student cancellation up to this many hours before the lesson; later is charged.
BOOKING_CANCEL_CUTOFF_HOURS = env.int("BOOKING_CANCEL_CUTOFF_HOURS", default=24)
# A confirmed lesson auto-completes this many hours after it ends if unconfirmed.
BOOKING_AUTOCOMPLETE_HOURS = env.int("BOOKING_AUTOCOMPLETE_HOURS", default=24)
BOOKING_DEFAULT_DURATION_MIN = env.int("BOOKING_DEFAULT_DURATION_MIN", default=60)
# How many days ahead slot listing generates from recurring availability.
BOOKING_SLOT_HORIZON_DAYS = env.int("BOOKING_SLOT_HORIZON_DAYS", default=14)
