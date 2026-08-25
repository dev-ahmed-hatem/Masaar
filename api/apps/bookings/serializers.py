from rest_framework import serializers

from apps.catalog.models import LessonCategory
from apps.catalog.serializers import LessonCategorySerializer
from apps.common.models import format_money
from apps.teachers.models import TeacherProfile

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_market = serializers.SerializerMethodField()
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    teacher_name = serializers.CharField(source="teacher.user.full_name", read_only=True)
    lesson_category = LessonCategorySerializer(read_only=True)
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "student_name",
            "student_market",
            "teacher_id",
            "teacher_name",
            "lesson_category",
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

    def get_price_display(self, obj) -> str:
        return format_money(obj.price_minor, obj.currency)

    def get_student_market(self, obj) -> str:
        market = getattr(obj.student, "market", None)
        return market.code if market else ""


class RescheduleSerializer(serializers.Serializer):
    scheduled_start = serializers.DateTimeField()
    duration_min = serializers.IntegerField(required=False, min_value=15, max_value=240)


class BookingCreateSerializer(serializers.Serializer):
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=TeacherProfile.objects.filter(is_published=True)
    )
    lesson_category = serializers.PrimaryKeyRelatedField(queryset=LessonCategory.objects.all())
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
