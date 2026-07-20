from django.contrib import admin

from .models import GradeLevel, LessonCategory, Subject, Vertical


@admin.register(Vertical)
class VerticalAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_ar", "order")


@admin.register(GradeLevel)
class GradeLevelAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_ar", "vertical", "order")
    list_filter = ("vertical",)


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_ar", "is_active")
    search_fields = ("name_en", "name_ar")


@admin.register(LessonCategory)
class LessonCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "__str__",
        "student_price_minor",
        "teacher_wage_minor",
        "currency",
        "is_active",
    )
    list_filter = ("market", "vertical", "is_active")
    search_fields = ("subject__name_en",)
