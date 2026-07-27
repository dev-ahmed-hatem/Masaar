"""Staff-facing catalog/pricing management (`/api/admin/lesson-categories/`)."""
from rest_framework import serializers
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView

from apps.accounts.permissions import IsStaff
from apps.markets.models import Market

from .models import LessonCategory


class LessonCategoryAdminSerializer(serializers.ModelSerializer):
    market = serializers.SlugRelatedField(slug_field="code", queryset=Market.objects.all())
    label = serializers.SerializerMethodField()
    label_ar = serializers.SerializerMethodField()

    class Meta:
        model = LessonCategory
        fields = (
            "id",
            "market",
            "vertical",
            "grade_level",
            "subject",
            "label",
            "label_ar",
            "student_price_minor",
            "teacher_wage_minor",
            "currency",
            "is_active",
        )
        read_only_fields = ("id", "label", "label_ar", "currency")
        extra_kwargs = {"grade_level": {"required": False, "allow_null": True}}

    def get_label(self, obj) -> str:
        parts = [obj.vertical.name_en, obj.grade_level.name_en if obj.grade_level else None, obj.subject.name_en]
        return " · ".join(p for p in parts if p)

    def get_label_ar(self, obj) -> str:
        parts = [obj.vertical.name_ar, obj.grade_level.name_ar if obj.grade_level else None, obj.subject.name_ar]
        return " · ".join(p for p in parts if p)

    def validate(self, attrs):
        student = attrs.get("student_price_minor", getattr(self.instance, "student_price_minor", None))
        wage = attrs.get("teacher_wage_minor", getattr(self.instance, "teacher_wage_minor", None))
        if student is not None and wage is not None and wage > student:
            raise serializers.ValidationError(
                {"teacher_wage_minor": "Teacher wage cannot exceed the student price."}
            )
        return attrs

    def create(self, validated):
        # Currency is always the market's currency.
        validated["currency"] = validated["market"].currency
        return super().create(validated)


class LessonCategoryAdminListCreateView(ListCreateAPIView):
    permission_classes = [IsStaff]
    serializer_class = LessonCategoryAdminSerializer

    def get_queryset(self):
        qs = LessonCategory.objects.select_related(
            "market", "vertical", "grade_level", "subject"
        ).order_by("market__code", "vertical__order", "grade_level__order", "subject__name_en")
        params = self.request.query_params
        if market := params.get("market"):
            qs = qs.filter(market__code=market.upper())
        if vertical := params.get("vertical"):
            qs = qs.filter(vertical_id=vertical)
        if subject := params.get("subject"):
            qs = qs.filter(subject_id=subject)
        if (active := params.get("active")) is not None:
            qs = qs.filter(is_active=active.lower() == "true")
        return qs


class LessonCategoryAdminDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsStaff]
    serializer_class = LessonCategoryAdminSerializer
    queryset = LessonCategory.objects.select_related("market", "vertical", "grade_level", "subject")
