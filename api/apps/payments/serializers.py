from rest_framework import serializers

from apps.common.models import format_money

from .models import LedgerEntry, Wallet


class LedgerEntrySerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(source="booking.id", read_only=True, default=None)

    class Meta:
        model = LedgerEntry
        fields = (
            "id",
            "kind",
            "amount_minor",
            "balance_after_minor",
            "booking_id",
            "note",
            "created_at",
        )


class WalletSerializer(serializers.ModelSerializer):
    available_display = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = (
            "currency",
            "available_minor",
            "reserved_minor",
            "available_display",
        )

    def get_available_display(self, obj) -> str:
        return format_money(obj.available_minor, obj.currency)
