from django.urls import path

from .views import (
    PackageListView,
    PackagePurchaseListView,
    PackagePurchaseView,
    PaymentAccountListView,
    ReceiptApproveView,
    ReceiptDetailView,
    ReceiptListCreateView,
    ReceiptRejectView,
    WalletView,
)

app_name = "payments"

urlpatterns = [
    path("wallet/", WalletView.as_view(), name="wallet"),
    path("payment-accounts/", PaymentAccountListView.as_view(), name="payment-accounts"),
    path("receipts/", ReceiptListCreateView.as_view(), name="receipts"),
    path("receipts/<int:pk>/", ReceiptDetailView.as_view(), name="receipt-detail"),
    path("receipts/<int:pk>/approve/", ReceiptApproveView.as_view(), name="receipt-approve"),
    path("receipts/<int:pk>/reject/", ReceiptRejectView.as_view(), name="receipt-reject"),
    path("packages/", PackageListView.as_view(), name="packages"),
    path("packages/<int:pk>/purchase/", PackagePurchaseView.as_view(), name="package-purchase"),
    path("package-purchases/", PackagePurchaseListView.as_view(), name="package-purchases"),
]
