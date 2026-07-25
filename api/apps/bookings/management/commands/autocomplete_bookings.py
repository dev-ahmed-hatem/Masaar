"""Settle confirmed lessons whose auto-complete window has elapsed.

Intended to run periodically (cron / scheduled task).
"""
from django.core.management.base import BaseCommand

from apps.bookings import services


class Command(BaseCommand):
    help = "Auto-complete confirmed lessons past their auto-complete window."

    def handle(self, *args, **options):
        settled = services.autocomplete_due()
        self.stdout.write(self.style.SUCCESS(f"Auto-completed {settled} booking(s)."))
