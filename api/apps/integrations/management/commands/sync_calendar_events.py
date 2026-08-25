"""Retry calendar events that failed to sync (transient Google failures).

Re-pushes any BookingCalendarEvent for an active booking that never synced or
last errored. Intended to run periodically (cron / scheduled task).
"""
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.bookings.models import Booking

from apps.integrations import google_calendar
from apps.integrations.models import BookingCalendarEvent


class Command(BaseCommand):
    help = "Retry Google Calendar events that failed to sync for active bookings."

    def handle(self, *args, **options):
        if not settings.GOOGLE_CALENDAR_ENABLED:
            self.stdout.write("Google Calendar integration disabled; nothing to do.")
            return

        active = [Booking.Status.REQUESTED, Booking.Status.CONFIRMED]
        pending = BookingCalendarEvent.objects.filter(
            booking__status__in=active
        ).filter(Q(synced_at__isnull=True) | ~Q(last_error=""))

        retried = fixed = 0
        for mapping in pending.select_related("booking", "user"):
            retried += 1
            result = google_calendar.upsert_event(
                mapping.booking, mapping.user, with_conference=False
            )
            if result is not None:
                fixed += 1
        self.stdout.write(
            self.style.SUCCESS(f"Retried {retried} event(s); {fixed} now synced.")
        )
