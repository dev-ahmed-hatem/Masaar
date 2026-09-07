"""Serializers for the teacher self-serve API (`/api/teacher/`)."""
from rest_framework import serializers

from apps.catalog.models import LessonCategory, StagePricingRule, StageSubject, Vertical
from apps.catalog.serializers import LessonCategorySerializer

from .models import (
    AvailabilityRule,
    TeacherProfile,
    TeacherSpecialization,
    TeacherStagePrice,
    TeacherSubject,
)


def stage_minimum_minor(market_id, vertical) -> int:
    """The moderator-set minimum lesson price for a stage in a market (0 if unset)."""
    rule = StagePricingRule.objects.filter(
        market_id=market_id, vertical=vertical, is_active=True
    ).first()
    return rule.min_price_minor if rule else 0

# Résumé JSON sections: the string keys allowed on each record. Anything else is
# dropped; every value is coerced to a trimmed string. Records with no content
# are removed. Lengths are capped to keep the payload small and renderable.
_RESUME_KEYS = {
    "education": ("degree", "institution", "start_year", "end_year", "description"),
    "work_experience": ("title", "organization", "start_year", "end_year", "description"),
    "certifications": ("name", "issuer", "year", "description"),
}
_MAX_RECORDS = 20
_MAX_SPECIALTIES = 30
_MAX_FIELD_LEN = 300


def _clean_records(value, keys: tuple[str, ...]) -> list[dict]:
    if not isinstance(value, list):
        raise serializers.ValidationError("Expected a list.")
    cleaned: list[dict] = []
    for item in value[:_MAX_RECORDS]:
        if not isinstance(item, dict):
            raise serializers.ValidationError("Each entry must be an object.")
        record = {k: str(item.get(k, "")).strip()[:_MAX_FIELD_LEN] for k in keys}
        if any(record.values()):
            cleaned.append(record)
    return cleaned


class TeacherProfileSerializer(serializers.ModelSerializer):
    """The authenticated teacher's own, editable profile."""

    market = serializers.SlugRelatedField(slug_field="code", read_only=True)
    full_name = serializers.CharField(source="user.full_name", required=False)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = TeacherProfile
        fields = (
            "id",
            "full_name",
            "market",
            "photo_url",
            "gender",
            "languages",
            "bio_en",
            "bio_ar",
            "intro_video_url",
            "specialties",
            "education",
            "work_experience",
            "certifications",
            "free_lessons_offered",
            "rating_avg",
            "rating_count",
            "lessons_count",
            "is_published",
        )
        read_only_fields = (
            "id",
            "market",
            "photo_url",
            "rating_avg",
            "rating_count",
            "lessons_count",
            "is_published",
        )

    def validate_specialties(self, value) -> list[str]:
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        seen: list[str] = []
        for item in value[:_MAX_SPECIALTIES]:
            tag = str(item).strip()[:_MAX_FIELD_LEN]
            if tag and tag not in seen:
                seen.append(tag)
        return seen

    def validate_education(self, value) -> list[dict]:
        return _clean_records(value, _RESUME_KEYS["education"])

    def validate_work_experience(self, value) -> list[dict]:
        return _clean_records(value, _RESUME_KEYS["work_experience"])

    def validate_certifications(self, value) -> list[dict]:
        return _clean_records(value, _RESUME_KEYS["certifications"])

    def get_photo_url(self, obj) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def update(self, instance, validated):
        user_data = validated.pop("user", {})
        if "full_name" in user_data:
            instance.user.full_name = user_data["full_name"]
            instance.user.save(update_fields=["full_name"])
        return super().update(instance, validated)


