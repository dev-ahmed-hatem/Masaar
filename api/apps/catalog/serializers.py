from rest_framework import serializers

from .models import GradeLevel, Subject, Vertical


class VerticalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vertical
        fields = ("id", "code", "name_en", "name_ar", "order")


class GradeLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeLevel
        fields = ("id", "vertical", "name_en", "name_ar", "order")


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ("id", "name_en", "name_ar")
