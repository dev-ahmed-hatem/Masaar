from rest_framework import serializers


class GoogleStatusSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    google_email = serializers.EmailField(allow_blank=True)
    sync_enabled = serializers.BooleanField()


class ConnectUrlSerializer(serializers.Serializer):
    auth_url = serializers.URLField()


class CallbackSerializer(serializers.Serializer):
    code = serializers.CharField()
    state = serializers.CharField()