class TeacherPhotoSerializer(serializers.Serializer):
    photo = serializers.ImageField(max_length=200)

    def validate_photo(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Photo must be 5 MB or smaller.")
        return value


class TeacherSubjectReadSerializer(serializers.ModelSerializer):
    lesson_category = LessonCategorySerializer(read_only=True)
    stage = serializers.SerializerMethodField()

    class Meta:
        model = TeacherSubject
        fields = ("id", "lesson_category", "stage")

    def get_stage(self, obj) -> dict:
        v = obj.lesson_category.vertical
        return {"id": v.id, "name_en": v.name_en, "name_ar": v.name_ar}


class _MarketCategoryField(serializers.PrimaryKeyRelatedField):
    """A lesson-category PK scoped to the authenticated teacher's market."""

    def get_queryset(self):
        teacher = self.context["teacher"]
        return LessonCategory.objects.filter(market_id=teacher.market_id, is_active=True)


class TeacherSubjectCreateSerializer(serializers.Serializer):
    lesson_category = _MarketCategoryField()

    def validate_lesson_category(self, category):
        teacher = self.context["teacher"]
        if TeacherSubject.objects.filter(teacher=teacher, lesson_category=category).exists():
            raise serializers.ValidationError("You already teach this subject.")
        return category

    def create(self, validated):
        return TeacherSubject.objects.create(
            teacher=self.context["teacher"], lesson_category=validated["lesson_category"]
        )


class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilityRule
        fields = ("id", "weekday", "start_time", "end_time")
        read_only_fields = ("id",)

    def validate(self, attrs):
        if attrs["end_time"] <= attrs["start_time"]:
            raise serializers.ValidationError("end_time must be after start_time.")
        return attrs

    def create(self, validated):
        return AvailabilityRule.objects.create(teacher=self.context["teacher"], **validated)


class TeacherSpecializationSerializer(serializers.ModelSerializer):
    stage_name_en = serializers.CharField(source="vertical.name_en", read_only=True)
    stage_name_ar = serializers.CharField(source="vertical.name_ar", read_only=True)
    track_name_en = serializers.CharField(source="track.name_en", read_only=True, default=None)
    track_name_ar = serializers.CharField(source="track.name_ar", read_only=True, default=None)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    subject_name_ar = serializers.CharField(source="subject.name_ar", read_only=True)

    class Meta:
        model = TeacherSpecialization
        fields = (
            "id",
            "vertical",
            "track",
            "subject",
            "stage_name_en",
            "stage_name_ar",
            "track_name_en",
            "track_name_ar",
            "subject_name_en",
            "subject_name_ar",
        )
        extra_kwargs = {"track": {"required": False, "allow_null": True}}

    def validate(self, attrs):
        teacher = self.context["teacher"]
        vertical = attrs["vertical"]
        track = attrs.get("track")
        subject = attrs["subject"]

        # Track must belong to the stage and be required when the stage groups.
        if vertical.child_kind != Vertical.ChildKind.NONE and track is None:
            raise serializers.ValidationError({"track": "This stage requires a branch/faculty."})
        if track is not None and track.vertical_id != vertical.id:
            raise serializers.ValidationError({"track": "Track belongs to a different stage."})
        # The (stage, track, subject) triple must be an active catalog assignment.
        if not StageSubject.objects.filter(
            vertical=vertical, track=track, subject=subject, is_active=True
        ).exists():
            raise serializers.ValidationError("This subject is not offered under that stage/branch.")
        if TeacherSpecialization.objects.filter(
            teacher=teacher, vertical=vertical, track=track, subject=subject
        ).exists():
            raise serializers.ValidationError("You already added this specialization.")
        return attrs

    def create(self, validated):
        return TeacherSpecialization.objects.create(teacher=self.context["teacher"], **validated)


class TeacherStagePriceSerializer(serializers.ModelSerializer):
    """The teacher's price for one stage. POST upserts (one price per stage);
    the price must be at least the market's stage minimum."""

    stage_name_en = serializers.CharField(source="vertical.name_en", read_only=True)
    stage_name_ar = serializers.CharField(source="vertical.name_ar", read_only=True)
    min_price_minor = serializers.SerializerMethodField()

    class Meta:
        model = TeacherStagePrice
        fields = (
            "id",
            "vertical",
            "price_minor",
            "stage_name_en",
            "stage_name_ar",
            "min_price_minor",
        )
        read_only_fields = ("id", "stage_name_en", "stage_name_ar", "min_price_minor")

    def get_min_price_minor(self, obj) -> int:
        teacher = self.context["teacher"]
        return stage_minimum_minor(teacher.market_id, obj.vertical)

    def validate(self, attrs):
        teacher = self.context["teacher"]
        vertical = attrs.get("vertical") or getattr(self.instance, "vertical", None)
        price = attrs.get("price_minor", getattr(self.instance, "price_minor", None))
        # The teacher must actually teach a subject in this stage.
        if not TeacherSubject.objects.filter(
            teacher=teacher, lesson_category__vertical=vertical
        ).exists():
            raise serializers.ValidationError(
                {"vertical": "You don't teach any subject in this stage."}
            )
        minimum = max(1, stage_minimum_minor(teacher.market_id, vertical))
        if price is None or price < minimum:
            raise serializers.ValidationError(
                {"price_minor": f"Price must be at least the stage minimum ({minimum})."}
            )
        return attrs

    def create(self, validated):
        teacher = self.context["teacher"]
        obj, _ = TeacherStagePrice.objects.update_or_create(
            teacher=teacher,
            vertical=validated["vertical"],
            defaults={"price_minor": validated["price_minor"]},
        )
        return obj
