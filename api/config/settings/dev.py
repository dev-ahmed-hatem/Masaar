"""Development settings."""
from .base import *  # noqa: F401,F403
from .base import env  # noqa: F401

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Allow the local Next.js dev server by default.
CORS_ALLOW_ALL_ORIGINS = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
