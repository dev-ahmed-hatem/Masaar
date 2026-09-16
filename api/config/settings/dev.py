"""Development settings."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Allow the local Next.js dev server by default.
CORS_ALLOW_ALL_ORIGINS = True

# Emails print to the console by default. To send real mail locally (e.g. to test
# OTP_CHANNEL=email over Gmail), set
# DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend.
EMAIL_BACKEND = env(
    "DJANGO_EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
