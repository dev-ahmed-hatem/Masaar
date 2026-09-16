"""Serializers for the teacher self-serve API (`/api/teacher/`)."""
from rest_framework import serializers

from apps.common.models import format_money

from . import stage_setup
from .models import TeacherProfile, TeacherStage


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


def _named(obj) -> dict | None:
    if obj is None:
        return None
    return {"id": obj.id, "name_en": obj.name_en, "name_ar": obj.name_ar}


def stage_card_data(card: TeacherStage, currency: str, *, min_price_minor=None) -> dict:
    """Read shape of a stage card, shared by the self API and public profile.

    Expects ``vertical``, ``track``, ``subjects__subject`` and ``availability``
    to be loaded (select/prefetch) by the caller to avoid per-card queries.
    """
    data = {
        "id": card.id,
        "stage": _named(card.vertical),
        "track": _named(card.track),
        "subjects": [_named(s.subject) for s in card.subjects.all()],
        "price": {
            "amount_minor": card.price_minor,
            "currency": currency,
            "display": format_money(card.price_minor, currency),
        },
        "free_lessons_offered": card.free_lessons_offered,
        "availability": [
            {
                "weekday": rule.weekday,
                "start_time": rule.start_time.strftime("%H:%M"),
                "end_time": rule.end_time.strftime("%H:%M"),
            }
            for rule in card.availability.all()
        ],
    }
    if min_price_minor is not None:
        data["min_price_minor"] = min_price_minor
    return data


class TeacherStageSerializer(serializers.Serializer):
    """Create/update one of the authenticated teacher's stage cards.

    ``vertical``/``track`` are fixed once created; ``subjects`` and
    ``availability`` replace the card's lists when sent.
    """

    def to_internal_value(self, data):
        teacher = self.context["teacher"]
        cleaned = stage_setup.validate_card(
            teacher.market_id, data, instance=self.instance, partial=self.partial
        )
        if self.instance is None and stage_setup.card_exists(
            teacher, cleaned["vertical"], cleaned["track"]
        ):
            raise serializers.ValidationError({"vertical": "You already have this stage."})
        return cleaned

    def create(self, validated):
        return stage_setup.write_card(self.context["teacher"], validated)

    def update(self, instance, validated):
        return stage_setup.write_card(self.context["teacher"], validated, instance=instance)

    def to_representation(self, card):
        teacher = self.context["teacher"]
        card = TeacherStage.objects.select_related("vertical", "track").prefetch_related(
            "subjects__subject", "availability"
        ).get(pk=card.pk)
        data = stage_card_data(
            card,
            teacher.market.currency,
            min_price_minor=stage_setup.min_card_price(teacher.market_id, card.vertical_id),
        )
        data["incomplete"] = stage_setup.incomplete_reasons(card, teacher.market_id)
        return data
