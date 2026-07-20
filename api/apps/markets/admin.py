from django.contrib import admin

from .models import Market, PaymentAccount


@admin.register(Market)
class MarketAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "currency", "timezone", "is_active")
    list_filter = ("is_active",)


@admin.register(PaymentAccount)
class PaymentAccountAdmin(admin.ModelAdmin):
    list_display = ("display_name", "market", "kind", "sort_order", "is_active")
    list_filter = ("market", "kind", "is_active")
    search_fields = ("display_name", "details")
