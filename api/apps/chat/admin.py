from django.contrib import admin

from .models import Message, Thread


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "teacher", "market", "last_message_at", "created_at")
    list_filter = ("market",)
    search_fields = ("student__phone", "teacher__user__phone")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "thread", "sender", "body", "created_at")
    search_fields = ("body", "sender__phone")
