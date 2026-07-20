from django.db import models

from apps.common.models import TimeStampedModel


class PayoutCycle(TimeStampedModel):
    """A scheduled (e.g. monthly) batch payout run for a market."""

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        PROCESSING = "PROCESSING", "Processing"
        PAID = "PAID", "Paid"

    market = models.ForeignKey(
        "markets.Market", on_delete=models.PROTECT, related_name="payout_cycles"
    )
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    created_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payout_cycles",
    )

    class Meta:
        ordering = ["-period_start"]

    def __str__(self):
        return f"Payout {self.market.code} {self.period_start}–{self.period_end} [{self.status}]"


class PayoutItem(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"

    cycle = models.ForeignKey(
        PayoutCycle, on_delete=models.CASCADE, related_name="items"
    )
    teacher = models.ForeignKey(
        "teachers.TeacherProfile", on_delete=models.PROTECT, related_name="payout_items"
    )
    amount_minor = models.IntegerField()
    currency = models.CharField(max_length=3)
    lessons_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    paid_at = models.DateTimeField(null=True, blank=True)
    reference = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return f"{self.teacher} · {self.amount_minor} {self.currency} [{self.status}]"
