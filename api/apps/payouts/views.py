from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStaff, IsTeacher

from . import services
from .models import PayoutCycle, PayoutItem
from .serializers import (
    GenerateCycleSerializer,
    MarkPaidSerializer,
    PayoutCycleDetailSerializer,
    PayoutCycleSerializer,
    PayoutItemSerializer,
)


class PayoutCycleListCreateView(ListCreateAPIView):
    """Staff: list payout cycles and generate a new one."""

    permission_classes = [IsStaff]
    serializer_class = PayoutCycleSerializer

    def get_queryset(self):
        qs = PayoutCycle.objects.select_related("market").prefetch_related("items")
        market = self.request.query_params.get("market")
        if market:
            qs = qs.filter(market__code=market.upper())
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    @extend_schema(request=GenerateCycleSerializer, responses={201: PayoutCycleDetailSerializer})
    def post(self, request):
        serializer = GenerateCycleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cycle = services.generate_cycle(
            data["market"], data["period_start"], data["period_end"], created_by=request.user
        )
        return Response(PayoutCycleDetailSerializer(cycle).data, status=201)


class PayoutCycleDetailView(RetrieveAPIView):
    permission_classes = [IsStaff]
    serializer_class = PayoutCycleDetailSerializer
    queryset = PayoutCycle.objects.select_related("market").prefetch_related("items__teacher__user")


class PayoutItemMarkPaidView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk):
        item = get_object_or_404(PayoutItem.objects.select_related("cycle", "teacher__user"), pk=pk)
        serializer = MarkPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.mark_item_paid(item, serializer.validated_data["reference"])
        return Response(PayoutItemSerializer(item).data)


class MyPayoutsView(ListAPIView):
    """A teacher's own payout statement (their items across cycles)."""

    permission_classes = [IsTeacher]
    pagination_class = None
    serializer_class = PayoutItemSerializer

    def get_queryset(self):
        return PayoutItem.objects.filter(
            teacher__user=self.request.user
        ).select_related("teacher__user", "cycle").order_by("-created_at")
