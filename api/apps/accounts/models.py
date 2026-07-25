from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.common.models import TimeStampedModel

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """Custom user identified by phone number, with a marketplace role."""

    class Role(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        TEACHER = "TEACHER", "Teacher"
        MODERATOR = "MODERATOR", "Moderator"
        SUPERADMIN = "SUPERADMIN", "Super admin"

    class Locale(models.TextChoices):
        AR = "ar", "Arabic"
        EN = "en", "English"

    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True)
    full_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    market = models.ForeignKey(
        "markets.Market",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )
    locale = models.CharField(max_length=2, choices=Locale.choices, default=Locale.AR)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.full_name or self.phone} ({self.role})"


class StudentProfile(TimeStampedModel):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="student_profile"
    )
    date_of_birth = models.DateField(null=True, blank=True)
    grade_level = models.ForeignKey(
        "catalog.GradeLevel",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="students",
    )

    def __str__(self):
        return f"Student: {self.user}"


class GuardianLink(TimeStampedModel):
    """Parent-monitor link giving a guardian visibility over a student account."""

    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="guardians"
    )
    guardian_user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="monitored_students",
    )
    guardian_name = models.CharField(max_length=150, blank=True)
    guardian_phone = models.CharField(max_length=20, blank=True)
    can_view = models.BooleanField(default=True)

    def __str__(self):
        return f"Guardian of {self.student}"


class PhoneOTP(TimeStampedModel):
    """Hashed one-time codes for phone verification and password reset.

    Delivery goes through a pluggable sender (see accounts/senders.py); in dev
    the console sender logs the plaintext code.
    """

    class Purpose(models.TextChoices):
        VERIFY = "VERIFY", "Verify"
        RESET = "RESET", "Password reset"

    phone = models.CharField(max_length=20, db_index=True)
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(
        max_length=10, choices=Purpose.choices, default=Purpose.VERIFY
    )
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f"OTP {self.phone} ({self.purpose})"
