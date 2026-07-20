from django.contrib import admin

from .models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherPrice,
    TeacherProfile,
    TeacherSubject,
)


@admin.register(TeacherApplication)
class TeacherApplicationAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "market", "status", "reviewed_by", "created_at")
    list_filter = ("status", "market")
    search_fields = ("full_name", "phone", "email")


class TeacherSubjectInline(admin.TabularInline):
    model = TeacherSubject
    extra = 0


class AvailabilityInline(admin.TabularInline):
    model = AvailabilityRule
    extra = 0


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "market",
        "gender",
        "is_published",
        "rating_avg",
        "lessons_count",
        "free_lessons_offered",
    )
    list_filter = ("market", "is_published", "gender")
    search_fields = ("user__phone", "user__full_name")
    inlines = [TeacherSubjectInline, AvailabilityInline]


@admin.register(TeacherPrice)
class TeacherPriceAdmin(admin.ModelAdmin):
    list_display = ("teacher", "lesson_category", "custom_student_price_minor", "is_approved")
    list_filter = ("is_approved",)
