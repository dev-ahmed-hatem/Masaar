from django.contrib import admin

from .models import BookingCalendarEvent, GoogleCredential


@admin.register(GoogleCredential)
class GoogleCredentialAdmin(admin.ModelAdmin):
    list_display = ("user", "google_email", "sync_enabled", "token_expiry", "updated_at")
    list_filter = ("sync_enabled",)
    search_fields = ("user__phone", "google_email")
    # Never surface encrypted tokens in the admin.
    exclude = ("access_token_enc", "refresh_token_enc")
    readonly_fields = ("token_expiry", "scope", "google_email", "last_error")


@admin.register(BookingCalendarEvent)
class BookingCalendarEventAdmin(admin.ModelAdmin):
    list_display = ("booking", "user", "synced_at", "meet_link")
    search_fields = ("booking__id", "user__phone", "google_event_id")
    readonly_fields = ("google_event_id", "html_link", "meet_link", "synced_at", "last_error")
