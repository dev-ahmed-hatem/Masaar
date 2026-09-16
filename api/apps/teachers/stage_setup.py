"""Stage cards: the shared validation + write rules for a teacher's teaching setup.

A card is one stage (+ branch/faculty) with its subjects, lesson price, free
trial lessons and weekly availability — everything applies to all subjects in
the card. Used by the teacher self-serve API, teacher applications (submit and
approval) and the seed, so the rules live in one place.

Card payload shape (API input and application JSON):
    {vertical, track|null, subjects: [subject ids], price_minor,
     free_lessons_offered, availability: [{weekday, start_time, end_time}]}
"""
from datetime import datetime, time

from django.db import transaction
from rest_framework import serializers

from apps.catalog.models import StagePricingRule, StageSubject, Track, Vertical

from .models import AvailabilityRule, TeacherStage, TeacherStageSubject

MAX_CARDS = 8
MAX_SUBJECTS = 30
MAX_WINDOWS = 30
MAX_FREE_LESSONS = 10
_WEEKDAYS = {choice for choice, _ in AvailabilityRule.Weekday.choices}


def stage_minimum_minor(market_id, vertical_id) -> int:
    """The moderator-set minimum lesson price for a stage in a market (0 if unset)."""
    return (
        StagePricingRule.objects.filter(market_id=market_id, vertical_id=vertical_id, is_active=True)
        .values_list("min_price_minor", flat=True)
        .first()
        or 0
    )


def min_card_price(market_id, vertical_id) -> int:
    """The lowest price a card may have: the stage minimum, and never free."""
    return max(1, stage_minimum_minor(market_id, vertical_id))


def _int(value, label):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise serializers.ValidationError(f"{label} must be an integer.")


def _parse_time(raw) -> time | None:
    if isinstance(raw, time):
        return raw
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(str(raw), fmt).time()
        except ValueError:
            continue
    return None


def clean_availability(value) -> list[dict]:
    """Validate weekly windows; they may not overlap each other within a card."""
    if not isinstance(value, list):
        raise serializers.ValidationError({"availability": "Expected a list."})
    if len(value) > MAX_WINDOWS:
        raise serializers.ValidationError({"availability": f"At most {MAX_WINDOWS} windows."})
    windows = []
    for item in value:
        if not isinstance(item, dict):
            raise serializers.ValidationError({"availability": "Each window must be an object."})
        weekday = _int(item.get("weekday"), "weekday")
        if weekday not in _WEEKDAYS:
            raise serializers.ValidationError({"availability": "Invalid weekday."})
        start, end = _parse_time(item.get("start_time")), _parse_time(item.get("end_time"))
        if start is None or end is None:
            raise serializers.ValidationError({"availability": "Each window needs start and end times."})
        if end <= start:
            raise serializers.ValidationError({"availability": "End time must be after start time."})
        windows.append((weekday, start, end))
    windows.sort()
    for (d1, _s1, e1), (d2, s2, _e2) in zip(windows, windows[1:]):
        if d1 == d2 and s2 < e1:
            raise serializers.ValidationError({"availability": "Availability windows overlap."})
    return [
        {"weekday": d, "start_time": s.strftime("%H:%M"), "end_time": e.strftime("%H:%M")}
        for d, s, e in windows
    ]


