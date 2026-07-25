from rest_framework import serializers

from apps.common.models import format_money
from apps.markets.models import Market

from .models import PayoutCycle, PayoutItem


class PayoutItemSerializer(serializers.ModelSerializer):
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    teacher_name = serializers.CharField(source="teacher.user.full_name", read_only=True)
    amount_display = serializers.SerializerMethodField()

    class Meta:
        model = PayoutItem
        fields = (
            "id",
            "teacher_id",
            "teacher_name",
            "amount_minor",
            "amount_display",
            "currency",
            "lessons_count",
            "status",
            "paid_at",
            "reference",
        )
        read_only_fields = fields

    def get_amount_display(self, obj) -> str:
        return format_money(obj.amount_minor, obj.currency)


class PayoutCycleSerializer(serializers.ModelSerializer):
    market = serializers.SlugRelatedField(slug_field="code", read_only=True)
    items_count = serializers.IntegerField(source="items.count", read_only=True)
    total_minor = serializers.SerializerMethodField()

    class Meta:
        model = PayoutCycle
        fields = (
            "id",
            "market",
            "period_start",
            "period_end",
            "status",
            "items_count",
            "total_minor",
            "created_at",
        )
        read_only_fields = fields

    def get_total_minor(self, obj) -> int:
        return sum(item.amount_minor for item in obj.items.all())


class PayoutCycleDetailSerializer(PayoutCycleSerializer):
    items = PayoutItemSerializer(many=True, read_only=True)

    class Meta(PayoutCycleSerializer.Meta):
        fields = PayoutCycleSerializer.Meta.fields + ("items",)


class GenerateCycleSerializer(serializers.Serializer):
    market = serializers.SlugRelatedField(slug_field="code", queryset=Market.objects.all())
    period_start = serializers.DateField()
    period_end = serializers.DateField()


class MarkPaidSerializer(serializers.Serializer):
    reference = serializers.CharField(required=False, allow_blank=True, default="")
