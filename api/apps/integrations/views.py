import logging
from datetime import timezone as dt_timezone

from django.conf import settings
from django.core import signing
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import oauth
from .models import GoogleCredential
from .serializers import (
    CallbackSerializer,
    ConnectUrlSerializer,
    GoogleStatusSerializer,
)

logger = logging.getLogger("masaar.gcal")

STATE_SALT = "integrations.google.oauth"


def _require_enabled():
    if not settings.GOOGLE_CALENDAR_ENABLED:
        raise ValidationError(
            {"code": "integration_disabled",
             "detail": "Google Calendar integration is not configured."}
        )


def _status_payload(cred):
    return {
        "connected": cred is not None,
        "google_email": cred.google_email if cred else "",
        "sync_enabled": cred.sync_enabled if cred else False,
    }


def _aware(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=dt_timezone.utc) if timezone.is_naive(dt) else dt


class GoogleStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: GoogleStatusSerializer})
    def get(self, request):
        cred = GoogleCredential.objects.filter(user=request.user).first()
        return Response(GoogleStatusSerializer(_status_payload(cred)).data)


class GoogleConnectView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ConnectUrlSerializer})
    def get(self, request):
        _require_enabled()
        state = signing.dumps({"uid": request.user.id}, salt=STATE_SALT)
        return Response({"auth_url": oauth.authorization_url(state)})


class GoogleCallbackView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=CallbackSerializer, responses={200: GoogleStatusSerializer})
    def post(self, request):
        _require_enabled()
        serializer = CallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]
        state = serializer.validated_data["state"]

        try:
            payload = signing.loads(
                state, salt=STATE_SALT, max_age=settings.GOOGLE_OAUTH_STATE_TTL
            )
        except signing.BadSignature:
            raise ValidationError(
                {"code": "invalid_state", "detail": "OAuth state is invalid or expired."}
            )
        if payload.get("uid") != request.user.id:
            raise PermissionDenied("OAuth state does not match the authenticated user.")

        try:
            credentials = oauth.exchange_code(code, state)
        except Exception:
            logger.exception("Google token exchange failed")
            raise ValidationError(
                {"code": "oauth_exchange_failed",
                 "detail": "Could not complete Google authorization."}
            )

        email = oauth.fetch_email(credentials)
        cred, _ = GoogleCredential.objects.get_or_create(user=request.user)
        cred.access_token = credentials.token or ""
        cred.refresh_token = credentials.refresh_token or ""
        cred.token_expiry = _aware(credentials.expiry)
        cred.scope = " ".join(credentials.scopes or [])
        cred.google_email = email
        cred.sync_enabled = True
        cred.last_error = ""
        cred.save()
        return Response(GoogleStatusSerializer(_status_payload(cred)).data)


class GoogleDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: GoogleStatusSerializer})
    def post(self, request):
        cred = GoogleCredential.objects.filter(user=request.user).first()
        if cred is not None:
            oauth.revoke(cred)
            cred.delete()
        return Response(GoogleStatusSerializer(_status_payload(None)).data)
