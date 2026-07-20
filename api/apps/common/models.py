from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base with created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


def format_money(amount_minor: int, currency: str) -> str:
    """Render integer minor units as a human string, e.g. 6000, 'EGP' -> '60.00 EGP'."""
    return f"{amount_minor / 100:.2f} {currency}"
