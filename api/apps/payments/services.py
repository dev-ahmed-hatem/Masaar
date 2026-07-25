"""Wallet operations backed by an append-only ledger.

Wallet semantics
----------------
- ``available_minor`` is the student's spendable balance; ``reserved_minor`` is
  held against pending/confirmed bookings.
- ``LedgerEntry.balance_after_minor`` is the resulting ``available_minor`` (the
  authoritative record of the spendable balance after each entry).
- A RESERVE moves funds from available to reserved; a REFUND moves them back; a
  CAPTURE settles reserved funds out of the wallet (they do not return to
  available, which is why a CAPTURE leaves ``available_minor`` unchanged).
"""
from django.db import transaction

from apps.markets.models import Market

from . import errors
from .models import LedgerEntry, Wallet


def get_or_create_wallet(user) -> Wallet:
    market: Market = user.market
    wallet, _ = Wallet.objects.get_or_create(
        user=user,
        defaults={"market": market, "currency": market.currency},
    )
    return wallet


def _entry(wallet, kind, amount_minor, *, booking=None, created_by=None, note=""):
    return LedgerEntry.objects.create(
        wallet=wallet,
        kind=kind,
        amount_minor=amount_minor,
        balance_after_minor=wallet.available_minor,
        booking=booking,
        created_by=created_by,
        note=note,
    )


@transaction.atomic
def credit(wallet, amount_minor, *, kind=LedgerEntry.Kind.TOPUP, created_by=None, note="", receipt=None):
    """Add spendable funds (top-up / package grant / positive adjustment)."""
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
    wallet.available_minor += amount_minor
    wallet.save(update_fields=["available_minor", "updated_at"])
    entry = _entry(wallet, kind, amount_minor, created_by=created_by, note=note)
    if receipt is not None:
        entry.receipt = receipt
        entry.save(update_fields=["receipt"])
    return wallet


@transaction.atomic
def reserve(wallet, amount_minor, *, booking):
    """Hold funds for a booking: available -> reserved. Raises on shortfall."""
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
    if wallet.available_minor < amount_minor:
        raise errors.InsufficientBalance()
    wallet.available_minor -= amount_minor
    wallet.reserved_minor += amount_minor
    wallet.save(update_fields=["available_minor", "reserved_minor", "updated_at"])
    _entry(wallet, LedgerEntry.Kind.RESERVE, -amount_minor, booking=booking)
    return wallet


@transaction.atomic
def refund(wallet, amount_minor, *, booking, note=""):
    """Release a hold back to spendable: reserved -> available."""
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
    wallet.reserved_minor -= amount_minor
    wallet.available_minor += amount_minor
    wallet.save(update_fields=["available_minor", "reserved_minor", "updated_at"])
    _entry(wallet, LedgerEntry.Kind.REFUND, amount_minor, booking=booking, note=note)
    return wallet


@transaction.atomic
def capture(wallet, amount_minor, *, booking, note=""):
    """Settle a hold out of the wallet (student charged): reserved consumed."""
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
    wallet.reserved_minor -= amount_minor
    wallet.save(update_fields=["reserved_minor", "updated_at"])
    _entry(wallet, LedgerEntry.Kind.CAPTURE, -amount_minor, booking=booking, note=note)
    return wallet
