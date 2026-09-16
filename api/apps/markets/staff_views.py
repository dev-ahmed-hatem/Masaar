"""Staff management of the payment accounts students pay into (`/api/admin/`)."""
from rest_framework import serializers
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView

from apps.accounts.permissions import IsStaff
from apps.common.staff import ProtectedDestroyMixin

from .models import Market, PaymentAccount


class PaymentAccountAdminSerializer(serializers.ModelSerializer):
    market = serializers.SlugRelatedField(slug_field="code", queryset=Market.objects.all())

    class Meta:
        model = PaymentAccount
        fields = (
            "id",
            "market",
            "kind",
            "display_name",
            "details",
            "instructions",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_display_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("A name is required.")
        return value

    def validate_details(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Account details are required.")
        return value


class PaymentAccountAdminListCreateView(ListCreateAPIView):
    """All payment accounts (filter `?market=EG`, `?active=true|false`); POST adds one."""

    permission_classes = [IsStaff]
    serializer_class = PaymentAccountAdminSerializer
    pagination_class = None

    def get_queryset(self):
        qs = PaymentAccount.objects.select_related("market").order_by("market__code", "sort_order", "id")
        params = self.request.query_params
        if market := params.get("market"):
            qs = qs.filter(market__code=market.upper())
        if (active := params.get("active")) in ("true", "false"):
            qs = qs.filter(is_active=active == "true")
        return qs


class PaymentAccountAdminDetailView(ProtectedDestroyMixin, RetrieveUpdateDestroyAPIView):
    """Edit / deactivate / delete an account (delete is refused once receipts use it)."""

    permission_classes = [IsStaff]
    serializer_class = PaymentAccountAdminSerializer
    queryset = PaymentAccount.objects.select_related("market")
