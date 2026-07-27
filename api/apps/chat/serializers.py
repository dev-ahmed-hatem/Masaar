from rest_framework import serializers

from apps.teachers.models import TeacherProfile

from . import errors
from .models import Message, Thread


class ThreadSerializer(serializers.ModelSerializer):
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    teacher_name = serializers.CharField(source="teacher.user.full_name", read_only=True)
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Thread
        fields = (
            "id",
            "teacher_id",
            "teacher_name",
            "student_id",
            "student_name",
            "last_message",
            "unread_count",
            "last_message_at",
            "created_at",
        )
        read_only_fields = fields

    def get_last_message(self, obj):
        body = getattr(obj, "last_body", None)
        if body is None:
            return None
        return {"body": body, "sender_id": getattr(obj, "last_sender_id", None)}

    def get_unread_count(self, obj) -> int:
        return getattr(obj, "unread_count", 0)


class ThreadCreateSerializer(serializers.Serializer):
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=TeacherProfile.objects.filter(is_published=True)
    )

    def validate(self, attrs):
        student = self.context["request"].user
        teacher = attrs["teacher"]
        if not student.market_id or student.market_id != teacher.market_id:
            raise errors.MarketMismatch()
        return attrs


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)

    class Meta:
        model = Message
        fields = ("id", "thread_id", "sender_id", "sender_name", "body", "created_at")
        read_only_fields = fields


class MessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000)
