from django.contrib import admin

from .models import (
    GradeLevel,
    LessonCategory,
    StageGroup,
    StagePricingRule,
    StageSubject,
    Subject,
    Track,
    Vertical,
)


@admin.register(StageGroup)
class StageGroupAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_ar", "order", "is_active")


@admin.register(Vertical)
class VerticalAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_ar", "group", "child_kind", "order")
    list_filter = ("group", "child_kind", "is_active")


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_ar", "vertical", "order", "is_active")
    list_filter = ("vertical", "is_active")


@admin.register(GradeLevel)
class GradeLevelAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_ar", "vertical", "order")
    list_filter = ("vertical",)


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_ar", "is_active")
    search_fields = ("name_en", "name_ar")


@admin.register(StageSubject)
class StageSubjectAdmin(admin.ModelAdmin):
    list_display = ("__str__", "order", "is_active")
    list_filter = ("vertical", "track", "is_active")
    search_fields = ("subject__name_en", "subject__name_ar")


@admin.register(StagePricingRule)
class StagePricingRuleAdmin(admin.ModelAdmin):
    list_display = ("__str__", "min_price_minor", "max_price_minor", "is_active")
    list_filter = ("market", "vertical", "is_active")


@admin.register(LessonCategory)
class LessonCategoryAdmin(admin.ModelAdmin):
    list_display = ("__str__", "is_active")
    list_filter = ("market", "vertical", "is_active")
    search_fields = ("subject__name_en",)
