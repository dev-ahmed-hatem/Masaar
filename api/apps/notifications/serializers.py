from rest_framework import serializers

from . import events
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "channel",
            "event_type",
            "title",
            "body",
            "payload",
            "status",
            "sent_at",
            "read_at",
            "created_at",
        )
        read_only_fields = fields

    def _render(self, obj):
        return events.render(obj.event_type, obj.payload)

    def get_title(self, obj) -> str:
        return self._render(obj)[0]

    def get_body(self, obj) -> str:
        return self._render(obj)[1]
