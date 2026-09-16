from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .countries import DIAL_CODES, NAMES_AR
from .models import Market


class MarketSerializer(serializers.ModelSerializer):
    name_ar = serializers.SerializerMethodField()
    dial_code = serializers.SerializerMethodField()

    class Meta:
        model = Market
        fields = ("code", "name", "name_ar", "currency", "timezone", "dial_code")

    def get_name_ar(self, obj) -> str:
        return NAMES_AR.get(obj.code, obj.name)

    def get_dial_code(self, obj) -> str:
        return f"+{DIAL_CODES[obj.code]}" if obj.code in DIAL_CODES else ""


class MarketListView(ListAPIView):
    """Public list of active country markets (drives the country pickers)."""

    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = MarketSerializer
    queryset = Market.objects.filter(is_active=True).order_by("name")
