from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "channel", "event_type", "status", "sent_at", "created_at")
    list_filter = ("channel", "status")
    search_fields = ("user__phone", "event_type")
