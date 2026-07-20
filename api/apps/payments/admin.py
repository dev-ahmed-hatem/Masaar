from django.contrib import admin

from .models import LedgerEntry, Package, PackagePurchase, Receipt, Wallet


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    """Moderator receipt-verification queue."""

    list_display = (
        "id",
        "user",
        "market",
        "amount_minor",
        "currency",
        "purpose",
        "method",
        "status",
        "created_at",
    )
    list_filter = ("status", "purpose", "method", "market")
    search_fields = ("user__phone", "reference")
    date_hierarchy = "created_at"


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("user", "market", "available_minor", "reserved_minor", "currency")
    search_fields = ("user__phone",)


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "wallet", "kind", "amount_minor", "balance_after_minor", "created_at")
    list_filter = ("kind",)
    date_hierarchy = "created_at"


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("name", "market", "credits", "price_minor", "currency", "is_active")
    list_filter = ("market", "is_active")


@admin.register(PackagePurchase)
class PackagePurchaseAdmin(admin.ModelAdmin):
    list_display = ("student", "package", "status", "credits_granted", "created_at")
    list_filter = ("status",)