def validate_card(market_id, data, *, instance: TeacherStage | None = None, partial=False) -> dict:
    """Validate one card payload for a market. Returns cleaned data (JSON-safe ids).

    With ``instance`` the stage/track are taken from it (immutable) and, when
    ``partial``, omitted keys keep the card's current values.
    """
    if not isinstance(data, dict):
        raise serializers.ValidationError("Each stage must be an object.")

    if instance is not None:
        vertical, track = instance.vertical, instance.track
    else:
        vertical = Vertical.objects.filter(id=_int(data.get("vertical"), "vertical"), is_active=True).first()
        if vertical is None:
            raise serializers.ValidationError({"vertical": "Unknown stage."})
        track_raw = data.get("track")
        track = None
        if vertical.child_kind != Vertical.ChildKind.NONE:
            if track_raw in (None, "", 0, "0"):
                raise serializers.ValidationError({"track": "This stage requires a branch/faculty."})
            track = Track.objects.filter(
                id=_int(track_raw, "track"), vertical=vertical, is_active=True
            ).first()
            if track is None:
                raise serializers.ValidationError({"track": "Unknown branch/faculty for this stage."})

    cleaned = {"vertical": vertical.id, "track": track.id if track else None}

    if not partial or "subjects" in data:
        raw = data.get("subjects")
        if not isinstance(raw, list) or not raw:
            raise serializers.ValidationError({"subjects": "Choose at least one subject."})
        if len(raw) > MAX_SUBJECTS:
            raise serializers.ValidationError({"subjects": f"At most {MAX_SUBJECTS} subjects."})
        ids = list(dict.fromkeys(_int(x, "subject") for x in raw))
        offered = set(
            StageSubject.objects.filter(
                vertical=vertical, track=track, subject_id__in=ids,
                is_active=True, subject__is_active=True,
            ).values_list("subject_id", flat=True)
        )
        if set(ids) - offered:
            raise serializers.ValidationError(
                {"subjects": "Some subjects aren't offered under this stage/branch."}
            )
        cleaned["subjects"] = ids

    if not partial or "price_minor" in data:
        price = _int(data.get("price_minor"), "price_minor")
        minimum = min_card_price(market_id, vertical.id)
        if price < minimum:
            raise serializers.ValidationError(
                {"price_minor": f"Price must be at least the stage minimum ({minimum})."}
            )
        cleaned["price_minor"] = price

    if not partial or "free_lessons_offered" in data:
        free = _int(data.get("free_lessons_offered") or 0, "free_lessons_offered")
        if not 0 <= free <= MAX_FREE_LESSONS:
            raise serializers.ValidationError(
                {"free_lessons_offered": f"Must be between 0 and {MAX_FREE_LESSONS}."}
            )
        cleaned["free_lessons_offered"] = free

    if not partial or "availability" in data:
        cleaned["availability"] = clean_availability(data.get("availability") or [])

    return cleaned


def validate_cards(market_id, cards) -> list[dict]:
    """Validate a whole list of cards (applications): no duplicate stage/track."""
    if not isinstance(cards, list):
        raise serializers.ValidationError("Expected a list of stages.")
    if len(cards) > MAX_CARDS:
        raise serializers.ValidationError(f"At most {MAX_CARDS} stages.")
    cleaned, seen = [], set()
    for card in cards:
        data = validate_card(market_id, card)
        key = (data["vertical"], data["track"])
        if key in seen:
            raise serializers.ValidationError("The same stage/branch is listed twice.")
        seen.add(key)
        cleaned.append(data)
    return cleaned


def card_exists(teacher, vertical_id, track_id, exclude_id=None) -> bool:
    qs = TeacherStage.objects.filter(teacher=teacher, vertical_id=vertical_id, track_id=track_id)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    return qs.exists()


@transaction.atomic
def write_card(teacher, cleaned: dict, instance: TeacherStage | None = None) -> TeacherStage:
    """Create or update a card from ``validate_card`` output. Subjects and
    availability, when present, replace the card's current lists."""
    if instance is None:
        instance = TeacherStage.objects.create(
            teacher=teacher,
            vertical_id=cleaned["vertical"],
            track_id=cleaned["track"],
            price_minor=cleaned["price_minor"],
            free_lessons_offered=cleaned.get("free_lessons_offered", 0),
        )
    else:
        fields = [f for f in ("price_minor", "free_lessons_offered") if f in cleaned]
        for field in fields:
            setattr(instance, field, cleaned[field])
        if fields:
            instance.save(update_fields=fields + ["updated_at"])

    if "subjects" in cleaned:
        instance.subjects.all().delete()
        TeacherStageSubject.objects.bulk_create(
            [TeacherStageSubject(teacher_stage=instance, subject_id=sid) for sid in cleaned["subjects"]]
        )
    if "availability" in cleaned:
        instance.availability.all().delete()
        AvailabilityRule.objects.bulk_create(
            [
                AvailabilityRule(
                    teacher=teacher,
                    teacher_stage=instance,
                    weekday=w["weekday"],
                    start_time=w["start_time"],
                    end_time=w["end_time"],
                )
                for w in cleaned["availability"]
            ]
        )
    return instance


def incomplete_reasons(card: TeacherStage, market_id) -> list[str]:
    """Why a card can't be booked yet: no subjects / price below minimum / no hours."""
    reasons = []
    if not card.subjects.all():
        reasons.append("subject")
    if card.price_minor < min_card_price(market_id, card.vertical_id):
        reasons.append("price")
    if not card.availability.all():
        reasons.append("availability")
    return reasons
