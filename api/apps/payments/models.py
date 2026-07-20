from django.db import models

from apps.common.models import TimeStampedModel


class Wallet(TimeStampedModel):
    """A student's prepaid balance in a single market currency."""

    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="wallet"
    )
    market = models.ForeignKey(
        "markets.Market", on_delete=models.PROTECT, related_name="wallets"
    )
    currency = models.CharField(max_length=3)
    available_minor = models.IntegerField(default=0)
    reserved_minor = models.IntegerField(default=0)

    def __str__(self):
        return f"Wallet({self.user}) {self.available_minor}/{self.reserved_minor} {self.currency}"


class Receipt(TimeStampedModel):
    """A manual-payment receipt uploaded by a student, verified by moderators."""

    class Method(models.TextChoices):
        BANK = "BANK", "Bank transfer"
        WALLET = "WALLET", "Mobile wallet"

    class Purpose(models.TextChoices):
        TOPUP = "TOPUP", "Wallet top-up"
        BOOKING = "BOOKING", "Pay per booking"
        PACKAGE = "PACKAGE", "Package purchase"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    user = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="receipts"
    )
    market = models.ForeignKey(
        "markets.Market", on_delete=models.PROTECT, related_name="receipts"
    )
    amount_minor = models.IntegerField()
    currency = models.CharField(max_length=3)
    method = models.CharField(max_length=10, choices=Method.choices)
    reference = models.CharField(max_length=120, blank=True)
    image = models.FileField(upload_to="receipts/", null=True, blank=True)
    purpose = models.CharField(max_length=10, choices=Purpose.choices)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="receipts",
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_receipts",
    )
    reject_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Receipt #{self.pk} {self.amount_minor} {self.currency} [{self.status}]"


class LedgerEntry(TimeStampedModel):
    """Append-only wallet ledger. amount_minor is signed (+credit / -debit)."""

    class Kind(models.TextChoices):
        TOPUP = "TOPUP", "Top-up"
        RESERVE = "RESERVE", "Reserve"
        CAPTURE = "CAPTURE", "Capture (settlement)"
        REFUND = "REFUND", "Refund"
        PACKAGE_GRANT = "PACKAGE_GRANT", "Package grant"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    wallet = models.ForeignKey(
        Wallet, on_delete=models.CASCADE, related_name="entries"
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    amount_minor = models.IntegerField()
    balance_after_minor = models.IntegerField()
    booking = models.ForeignKey(
        "bookings.Booking",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    receipt = models.ForeignKey(
        Receipt,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Ledger entries"

    def __str__(self):
        return f"{self.kind} {self.amount_minor} (wallet {self.wallet_id})"


class Package(TimeStampedModel):
    """A predefined bundle of lesson credits sold in a market."""

    market = models.ForeignKey(
        "markets.Market", on_delete=models.CASCADE, related_name="packages"
    )
    name = models.CharField(max_length=120)
    credits = models.PositiveSmallIntegerField(help_text="Number of lessons")
    price_minor = models.IntegerField()
    currency = models.CharField(max_length=3)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.credits} lessons)"


class PackagePurchase(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        GRANTED = "GRANTED", "Granted"
        REJECTED = "REJECTED", "Rejected"

    student = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="package_purchases"
    )
    package = models.ForeignKey(
        Package, on_delete=models.PROTECT, related_name="purchases"
    )
    receipt = models.ForeignKey(
        Receipt,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="package_purchases",
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    credits_granted = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f"{self.student} · {self.package} [{self.status}]"
