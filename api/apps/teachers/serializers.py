import json
import re

from rest_framework import serializers

from apps.accounts.utils import normalize_phone
from apps.catalog.models import Subject, Track, Vertical
from apps.common.models import format_money
from apps.markets.models import Market
from apps.reviews.models import Review

from . import errors, stage_setup
from .models import AvailabilityRule, TeacherApplication, TeacherProfile
from .self_serializers import (
    _MAX_FIELD_LEN,
    _MAX_SPECIALTIES,
    _RESUME_KEYS,
    _clean_records,
    stage_card_data,
)


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
    stages = serializers.SerializerMethodField()
    free_lessons_offered = serializers.SerializerMethodField()
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
            "stages",
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
        # Distinct subjects across all of the teacher's stage cards.
        seen: dict[int, dict] = {}
        for card in obj.stages.all():
            for cs in card.subjects.all():
                subject = cs.subject
                seen.setdefault(
                    subject.id,
                    {"id": subject.id, "name_en": subject.name_en, "name_ar": subject.name_ar},
                )
        return list(seen.values())

    def get_stages(self, obj) -> list[dict]:
        # Stage cards: stage/track, subjects, price, trials and weekly availability.
        return [stage_card_data(card, obj.market.currency) for card in obj.stages.all()]

    def get_free_lessons_offered(self, obj) -> int:
        # Badge only: the most free trial lessons offered in any stage.
        return max((card.free_lessons_offered for card in obj.stages.all()), default=0)

    def get_from_price(self, obj) -> dict | None:
        # `from_price_minor` is annotated on the queryset (cheapest stage price).
        return _money(getattr(obj, "from_price_minor", None), obj.market.currency)


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
    # Union of all stage cards' windows (per-card windows are under `stages`).
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
            "availability",
            "reviews_summary",
            "recent_reviews",
        )

    def get_reviews_summary(self, obj) -> dict:
        return {"rating_avg": obj.rating_avg, "rating_count": obj.rating_count}

    def get_recent_reviews(self, obj) -> list[dict]:
        reviews = [r for r in obj.reviews.all() if r.is_published][:10]
        return ReviewSerializer(reviews, many=True).data


# --- Onboarding: teacher applications --------------------------------------

# JSON structures the applicant may submit as multipart form fields (encoded as
# JSON strings alongside the photo file) or as a plain JSON body.
_JSON_FIELDS = (
    "specialties",
    "education",
    "work_experience",
    "certifications",
    "stages",
)

_LANGUAGE_CODE = re.compile(r"^[a-z]{2,3}$")


class TeacherApplicationCreateSerializer(serializers.ModelSerializer):
    """Public application capturing the applicant's full profile up-front.

    Accepts either a JSON body or multipart/form-data (when a photo is
    attached); in the multipart case the list/object fields arrive as
    JSON-encoded strings and are decoded in ``to_internal_value``.
    """

    market = serializers.SlugRelatedField(
        slug_field="code", queryset=Market.objects.filter(is_active=True)
    )
    specialties = serializers.JSONField(required=False, default=list)
    education = serializers.JSONField(required=False, default=list)
    work_experience = serializers.JSONField(required=False, default=list)
    certifications = serializers.JSONField(required=False, default=list)
    stages = serializers.JSONField()

    class Meta:
        model = TeacherApplication
        fields = (
            "full_name",
            "phone",
            "email",
            "market",
            "gender",
            "languages",
            "bio",
            "bio_ar",
            "intro_video_url",
            "photo",
            "document",
            "specialties",
            "education",
            "work_experience",
            "certifications",
            "stages",
        )
        # Mandatory on every application (the model keeps them blank-able for
        # older rows): email, gender, languages and the intro video.
        extra_kwargs = {
            "email": {"required": True, "allow_blank": False},
            "gender": {"required": True, "allow_blank": False},
            "languages": {"required": True, "allow_blank": False},
            "intro_video_url": {"required": True, "allow_blank": False},
        }

    def to_internal_value(self, data):
        # Multipart bodies deliver everything as strings; decode the JSON fields
        # before the field-level validators run. A plain JSON body already has
        # them parsed, so only strings are touched.
        if hasattr(data, "getlist"):  # QueryDict (multipart / form-encoded)
            data = {key: data.get(key) for key in data.keys()}
        for name in _JSON_FIELDS:
            value = data.get(name)
            if isinstance(value, str):
                stripped = value.strip()
                try:
                    data[name] = json.loads(stripped) if stripped else []
                except ValueError:
                    raise serializers.ValidationError({name: "Invalid JSON."})
        return super().to_internal_value(data)

    def validate_languages(self, value):
        codes = list(dict.fromkeys(c.strip().lower() for c in value.split(",") if c.strip()))
        if not codes:
            raise serializers.ValidationError("Choose at least one language.")
        if any(not _LANGUAGE_CODE.match(c) for c in codes):
            raise serializers.ValidationError("Invalid language code.")
        return ",".join(codes)

    def validate_specialties(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        seen = []
        for item in value[:_MAX_SPECIALTIES]:
            tag = str(item).strip()[:_MAX_FIELD_LEN]
            if tag and tag not in seen:
                seen.append(tag)
        return seen

    def validate_education(self, value):
        return _clean_records(value, _RESUME_KEYS["education"])

    def validate_work_experience(self, value):
        return _clean_records(value, _RESUME_KEYS["work_experience"])

    def validate_certifications(self, value):
        return _clean_records(value, _RESUME_KEYS["certifications"])

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

        # Stage cards are validated against the chosen market's catalog/minimums.
        try:
            stages = stage_setup.validate_cards(attrs["market"].id, attrs.get("stages"))
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"stages": exc.detail})
        if not stages:
            raise serializers.ValidationError({"stages": "Add at least one stage you teach."})
        attrs["stages"] = stages
        return attrs


