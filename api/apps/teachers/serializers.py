from rest_framework import serializers

from apps.accounts.utils import normalize_phone
from apps.common.models import format_money
from apps.markets.models import Market
from apps.reviews.models import Review

from . import errors
from .models import AvailabilityRule, TeacherApplication, TeacherProfile


def _split_languages(raw: str) -> list[str]:
    return [code.strip() for code in raw.split(",") if code.strip()]


def _money(amount_minor: int | None, currency: str) -> dict | None:
    if amount_minor is None:
        return None
    return {
        "amount_minor": amount_minor,
        "currency": currency,
        "display": format_money(amount_minor, currency),
    }


class SubjectSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name_en = serializers.CharField()
    name_ar = serializers.CharField()


class TeacherListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    market = serializers.SlugRelatedField(slug_field="code", read_only=True)
    languages = serializers.SerializerMethodField()
    subjects = serializers.SerializerMethodField()
    from_price = serializers.SerializerMethodField()
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
            "intro_video_url",
            "bio_en",
            "bio_ar",
            "rating_avg",
            "rating_count",
            "lessons_count",
            "free_lessons_offered",
            "subjects",
            "from_price",
        )

    def get_languages(self, obj) -> list[str]:
        return _split_languages(obj.languages)

    def get_photo_url(self, obj) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_subjects(self, obj) -> list[dict]:
        seen: dict[int, dict] = {}
        for ts in obj.subjects.all():
            subject = ts.lesson_category.subject
            seen.setdefault(
                subject.id,
                {"id": subject.id, "name_en": subject.name_en, "name_ar": subject.name_ar},
            )
        return list(seen.values())

    def get_from_price(self, obj) -> dict | None:
        # `from_price_minor` is annotated on the queryset (min effective price).
        return _money(getattr(obj, "from_price_minor", None), obj.market.currency)


class OfferingSerializer(serializers.Serializer):
    """One priced lesson category the teacher offers, with the resolved price."""

    lesson_category_id = serializers.IntegerField()
    vertical = serializers.CharField()
    grade_level = serializers.CharField(allow_null=True)
    subject = serializers.CharField()
    price = serializers.DictField()
    is_custom_price = serializers.BooleanField()


class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilityRule
        fields = ("weekday", "start_time", "end_time")


class ReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("rating", "text", "student_name", "created_at")

    def get_student_name(self, obj) -> str:
        name = (obj.student.full_name or "").strip()
        if not name:
            return "Student"
        # Show first name + initial only, to keep reviews lightly anonymised.
        parts = name.split()
        return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


class TeacherDetailSerializer(TeacherListSerializer):
    offerings = serializers.SerializerMethodField()
    availability = AvailabilitySerializer(many=True, read_only=True)
    reviews_summary = serializers.SerializerMethodField()
    recent_reviews = serializers.SerializerMethodField()

    class Meta(TeacherListSerializer.Meta):
        # bio_en / bio_ar are inherited from TeacherListSerializer.Meta.fields.
        fields = TeacherListSerializer.Meta.fields + (
            "specialties",
            "education",
            "work_experience",
            "certifications",
            "offerings",
            "availability",
            "reviews_summary",
            "recent_reviews",
        )

    def _approved_overrides(self, obj) -> dict[int, int]:
        return {
            price.lesson_category_id: price.custom_student_price_minor
            for price in obj.prices.all()
            if price.is_approved
        }

    def get_offerings(self, obj) -> list[dict]:
        overrides = self._approved_overrides(obj)
        offerings = []
        for ts in obj.subjects.all():
            cat = ts.lesson_category
            custom = overrides.get(cat.id)
            effective = custom if custom is not None else cat.student_price_minor
            offerings.append(
                {
                    "lesson_category_id": cat.id,
                    "vertical": cat.vertical.name_en,
                    "grade_level": cat.grade_level.name_en if cat.grade_level else None,
                    "subject": cat.subject.name_en,
                    "price": _money(effective, cat.currency),
                    "is_custom_price": custom is not None,
                }
            )
        return offerings

    def get_reviews_summary(self, obj) -> dict:
        return {"rating_avg": obj.rating_avg, "rating_count": obj.rating_count}

    def get_recent_reviews(self, obj) -> list[dict]:
        reviews = [r for r in obj.reviews.all() if r.is_published][:10]
        return ReviewSerializer(reviews, many=True).data


# --- Onboarding: teacher applications --------------------------------------

class TeacherApplicationCreateSerializer(serializers.ModelSerializer):
    market = serializers.SlugRelatedField(slug_field="code", queryset=Market.objects.all())

    class Meta:
        model = TeacherApplication
        fields = ("full_name", "phone", "email", "market", "bio", "intro_video_url", "document")

    def validate(self, attrs):
        # Normalize with the market dial code (a local "01…" is ambiguous alone).
        attrs["phone"] = normalize_phone(attrs["phone"], attrs["market"].code)
        open_statuses = (
            TeacherApplication.Status.PENDING,
            TeacherApplication.Status.CHANGES_REQUESTED,
        )
        if TeacherApplication.objects.filter(
            phone=attrs["phone"], status__in=open_statuses
        ).exists():
            raise errors.DuplicateApplication()
        return attrs


class TeacherApplicationSerializer(serializers.ModelSerializer):
    market = serializers.SlugRelatedField(slug_field="code", read_only=True)
    reviewed_by = serializers.CharField(source="reviewed_by.full_name", read_only=True, default=None)
    created_profile_id = serializers.IntegerField(source="created_profile.id", read_only=True, default=None)

    class Meta:
        model = TeacherApplication
        fields = (
            "id",
            "full_name",
            "phone",
            "email",
            "market",
            "bio",
            "intro_video_url",
            "document",
            "status",
            "review_notes",
            "reviewed_by",
            "created_profile_id",
            "created_at",
        )
        read_only_fields = fields


class ApplicationRejectSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")
