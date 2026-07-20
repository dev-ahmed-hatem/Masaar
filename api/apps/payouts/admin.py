from django.contrib import admin

from .models import PayoutCycle, PayoutItem


class PayoutItemInline(admin.TabularInline):
    model = PayoutItem
    extra = 0


@admin.register(PayoutCycle)
class PayoutCycleAdmin(admin.ModelAdmin):
    list_display = ("id", "market", "period_start", "period_end", "status")
    list_filter = ("market", "status")
    inlines = [PayoutItemInline]


@admin.register(PayoutItem)
class PayoutItemAdmin(admin.ModelAdmin):
    list_display = ("teacher", "cycle", "amount_minor", "currency", "lessons_count", "status", "paid_at")
    list_filter = ("status", "currency")
