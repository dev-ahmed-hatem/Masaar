"""Staff-facing catalog/pricing management (`/api/admin/`)."""
from rest_framework import serializers
from rest_framework.generics import (
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)

from apps.accounts.permissions import IsStaff
from apps.common.staff import ProtectedDestroyMixin
from apps.markets.models import Market

from .models import (
    LessonCategory,
    StageGroup,
    StagePricingRule,
    StageSubject,
    Subject,
    Track,
    Vertical,
)
from .serializers import StageGroupSerializer


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
            "is_active",
        )
        read_only_fields = ("id", "label", "label_ar")
        extra_kwargs = {"grade_level": {"required": False, "allow_null": True}}

    def get_label(self, obj) -> str:
        parts = [obj.vertical.name_en, obj.grade_level.name_en if obj.grade_level else None, obj.subject.name_en]
        return " · ".join(p for p in parts if p)

    def get_label_ar(self, obj) -> str:
        parts = [obj.vertical.name_ar, obj.grade_level.name_ar if obj.grade_level else None, obj.subject.name_ar]
        return " · ".join(p for p in parts if p)


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


# --- Stage pricing rules: per-market price band + platform commission ------


class StagePricingRuleAdminSerializer(serializers.ModelSerializer):
    market = serializers.SlugRelatedField(slug_field="code", queryset=Market.objects.all())
    stage_name_en = serializers.CharField(source="vertical.name_en", read_only=True)
    stage_name_ar = serializers.CharField(source="vertical.name_ar", read_only=True)
    currency = serializers.CharField(read_only=True)

    class Meta:
        model = StagePricingRule
        fields = (
            "id",
            "market",
            "vertical",
            "stage_name_en",
            "stage_name_ar",
            "min_price_minor",
            "max_price_minor",
            "commission_pct",
            "currency",
            "is_active",
        )
        read_only_fields = ("id", "stage_name_en", "stage_name_ar", "currency")
        extra_kwargs = {"max_price_minor": {"required": False, "allow_null": True}}

    def validate_min_price_minor(self, value):
        if value < 0:
            raise serializers.ValidationError("Minimum price cannot be negative.")
        return value

    def validate_max_price_minor(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Maximum price must be greater than zero.")
        return value

    def validate_commission_pct(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Commission must be between 0 and 100.")
        return value

    def validate(self, attrs):
        """The band has to be a band: a set maximum may not sit below the minimum.

        On a PATCH only one of the two is usually sent, so the other comes from
        the instance.
        """
        minimum = attrs.get("min_price_minor", getattr(self.instance, "min_price_minor", None))
        maximum = attrs.get("max_price_minor", getattr(self.instance, "max_price_minor", None))
        if maximum is not None and minimum is not None and maximum < minimum:
            raise serializers.ValidationError(
                {"max_price_minor": "Maximum price cannot be below the minimum price."}
            )
        return attrs


class StagePricingRuleAdminListCreateView(ListCreateAPIView):
    permission_classes = [IsStaff]
    serializer_class = StagePricingRuleAdminSerializer

    def get_queryset(self):
        qs = StagePricingRule.objects.select_related("market", "vertical").order_by(
            "market__code", "vertical__order"
        )
        if market := self.request.query_params.get("market"):
            qs = qs.filter(market__code=market.upper())
        return qs


class StagePricingRuleAdminDetailView(ProtectedDestroyMixin, RetrieveUpdateDestroyAPIView):
    permission_classes = [IsStaff]
    serializer_class = StagePricingRuleAdminSerializer
    queryset = StagePricingRule.objects.select_related("market", "vertical")


# --- Taxonomy management: Stage / Track / Subject / StageSubject -----------


class StageGroupAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageGroup
        fields = ("id", "code", "name_en", "name_ar", "order", "is_active")


class StageAdminSerializer(serializers.ModelSerializer):
    # Read the group nested (same shape as the public stage list, so the web
    # client keeps one Stage type) and write it by id.
    group = StageGroupSerializer(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(
        source="group",
        queryset=StageGroup.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Vertical
        fields = (
            "id",
            "code",
            "name_en",
            "name_ar",
            "group",
            "group_id",
            "child_kind",
            "child_label_en",
            "child_label_ar",
            "order",
            "is_active",
        )

    def validate(self, attrs):
        kind = attrs.get("child_kind", getattr(self.instance, "child_kind", None))
        if kind == Vertical.ChildKind.GROUPED:
            for field in ("child_label_en", "child_label_ar"):
                value = attrs.get(field, getattr(self.instance, field, ""))
                if not (value or "").strip():
                    raise serializers.ValidationError(
                        {field: "A custom grouping needs a name in both languages."}
                    )
        return attrs


class TrackAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Track
        fields = ("id", "vertical", "name_en", "name_ar", "order", "is_active")


class SubjectAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ("id", "name_en", "name_ar", "is_active")


class StageSubjectAdminSerializer(serializers.ModelSerializer):
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    subject_name_ar = serializers.CharField(source="subject.name_ar", read_only=True)

    class Meta:
        model = StageSubject
        fields = (
            "id",
            "vertical",
            "track",
            "subject",
            "subject_name_en",
            "subject_name_ar",
            "order",
            "is_active",
        )
        extra_kwargs = {"track": {"required": False, "allow_null": True}}

    def validate(self, attrs):
        vertical = attrs.get("vertical") or getattr(self.instance, "vertical", None)
        track = attrs.get("track", getattr(self.instance, "track", None))
        if track is not None and track.vertical_id != vertical.id:
            raise serializers.ValidationError({"track": "Track belongs to a different stage."})
        return attrs


class StageGroupAdminListCreateView(ListCreateAPIView):
    permission_classes = [IsStaff]
    serializer_class = StageGroupAdminSerializer
    queryset = StageGroup.objects.all().order_by("order")


class StageGroupAdminDetailView(ProtectedDestroyMixin, RetrieveUpdateDestroyAPIView):
    permission_classes = [IsStaff]
    serializer_class = StageGroupAdminSerializer
    queryset = StageGroup.objects.all()


class StageAdminListCreateView(ListCreateAPIView):
    permission_classes = [IsStaff]
    serializer_class = StageAdminSerializer
    queryset = Vertical.objects.select_related("group").order_by("order")


class StageAdminDetailView(ProtectedDestroyMixin, RetrieveUpdateDestroyAPIView):
    permission_classes = [IsStaff]
    serializer_class = StageAdminSerializer
    queryset = Vertical.objects.select_related("group")


class TrackAdminListCreateView(ListCreateAPIView):
    permission_classes = [IsStaff]
    serializer_class = TrackAdminSerializer

    def get_queryset(self):
        qs = Track.objects.select_related("vertical").order_by("vertical__order", "order")
        if vertical := self.request.query_params.get("vertical"):
            qs = qs.filter(vertical_id=vertical)
        return qs


class TrackAdminDetailView(ProtectedDestroyMixin, RetrieveUpdateDestroyAPIView):
    permission_classes = [IsStaff]
    serializer_class = TrackAdminSerializer
    queryset = Track.objects.all()


class SubjectAdminListCreateView(ListCreateAPIView):
    permission_classes = [IsStaff]
    serializer_class = SubjectAdminSerializer
    queryset = Subject.objects.all().order_by("name_en")


class SubjectAdminDetailView(ProtectedDestroyMixin, RetrieveUpdateDestroyAPIView):
    permission_classes = [IsStaff]
    serializer_class = SubjectAdminSerializer
    queryset = Subject.objects.all()


class StageSubjectAdminListCreateView(ListCreateAPIView):
    permission_classes = [IsStaff]
    serializer_class = StageSubjectAdminSerializer

    def get_queryset(self):
        qs = StageSubject.objects.select_related("vertical", "track", "subject").order_by(
            "vertical__order", "track__order", "order", "subject__name_en"
        )
        params = self.request.query_params
        if vertical := params.get("vertical"):
            qs = qs.filter(vertical_id=vertical)
        if track := params.get("track"):
            qs = qs.filter(track_id=track)
        return qs


class StageSubjectAdminDetailView(ProtectedDestroyMixin, RetrieveUpdateDestroyAPIView):
    permission_classes = [IsStaff]
    serializer_class = StageSubjectAdminSerializer
    queryset = StageSubject.objects.all()
