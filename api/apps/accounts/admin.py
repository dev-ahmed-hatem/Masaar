from django.contrib import admin

from .models import GuardianLink, PhoneOTP, StudentProfile, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("phone", "full_name", "role", "market", "is_verified", "is_active")
    list_filter = ("role", "is_verified", "is_active", "market")
    search_fields = ("phone", "full_name", "email")


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "grade_level", "date_of_birth")
    search_fields = ("user__phone", "user__full_name")


@admin.register(GuardianLink)
class GuardianLinkAdmin(admin.ModelAdmin):
    list_display = ("student", "guardian_name", "guardian_phone", "can_view")
    search_fields = ("student__phone", "guardian_phone")


@admin.register(PhoneOTP)
class PhoneOTPAdmin(admin.ModelAdmin):
    list_display = ("phone", "purpose", "expires_at", "consumed_at", "attempts")
    list_filter = ("purpose",)
    search_fields = ("phone",)
