from django.urls import path

from .staff_views import PaymentAccountAdminDetailView, PaymentAccountAdminListCreateView

app_name = "markets_staff"

urlpatterns = [
    path("payment-accounts/", PaymentAccountAdminListCreateView.as_view(), name="payment-accounts"),
    path(
        "payment-accounts/<int:pk>/",
        PaymentAccountAdminDetailView.as_view(),
        name="payment-account-detail",
    ),
]
