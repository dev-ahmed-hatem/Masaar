from rest_framework import serializers

from .models import GradeLevel, LessonCategory, Subject, Vertical


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


class LessonCategorySerializer(serializers.ModelSerializer):
    """A pickable pricing key with human labels (for teacher subject/price pickers)."""

    label = serializers.SerializerMethodField()
    label_ar = serializers.SerializerMethodField()

    class Meta:
        model = LessonCategory
        fields = ("id", "label", "label_ar", "student_price_minor", "currency")

    def get_label(self, obj) -> str:
        parts = [obj.vertical.name_en, obj.grade_level.name_en if obj.grade_level else None, obj.subject.name_en]
        return " · ".join(p for p in parts if p)

    def get_label_ar(self, obj) -> str:
        parts = [obj.vertical.name_ar, obj.grade_level.name_ar if obj.grade_level else None, obj.subject.name_ar]
        return " · ".join(p for p in parts if p)
