from django.urls import path

from .views import (
    MyPayoutsView,
    PayoutCycleDetailView,
    PayoutCycleListCreateView,
    PayoutItemMarkPaidView,
)

app_name = "payouts"

urlpatterns = [
    path("payout-cycles/", PayoutCycleListCreateView.as_view(), name="cycles"),
    path("payout-cycles/<int:pk>/", PayoutCycleDetailView.as_view(), name="cycle-detail"),
    path("payout-items/<int:pk>/mark-paid/", PayoutItemMarkPaidView.as_view(), name="item-mark-paid"),
    path("my-payouts/", MyPayoutsView.as_view(), name="my-payouts"),
]
