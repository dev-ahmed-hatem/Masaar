from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "teacher", "student", "rating", "is_published", "created_at")
    list_filter = ("rating", "is_published")
    search_fields = ("teacher__user__phone", "student__phone")
