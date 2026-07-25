from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.bookings.models import Booking

from . import errors
from .models import Review


def _mask_name(full_name: str) -> str:
    name = (full_name or "").strip()
    if not name:
        return "Student"
    parts = name.split()
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


class ReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    teacher_name = serializers.CharField(source="teacher.user.full_name", read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "teacher_id",
            "teacher_name",
            "student_name",
            "rating",
            "text",
            "is_published",
            "created_at",
        )
        read_only_fields = fields

    def get_student_name(self, obj) -> str:
        return _mask_name(obj.student.full_name)


class ReviewCreateSerializer(serializers.Serializer):
    booking = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all())
    rating = serializers.IntegerField(min_value=1, max_value=5)
    text = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        user = self.context["request"].user
        booking = attrs["booking"]
        if booking.student_id != user.id:
            raise PermissionDenied("This is not your lesson.")
        if booking.status != Booking.Status.COMPLETED:
            raise errors.BookingNotCompleted()
        if Review.objects.filter(booking=booking).exists():
            raise errors.AlreadyReviewed()
        return attrs
