from rest_framework import serializers

from apps.catalog.models import Subject
from apps.common.models import format_money
from apps.teachers.models import TeacherStage

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_market = serializers.SerializerMethodField()
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    teacher_name = serializers.CharField(source="teacher.user.full_name", read_only=True)
    lesson = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "student_name",
            "student_market",
            "teacher_id",
            "teacher_name",
            "teacher_stage",
            "lesson",
            "scheduled_start",
            "duration_min",
            "status",
            "meeting_provider",
            "meeting_link",
            "price_minor",
            "price_display",
            "currency",
            "is_trial",
            "cancel_reason",
            "completed_at",
            "created_at",
        )

    def get_lesson(self, obj) -> dict:
        """What was booked: stage, optional branch/faculty and subject (+ labels)."""
        named = lambda o: {"id": o.id, "name_en": o.name_en, "name_ar": o.name_ar} if o else None  # noqa: E731
        parts = [p for p in (obj.vertical, obj.track, obj.subject) if p]
        return {
            "stage": named(obj.vertical),
            "track": named(obj.track),
            "subject": named(obj.subject),
            "label": " · ".join(p.name_en for p in parts),
            "label_ar": " · ".join(p.name_ar for p in parts),
        }

    def get_price_display(self, obj) -> str:
        return format_money(obj.price_minor, obj.currency)

    def get_student_market(self, obj) -> str:
        market = getattr(obj.student, "market", None)
        return market.code if market else ""


class RescheduleSerializer(serializers.Serializer):
    scheduled_start = serializers.DateTimeField()
    duration_min = serializers.IntegerField(required=False, min_value=15, max_value=240)


class BookingCreateSerializer(serializers.Serializer):
    teacher_stage = serializers.PrimaryKeyRelatedField(
        queryset=TeacherStage.objects.filter(teacher__is_published=True).select_related(
            "teacher__market"
        )
    )
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    scheduled_start = serializers.DateTimeField()
    duration_min = serializers.IntegerField(required=False, min_value=15, max_value=240)
    is_trial = serializers.BooleanField(default=False)


class ConfirmSerializer(serializers.Serializer):
    meeting_provider = serializers.ChoiceField(choices=Booking.Provider.choices)
    # Optional: for a MEET booking where the teacher has connected Google Calendar,
    # the link is auto-generated. The view enforces it as required otherwise.
    meeting_link = serializers.URLField(required=False, allow_blank=True, default="")


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class ResolveSerializer(serializers.Serializer):
    complete = serializers.BooleanField()


class SlotSerializer(serializers.Serializer):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    duration_min = serializers.IntegerField()
