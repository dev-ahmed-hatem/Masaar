"""Payout cycle generation and settlement.

A cycle sweeps all *settled-but-unpaid* lessons for a market (bookings whose
teacher wage has settled and that aren't yet attached to a payout item), groups
them per teacher into `PayoutItem`s, and links each booking so it is never paid
twice. `period_start`/`period_end` are labels for the statement.
"""
from django.db import transaction
from django.utils import timezone

from apps.bookings.models import Booking

from .models import PayoutCycle, PayoutItem


@transaction.atomic
def generate_cycle(market, period_start, period_end, created_by=None) -> PayoutCycle:
    cycle = PayoutCycle.objects.create(
        market=market,
        period_start=period_start,
        period_end=period_end,
        created_by=created_by,
    )
    payable = (
        Booking.objects.filter(
            teacher__market=market, wage_settled=True, payout_item__isnull=True
        )
        .select_related("teacher")
    )

    # Group by teacher.
    by_teacher: dict[int, dict] = {}
    for booking in payable:
        bucket = by_teacher.setdefault(
            booking.teacher_id, {"teacher": booking.teacher, "amount": 0, "count": 0, "ids": []}
        )
        bucket["amount"] += booking.teacher_wage_minor
        bucket["count"] += 1
        bucket["ids"].append(booking.id)

    for bucket in by_teacher.values():
        item = PayoutItem.objects.create(
            cycle=cycle,
            teacher=bucket["teacher"],
            amount_minor=bucket["amount"],
            currency=market.currency,
            lessons_count=bucket["count"],
        )
        Booking.objects.filter(id__in=bucket["ids"]).update(payout_item=item)

    return cycle


@transaction.atomic
def mark_item_paid(item, reference="") -> PayoutItem:
    item.status = PayoutItem.Status.PAID
    item.paid_at = timezone.now()
    item.reference = reference
    item.save(update_fields=["status", "paid_at", "reference", "updated_at"])

    # When every item is paid, close the cycle.
    cycle = item.cycle
    if not cycle.items.exclude(status=PayoutItem.Status.PAID).exists():
        cycle.status = PayoutCycle.Status.PAID
        cycle.save(update_fields=["status", "updated_at"])
    elif cycle.status == PayoutCycle.Status.OPEN:
        cycle.status = PayoutCycle.Status.PROCESSING
        cycle.save(update_fields=["status", "updated_at"])
    return item
