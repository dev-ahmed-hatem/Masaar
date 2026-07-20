from django.db import models

from apps.common.models import TimeStampedModel


class Booking(TimeStampedModel):
    """A single lesson reservation: request -> confirm -> complete/settle."""

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        CONFIRMED = "CONFIRMED", "Confirmed"
        DECLINED = "DECLINED", "Declined"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Completed"
        DISPUTED = "DISPUTED", "Disputed"
        NO_SHOW = "NO_SHOW", "No-show"

    class Provider(models.TextChoices):
        ZOOM = "ZOOM", "Zoom"
        MEET = "MEET", "Google Meet"
        TEAMS = "TEAMS", "Microsoft Teams"
        CUSTOM = "CUSTOM", "Custom link"

    # Allowed status transitions (advisory helper; not yet enforced by a state engine).
    TRANSITIONS = {
        Status.REQUESTED: [Status.CONFIRMED, Status.DECLINED, Status.CANCELLED],
        Status.CONFIRMED: [Status.COMPLETED, Status.CANCELLED, Status.DISPUTED, Status.NO_SHOW],
        Status.DISPUTED: [Status.COMPLETED, Status.CANCELLED],
        Status.DECLINED: [],
        Status.CANCELLED: [],
        Status.COMPLETED: [],
        Status.NO_SHOW: [],
    }

    student = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="bookings_as_student"
    )
    teacher = models.ForeignKey(
        "teachers.TeacherProfile", on_delete=models.PROTECT, related_name="bookings"
    )
    lesson_category = models.ForeignKey(
        "catalog.LessonCategory", on_delete=models.PROTECT, related_name="bookings"
    )

    scheduled_start = models.DateTimeField(help_text="Stored in UTC")
    duration_min = models.PositiveSmallIntegerField(default=60)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.REQUESTED
    )

    meeting_provider = models.CharField(max_length=8, choices=Provider.choices, blank=True)
    meeting_link = models.URLField(blank=True)

    # Money snapshot at booking time (in minor units).
    price_minor = models.IntegerField()
    teacher_wage_minor = models.IntegerField()
    currency = models.CharField(max_length=3)
    is_trial = models.BooleanField(default=False)

    cancel_reason = models.CharField(max_length=255, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-scheduled_start"]

    def can_transition(self, new_status) -> bool:
        return new_status in self.TRANSITIONS.get(self.status, [])

    def __str__(self):
        return f"Booking #{self.pk} {self.student} → {self.teacher} [{self.status}]"
