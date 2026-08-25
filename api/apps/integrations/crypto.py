"""Symmetric encryption for OAuth tokens stored at rest.

Uses Fernet with GOOGLE_TOKEN_ENCRYPTION_KEY. The cryptography import is lazy so
the app (and migrations/tests) load even before the dependency is installed;
encryption is only exercised once a user actually connects Google.
"""
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def _fernet():
    from cryptography.fernet import Fernet

    key = settings.GOOGLE_TOKEN_ENCRYPTION_KEY
    if not key:
        raise ImproperlyConfigured(
            "GOOGLE_TOKEN_ENCRYPTION_KEY is not set; cannot encrypt OAuth tokens."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    return _fernet().decrypt(token.encode()).decode()