def _names(queryset) -> dict[int, dict]:
    return {o.id: {"id": o.id, "name_en": o.name_en, "name_ar": o.name_ar} for o in queryset}


class TeacherApplicationSerializer(serializers.ModelSerializer):
    """Read view for the moderator review queue — the full submission, with the
    stage cards resolved to bilingual catalog names."""

    market = serializers.SlugRelatedField(slug_field="code", read_only=True)
    currency = serializers.CharField(source="market.currency", read_only=True)
    reviewed_by = serializers.CharField(source="reviewed_by.full_name", read_only=True, default=None)
    created_profile_id = serializers.IntegerField(source="created_profile.id", read_only=True, default=None)
    languages = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    document = serializers.SerializerMethodField()
    stages_display = serializers.SerializerMethodField()

    class Meta:
        model = TeacherApplication
        fields = (
            "id",
            "full_name",
            "phone",
            "email",
            "market",
            "currency",
            "gender",
            "languages",
            "bio",
            "bio_ar",
            "intro_video_url",
            "photo",
            "document",
            "specialties",
            "education",
            "work_experience",
            "certifications",
            "stages_display",
            "status",
            "review_notes",
            "reviewed_by",
            "created_profile_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def _file_url(self, field) -> str | None:
        if not field:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(field.url) if request else field.url

    def get_languages(self, obj) -> list[str]:
        return _split_languages(obj.languages)

    def get_photo(self, obj) -> str | None:
        return self._file_url(obj.photo)

    def get_document(self, obj) -> str | None:
        return self._file_url(obj.document)

    def get_stages_display(self, obj) -> list[dict]:
        cards = [c for c in obj.stages or [] if isinstance(c, dict)]
        if not cards:
            return []
        verticals = _names(Vertical.objects.filter(id__in={c.get("vertical") for c in cards}))
        tracks = _names(Track.objects.filter(id__in={c.get("track") for c in cards if c.get("track")}))
        subjects = _names(
            Subject.objects.filter(id__in={s for c in cards for s in c.get("subjects") or []})
        )
        currency = obj.market.currency
        out = []
        for card in cards:
            price = card.get("price_minor") or 0
            out.append(
                {
                    "stage": verticals.get(card.get("vertical")),
                    "track": tracks.get(card.get("track")),
                    "subjects": [subjects[s] for s in card.get("subjects") or [] if s in subjects],
                    "price": {
                        "amount_minor": price,
                        "currency": currency,
                        "display": format_money(price, currency),
                    },
                    "free_lessons_offered": card.get("free_lessons_offered") or 0,
                    "availability": list(card.get("availability") or []),
                }
            )
        return out


class ApplicationRejectSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")
