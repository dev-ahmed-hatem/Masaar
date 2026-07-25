from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsStaff, IsStudent
from apps.markets.models import PaymentAccount

from . import services
from .models import LedgerEntry, Package, PackagePurchase, Receipt
from .serializers import (
    LedgerEntrySerializer,
    PackagePurchaseCreateSerializer,
    PackagePurchaseSerializer,
    PackageSerializer,
    PaymentAccountSerializer,
    ReceiptCreateSerializer,
    ReceiptSerializer,
    WalletSerializer,
)


class WalletView(APIView):
    """The authenticated student's wallet balance and recent ledger."""

    permission_classes = [IsStudent]

    def get(self, request):
        wallet = services.get_or_create_wallet(request.user)
        entries = LedgerEntry.objects.filter(wallet=wallet).select_related("booking")[:25]
        return Response(
            {
                "wallet": WalletSerializer(wallet).data,
                "ledger": LedgerEntrySerializer(entries, many=True).data,
            }
        )


class PaymentAccountListView(ListAPIView):
    """Active platform payment accounts for the student's market."""

    permission_classes = [IsStudent]
    pagination_class = None
    serializer_class = PaymentAccountSerializer

    def get_queryset(self):
        return PaymentAccount.objects.filter(
            market=self.request.user.market, is_active=True
        )


class ReceiptListCreateView(ListCreateAPIView):
    """Students upload receipts (GET own); moderators see the verification queue."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStudent()]
        return [IsStaff() if self._is_staff() else IsStudent()]

    def _is_staff(self):
        user = self.request.user
        return user.is_authenticated and user.role in (
            User.Role.MODERATOR, User.Role.SUPERADMIN,
        )

    def get_serializer_class(self):
        return ReceiptCreateSerializer if self.request.method == "POST" else ReceiptSerializer

    def get_queryset(self):
        qs = Receipt.objects.select_related("user", "market", "reviewed_by")
        if not self._is_staff():
            qs = qs.filter(user=self.request.user)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ReceiptCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        market = request.user.market
        receipt = serializer.save(user=request.user, market=market, currency=market.currency)
        return Response(ReceiptSerializer(receipt, context={"request": request}).data, status=201)


class PackageListView(ListAPIView):
    """Active lesson packages for the student's market."""

    permission_classes = [IsStudent]
    pagination_class = None
    serializer_class = PackageSerializer

    def get_queryset(self):
        return Package.objects.filter(market=self.request.user.market, is_active=True)


class PackagePurchaseListView(ListAPIView):
    permission_classes = [IsStudent]
    pagination_class = None
    serializer_class = PackagePurchaseSerializer

    def get_queryset(self):
        return PackagePurchase.objects.filter(student=self.request.user).select_related(
            "package", "receipt"
        )


class PackagePurchaseView(APIView):
    """Buy a package: creates a pending purchase + its PACKAGE receipt to verify."""

    permission_classes = [IsStudent]

    def post(self, request, pk):
        package = get_object_or_404(Package, pk=pk, is_active=True)
        if package.market_id != request.user.market_id:
            raise ValidationError({"package": "This package is not available in your market."})
        serializer = PackagePurchaseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        receipt = Receipt.objects.create(
            user=request.user,
            market=package.market,
            amount_minor=package.price_minor,
            currency=package.currency,
            method=data["method"],
            reference=data.get("reference", ""),
            image=data.get("image"),
            purpose=Receipt.Purpose.PACKAGE,
        )
        purchase = PackagePurchase.objects.create(
            student=request.user, package=package, receipt=receipt,
        )
        return Response(PackagePurchaseSerializer(purchase).data, status=201)


class ReceiptDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk):
        receipt = get_object_or_404(Receipt.objects.select_related("user", "market", "reviewed_by"), pk=pk)
        return Response(ReceiptSerializer(receipt, context={"request": request}).data)


class ReceiptApproveView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk):
        receipt = get_object_or_404(Receipt, pk=pk)
        services.approve_receipt(receipt, request.user)
        return Response(ReceiptSerializer(receipt, context={"request": request}).data)


class ReceiptRejectView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk):
        receipt = get_object_or_404(Receipt, pk=pk)
        reason = request.data.get("reason", "")
        services.reject_receipt(receipt, request.user, reason)
        return Response(ReceiptSerializer(receipt, context={"request": request}).data)
