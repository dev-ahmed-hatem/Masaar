"""Serializers for the teacher self-serve API (`/api/teacher/`)."""
from rest_framework import serializers

from apps.catalog.models import LessonCategory
from apps.catalog.serializers import LessonCategorySerializer
from apps.common.models import format_money

from .models import AvailabilityRule, TeacherPrice, TeacherProfile, TeacherSubject

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


def _effective_price(category: LessonCategory, overrides: dict[int, int]) -> dict:
    custom = overrides.get(category.id)
    amount = custom if custom is not None else category.student_price_minor
    return {
        "amount_minor": amount,
        "currency": category.currency,
        "display": format_money(amount, category.currency),
        "is_custom": custom is not None,
    }


class TeacherSubjectReadSerializer(serializers.ModelSerializer):
    lesson_category = LessonCategorySerializer(read_only=True)
    effective_price = serializers.SerializerMethodField()

    class Meta:
        model = TeacherSubject
        fields = ("id", "lesson_category", "effective_price")

    def get_effective_price(self, obj) -> dict:
        return _effective_price(obj.lesson_category, self.context.get("overrides", {}))


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


class TeacherPriceReadSerializer(serializers.ModelSerializer):
    lesson_category = LessonCategorySerializer(read_only=True)

    class Meta:
        model = TeacherPrice
        fields = ("id", "lesson_category", "custom_student_price_minor", "is_approved")


class TeacherPriceCreateSerializer(serializers.Serializer):
    lesson_category = _MarketCategoryField()
    custom_student_price_minor = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        # A custom price must still cover the teacher's wage, otherwise the
        # platform would pay out more than it collects for the lesson.
        wage = attrs["lesson_category"].teacher_wage_minor
        if attrs["custom_student_price_minor"] < wage:
            raise serializers.ValidationError(
                {"custom_student_price_minor": f"Price must be at least the teacher wage ({wage})."}
            )
        return attrs

    def create(self, validated):
        teacher = self.context["teacher"]
        # One request per category; a new/changed request resets approval.
        obj, _ = TeacherPrice.objects.update_or_create(
            teacher=teacher,
            lesson_category=validated["lesson_category"],
            defaults={
                "custom_student_price_minor": validated["custom_student_price_minor"],
                "is_approved": False,
            },
        )
        return obj
