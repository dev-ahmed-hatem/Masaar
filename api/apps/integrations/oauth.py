"""Google OAuth 2.0 handshake helpers.

google-* imports are lazy so the app loads without the dependency; these run
only during an actual connect flow.
"""
import logging
import os
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger("masaar.gcal")

# Google returns scopes reordered and adds a bare "email", so the granted set
# never matches the requested set exactly — without this, requests-oauthlib
# raises "Scope has changed" and fetch_token fails. Required for Google OAuth.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
# Allow the http://localhost redirect during local dev token exchange.
if settings.DEBUG:
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
        }
    }


def _build_flow(state=None, redirect_uri=None):
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        _client_config(), scopes=settings.GOOGLE_OAUTH_SCOPES, state=state
    )
    flow.redirect_uri = redirect_uri or settings.GOOGLE_OAUTH_REDIRECT_URI
    return flow


def authorization_url(state: str, redirect_uri: str | None = None) -> str:
    """Consent URL. ``access_type=offline`` + ``prompt=consent`` guarantees a
    refresh token so we can push events long after the user leaves. The
    redirect_uri must match the one used later at token exchange."""
    flow = _build_flow(state=state, redirect_uri=redirect_uri)
    url, _ = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    return url


def exchange_code(code: str, state: str, redirect_uri: str | None = None):
    """Exchange an authorization code for credentials (access + refresh token).
    redirect_uri must match the one used to build the consent URL."""
    flow = _build_flow(state=state, redirect_uri=redirect_uri)
    flow.fetch_token(code=code)
    return flow.credentials


def fetch_email(credentials) -> str:
    from googleapiclient.discovery import build

    try:
        svc = build("oauth2", "v2", credentials=credentials, cache_discovery=False)
        return svc.userinfo().get().execute().get("email", "")
    except Exception:
        logger.exception("Failed to fetch Google userinfo email")
        return ""


def revoke(cred) -> None:
    """Best-effort token revocation at Google; never raises."""
    token = cred.refresh_token or cred.access_token
    if not token:
        return
    try:
        data = urllib.parse.urlencode({"token": token}).encode()
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/revoke",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        urllib.request.urlopen(req, timeout=5)  # noqa: S310 (fixed Google URL)
    except Exception:
        logger.warning("Google token revoke failed (ignored)", exc_info=True)
