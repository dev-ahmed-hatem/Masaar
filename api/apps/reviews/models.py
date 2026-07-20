from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel


class Review(TimeStampedModel):
    """A public student→teacher rating left after a completed lesson."""

    booking = models.OneToOneField(
        "bookings.Booking", on_delete=models.CASCADE, related_name="review"
    )
    student = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="reviews_written"
    )
    teacher = models.ForeignKey(
        "teachers.TeacherProfile", on_delete=models.CASCADE, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    text = models.TextField(blank=True)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rating}★ {self.student} → {self.teacher}"
