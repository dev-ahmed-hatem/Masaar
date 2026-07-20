from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "teacher",
        "scheduled_start",
        "status",
        "is_trial",
        "price_minor",
        "currency",
    )
    list_filter = ("status", "is_trial", "meeting_provider", "currency")
    search_fields = ("student__phone", "teacher__user__phone")
    date_hierarchy = "scheduled_start"
