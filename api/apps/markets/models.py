from django.db import models

from apps.common.models import TimeStampedModel


class Market(TimeStampedModel):
    """A country market — Egypt or Saudi Arabia — with its own currency & timezone."""

    class Code(models.TextChoices):
        EG = "EG", "Egypt"
        SA = "SA", "Saudi Arabia"

    code = models.CharField(max_length=2, choices=Code.choices, unique=True)
    name = models.CharField(max_length=100)
    currency = models.CharField(max_length=3, help_text="ISO 4217, e.g. EGP / SAR")
    timezone = models.CharField(max_length=64, default="UTC")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class PaymentAccount(TimeStampedModel):
    """A bank/wallet account shown to students for manual transfers, per market."""

    class Kind(models.TextChoices):
        BANK = "BANK", "Bank transfer"
        WALLET = "WALLET", "Mobile wallet"

    market = models.ForeignKey(
        Market, on_delete=models.CASCADE, related_name="payment_accounts"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    display_name = models.CharField(max_length=120)
    details = models.TextField(help_text="Account number / IBAN / wallet number shown to students")
    instructions = models.TextField(blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["market", "sort_order"]

    def __str__(self):
        return f"{self.display_name} [{self.market.code}]"
