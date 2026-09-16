from django.contrib import admin

from .models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherProfile,
    TeacherStage,
    TeacherStageSubject,
)


@admin.register(TeacherApplication)
class TeacherApplicationAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "market", "status", "reviewed_by", "created_at")
    list_filter = ("status", "market")
    search_fields = ("full_name", "phone", "email")


class TeacherStageInline(admin.TabularInline):
    model = TeacherStage
    extra = 0
    show_change_link = True


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "market", "gender", "is_published", "rating_avg", "lessons_count")
    list_filter = ("market", "is_published", "gender")
    search_fields = ("user__phone", "user__full_name")
    inlines = [TeacherStageInline]


class TeacherStageSubjectInline(admin.TabularInline):
    model = TeacherStageSubject
    extra = 0


class AvailabilityInline(admin.TabularInline):
    model = AvailabilityRule
    fk_name = "teacher_stage"
    fields = ("weekday", "start_time", "end_time")
    extra = 0


@admin.register(TeacherStage)
class TeacherStageAdmin(admin.ModelAdmin):
    list_display = ("teacher", "vertical", "track", "price_minor", "free_lessons_offered")
    list_filter = ("vertical",)
    search_fields = ("teacher__user__full_name", "teacher__user__phone")
    inlines = [TeacherStageSubjectInline, AvailabilityInline]

    def save_formset(self, request, form, formset, change):
        # Availability rows also carry the teacher FK; fill it from the card.
        instances = formset.save(commit=False)
        for obj in instances:
            if isinstance(obj, AvailabilityRule):
                obj.teacher_id = form.instance.teacher_id
            obj.save()
        for obj in formset.deleted_objects:
            obj.delete()
