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

from apps.common.models import format_money
from apps.markets.models import Market
from apps.notifications.services import notify

from . import errors
from .models import LedgerEntry, PackagePurchase, Receipt, Wallet


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


# --- Manual-payment receipts ----------------------------------------------

@transaction.atomic
def approve_receipt(receipt, moderator):
    """Verify a receipt and apply its effect. All funding flows credit the
    wallet (credits = wallet money); a PACKAGE receipt also grants its purchase."""
    if receipt.status != Receipt.Status.PENDING:
        raise errors.ReceiptNotPending()

    wallet_obj = get_or_create_wallet(receipt.user)
    if receipt.purpose == Receipt.Purpose.PACKAGE:
        purchase = PackagePurchase.objects.select_related("package").get(receipt=receipt)
        credit(
            wallet_obj, receipt.amount_minor,
            kind=LedgerEntry.Kind.PACKAGE_GRANT, created_by=moderator,
            note=f"Package: {purchase.package.name}", receipt=receipt,
        )
        purchase.status = PackagePurchase.Status.GRANTED
        purchase.credits_granted = purchase.package.credits
        purchase.save(update_fields=["status", "credits_granted", "updated_at"])
    else:
        # TOPUP and pay-per-BOOKING both add spendable funds.
        note = "Booking payment approved" if receipt.purpose == Receipt.Purpose.BOOKING else "Top-up receipt approved"
        credit(
            wallet_obj, receipt.amount_minor,
            kind=LedgerEntry.Kind.TOPUP, created_by=moderator, note=note, receipt=receipt,
        )

    receipt.status = Receipt.Status.APPROVED
    receipt.reviewed_by = moderator
    receipt.save(update_fields=["status", "reviewed_by", "updated_at"])
    notify(
        receipt.user, "receipt_approved",
        {"amount": format_money(receipt.amount_minor, receipt.currency)},
    )
    return receipt


@transaction.atomic
def reject_receipt(receipt, moderator, reason=""):
    if receipt.status != Receipt.Status.PENDING:
        raise errors.ReceiptNotPending()
    receipt.status = Receipt.Status.REJECTED
    receipt.reviewed_by = moderator
    receipt.reject_reason = reason
    receipt.save(update_fields=["status", "reviewed_by", "reject_reason", "updated_at"])
    if receipt.purpose == Receipt.Purpose.PACKAGE:
        PackagePurchase.objects.filter(receipt=receipt).update(
            status=PackagePurchase.Status.REJECTED
        )
    notify(receipt.user, "receipt_rejected", {"reason": reason or "See details."})
    return receipt
