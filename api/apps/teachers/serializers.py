import json
from datetime import datetime

from rest_framework import serializers

from apps.accounts.utils import normalize_phone
from apps.catalog.models import LessonCategory, StageSubject, Subject, Track, Vertical
from apps.common.models import format_money
from apps.markets.models import Market
from apps.reviews.models import Review

from . import errors
from .models import AvailabilityRule, TeacherApplication, TeacherProfile
from .self_serializers import (
    _MAX_FIELD_LEN,
    _MAX_RECORDS,
    _MAX_SPECIALTIES,
    _RESUME_KEYS,
    _clean_records,
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
    specializations = serializers.SerializerMethodField()
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
            "specializations",
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

    def get_specializations(self, obj) -> list[dict]:
        # Flat list of stage → (track) → subject tags. The frontend groups them
        # for the profile and briefs them for the card.
        out = []
        for sp in obj.specializations.all():
            out.append(
                {
                    "stage": {
                        "id": sp.vertical_id,
                        "name_en": sp.vertical.name_en,
                        "name_ar": sp.vertical.name_ar,
                    },
                    "track": (
                        {"id": sp.track_id, "name_en": sp.track.name_en, "name_ar": sp.track.name_ar}
                        if sp.track_id
                        else None
                    ),
                    "subject": {
                        "id": sp.subject_id,
                        "name_en": sp.subject.name_en,
                        "name_ar": sp.subject.name_ar,
                    },
                }
            )
        return out

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

# JSON structures the applicant may submit as multipart form fields (encoded as
# JSON strings alongside the photo file) or as a plain JSON body.
_JSON_FIELDS = (
    "specialties",
    "education",
    "work_experience",
    "certifications",
    "subjects",
    "specializations",
    "availability",
)

_WEEKDAYS = dict(AvailabilityRule.Weekday.choices)


def _parse_hhmm(raw):
    """Parse 'HH:MM' or 'HH:MM:SS' into a time, or None if unparseable."""
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(str(raw), fmt).time()
        except ValueError:
            continue
    return None


class TeacherApplicationCreateSerializer(serializers.ModelSerializer):
    """Public application capturing the applicant's full profile up-front.

    Accepts either a JSON body or multipart/form-data (when a photo is
    attached); in the multipart case the list/object fields arrive as
    JSON-encoded strings and are decoded in ``to_internal_value``.
    """

    market = serializers.SlugRelatedField(slug_field="code", queryset=Market.objects.all())
    specialties = serializers.JSONField(required=False, default=list)
    education = serializers.JSONField(required=False, default=list)
    work_experience = serializers.JSONField(required=False, default=list)
    certifications = serializers.JSONField(required=False, default=list)
    subjects = serializers.JSONField(required=False, default=list)
    specializations = serializers.JSONField(required=False, default=list)
    availability = serializers.JSONField(required=False, default=list)

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
            "free_lessons_offered",
            "specialties",
            "education",
            "work_experience",
            "certifications",
            "subjects",
            "specializations",
            "availability",
        )

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

    def validate_subjects(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        ids = []
        for item in value:
            try:
                cid = int(item)
            except (TypeError, ValueError):
                raise serializers.ValidationError("Subject ids must be integers.")
            if cid not in ids:
                ids.append(cid)
        return ids

    def validate_specializations(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        cleaned, seen = [], set()
        for item in value[:_MAX_RECORDS]:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Each specialization must be an object.")
            try:
                vertical_id = int(item["vertical"])
                subject_id = int(item["subject"])
            except (KeyError, TypeError, ValueError):
                raise serializers.ValidationError("Specialization needs vertical and subject ids.")
            track_raw = item.get("track")
            track_id = int(track_raw) if track_raw not in (None, "", 0, "0") else None

            try:
                vertical = Vertical.objects.get(id=vertical_id, is_active=True)
            except Vertical.DoesNotExist:
                raise serializers.ValidationError("Unknown stage.")
            track = None
            if vertical.child_kind != Vertical.ChildKind.NONE:
                if track_id is None:
                    raise serializers.ValidationError("This stage requires a branch/faculty.")
                try:
                    track = Track.objects.get(id=track_id, vertical=vertical, is_active=True)
                except Track.DoesNotExist:
                    raise serializers.ValidationError("Track belongs to a different stage.")
            else:
                track_id = None
            if not StageSubject.objects.filter(
                vertical=vertical, track=track, subject_id=subject_id,
                is_active=True, subject__is_active=True,
            ).exists():
                raise serializers.ValidationError(
                    "This subject is not offered under that stage/branch."
                )
            key = (vertical_id, track_id, subject_id)
            if key in seen:
                continue
            seen.add(key)
            cleaned.append({"vertical": vertical_id, "track": track_id, "subject": subject_id})
        return cleaned

    def validate_availability(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        cleaned = []
        for item in value[:_MAX_RECORDS]:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Each availability entry must be an object.")
            try:
                weekday = int(item["weekday"])
            except (KeyError, TypeError, ValueError):
                raise serializers.ValidationError("Availability needs a weekday.")
            if weekday not in _WEEKDAYS:
                raise serializers.ValidationError("Invalid weekday.")
            start = _parse_hhmm(item.get("start_time"))
            end = _parse_hhmm(item.get("end_time"))
            if start is None or end is None:
                raise serializers.ValidationError("Availability needs start and end times.")
            if end <= start:
                raise serializers.ValidationError("end_time must be after start_time.")
            cleaned.append({
                "weekday": weekday,
                "start_time": start.strftime("%H:%M"),
                "end_time": end.strftime("%H:%M"),
            })
        return cleaned

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

        # Teaching subjects must be live lesson categories in the chosen market.
        subjects = attrs.get("subjects") or []
        if subjects:
            valid = set(
                LessonCategory.objects.filter(
                    id__in=subjects, market=attrs["market"], is_active=True
                ).values_list("id", flat=True)
            )
            if any(cid not in valid for cid in subjects):
                raise serializers.ValidationError(
                    {"subjects": "Some subjects aren't available in this market."}
                )
        return attrs


class TeacherApplicationSerializer(serializers.ModelSerializer):
    """Read view for the moderator review queue — surfaces the full submission
    plus human-readable labels for the catalog-linked teaching setup."""

    market = serializers.SlugRelatedField(slug_field="code", read_only=True)
    reviewed_by = serializers.CharField(source="reviewed_by.full_name", read_only=True, default=None)
    created_profile_id = serializers.IntegerField(source="created_profile.id", read_only=True, default=None)
    photo = serializers.SerializerMethodField()
    subjects_display = serializers.SerializerMethodField()
    specializations_display = serializers.SerializerMethodField()
    availability_display = serializers.SerializerMethodField()

    class Meta:
        model = TeacherApplication
        fields = (
            "id",
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
            "free_lessons_offered",
            "specialties",
            "education",
            "work_experience",
            "certifications",
            "subjects_display",
            "specializations_display",
            "availability_display",
            "status",
            "review_notes",
            "reviewed_by",
            "created_profile_id",
            "created_at",
        )
        read_only_fields = fields

    def get_photo(self, obj) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_subjects_display(self, obj) -> list[str]:
        if not obj.subjects:
            return []
        cats = LessonCategory.objects.filter(id__in=obj.subjects).select_related(
            "vertical", "grade_level", "subject"
        )
        out = []
        for cat in cats:
            parts = [
                cat.vertical.name_en,
                cat.grade_level.name_en if cat.grade_level else None,
                cat.subject.name_en,
            ]
            out.append(" · ".join(p for p in parts if p))
        return out

    def get_specializations_display(self, obj) -> list[str]:
        out = []
        for sp in obj.specializations or []:
            try:
                vertical = Vertical.objects.get(id=sp["vertical"])
                subject = Subject.objects.get(id=sp["subject"])
            except (KeyError, TypeError, Vertical.DoesNotExist, Subject.DoesNotExist):
                continue
            track = None
            if sp.get("track"):
                track = Track.objects.filter(id=sp["track"]).first()
            parts = [vertical.name_en] + ([track.name_en] if track else []) + [subject.name_en]
            out.append(" · ".join(parts))
        return out

    def get_availability_display(self, obj) -> list[str]:
        out = []
        for rule in obj.availability or []:
            name = _WEEKDAYS.get(rule.get("weekday"), "?")
            out.append(f"{name} {rule.get('start_time', '')}–{rule.get('end_time', '')}")
        return out


class ApplicationRejectSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")
