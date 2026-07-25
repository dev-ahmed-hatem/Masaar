from rest_framework import serializers

from apps.common.models import format_money
from apps.markets.models import PaymentAccount

from .models import LedgerEntry, Receipt, Wallet


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


class PaymentAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAccount
        fields = ("id", "kind", "display_name", "details", "instructions", "sort_order")


class ReceiptSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_phone = serializers.CharField(source="user.phone", read_only=True)
    market = serializers.SlugRelatedField(slug_field="code", read_only=True)
    reviewed_by = serializers.CharField(source="reviewed_by.full_name", read_only=True, default=None)
    amount_display = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = (
            "id",
            "user_name",
            "user_phone",
            "market",
            "amount_minor",
            "amount_display",
            "currency",
            "method",
            "reference",
            "image",
            "purpose",
            "status",
            "reject_reason",
            "reviewed_by",
            "created_at",
        )
        read_only_fields = fields

    def get_amount_display(self, obj) -> str:
        return format_money(obj.amount_minor, obj.currency)


class ReceiptCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ("amount_minor", "method", "reference", "image")
        extra_kwargs = {
            "amount_minor": {"min_value": 1},
            "reference": {"required": False},
            "image": {"required": False},
        }
