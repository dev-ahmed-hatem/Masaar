from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel

from . import crypto


class GoogleCredential(TimeStampedModel):
    """A user's connected Google account + encrypted OAuth tokens.

    Tokens are stored encrypted (Fernet) in the ``*_enc`` columns and accessed
    through the plaintext ``access_token`` / ``refresh_token`` properties.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="google_credential"
    )
    access_token_enc = models.TextField(blank=True)
    refresh_token_enc = models.TextField(blank=True)
    token_expiry = models.DateTimeField(null=True, blank=True)
    scope = models.TextField(blank=True)
    google_email = models.EmailField(blank=True)
    calendar_id = models.CharField(max_length=255, default="primary")
    # Flipped off when a token is revoked/refresh fails; the UI then prompts a reconnect.
    sync_enabled = models.BooleanField(default=True)
    last_error = models.TextField(blank=True)

    @property
    def access_token(self) -> str:
        return crypto.decrypt(self.access_token_enc)

    @access_token.setter
    def access_token(self, value: str):
        self.access_token_enc = crypto.encrypt(value or "")

    @property
    def refresh_token(self) -> str:
        return crypto.decrypt(self.refresh_token_enc)

    @refresh_token.setter
    def refresh_token(self, value: str):
        # Google only returns a refresh token on the first consent; never clobber
        # a stored one with an empty value on subsequent grants.
        if value:
            self.refresh_token_enc = crypto.encrypt(value)

    def __str__(self):
        return f"GoogleCredential(user={self.user_id}, {self.google_email})"


class BookingCalendarEvent(TimeStampedModel):
    """Maps a booking + participant to the Google Calendar event we created for
    them, so it can be patched (reschedule) or deleted (cancel) later."""

    booking = models.ForeignKey(
        "bookings.Booking", on_delete=models.CASCADE, related_name="calendar_events"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calendar_events"
    )
    google_event_id = models.CharField(max_length=1024, blank=True)
    calendar_id = models.CharField(max_length=255, default="primary")
    html_link = models.URLField(blank=True)
    meet_link = models.URLField(blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    class Meta:
        unique_together = (("booking", "user"),)

    def __str__(self):
        return f"BookingCalendarEvent(booking={self.booking_id}, user={self.user_id})"
