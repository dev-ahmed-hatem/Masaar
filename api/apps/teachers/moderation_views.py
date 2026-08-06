"""Moderator review of teacher custom-price requests (`/api/price-requests/`)."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStaff
from apps.common.models import format_money
from apps.notifications.services import notify

from .models import TeacherPrice


class PriceRequestSerializer(serializers.ModelSerializer):
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    teacher_name = serializers.CharField(source="teacher.user.full_name", read_only=True)
    market = serializers.CharField(source="lesson_category.market.code", read_only=True)
    label = serializers.SerializerMethodField()
    default_price_minor = serializers.IntegerField(
        source="lesson_category.student_price_minor", read_only=True
    )
    currency = serializers.CharField(source="lesson_category.currency", read_only=True)

    class Meta:
        model = TeacherPrice
        fields = (
            "id",
            "teacher_id",
            "teacher_name",
            "market",
            "label",
            "default_price_minor",
            "custom_student_price_minor",
            "currency",
            "is_approved",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_label(self, obj) -> str:
        cat = obj.lesson_category
        parts = [cat.vertical.name_en, cat.grade_level.name_en if cat.grade_level else None, cat.subject.name_en]
        return " · ".join(p for p in parts if p)


_QS = TeacherPrice.objects.select_related(
    "teacher__user",
    "lesson_category__market",
    "lesson_category__vertical",
    "lesson_category__grade_level",
    "lesson_category__subject",
)


class PriceRequestListView(ListAPIView):
    """Pending (default) or approved custom-price requests."""

    permission_classes = [IsStaff]
    serializer_class = PriceRequestSerializer

    @extend_schema(parameters=[OpenApiParameter("status", str), OpenApiParameter("market", str)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        qs = _QS.order_by("-updated_at")
        status_param = (self.request.query_params.get("status") or "pending").lower()
        if status_param == "pending":
            qs = qs.filter(is_approved=False)
        elif status_param == "approved":
            qs = qs.filter(is_approved=True)
        if market := self.request.query_params.get("market"):
            qs = qs.filter(lesson_category__market__code=market.upper())
        return qs


class PriceRequestApproveView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk):
        price = get_object_or_404(_QS, pk=pk)
        wage = price.lesson_category.teacher_wage_minor
        if price.custom_student_price_minor < wage:
            raise serializers.ValidationError(
                f"Custom price is below the teacher wage ({wage}); reject and ask for a new price."
            )
        if not price.is_approved:
            price.is_approved = True
            price.save(update_fields=["is_approved", "updated_at"])
            notify(
                price.teacher.user,
                "price_request_approved",
                {
                    "amount": format_money(
                        price.custom_student_price_minor, price.lesson_category.currency
                    )
                },
            )
        return Response(PriceRequestSerializer(price).data)


class PriceRequestRejectView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk):
        price = get_object_or_404(_QS.filter(is_approved=False), pk=pk)
        reason = (request.data.get("reason") or "").strip()
        notify(price.teacher.user, "price_request_rejected", {"reason": reason or "—"})
        price.delete()
        return Response({"deleted": True})
