from django.db import models

from apps.common.models import TimeStampedModel


class TeacherApplication(TimeStampedModel):
    """Public teacher application reviewed/approved by moderators."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        CHANGES_REQUESTED = "CHANGES_REQUESTED", "Changes requested"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    market = models.ForeignKey(
        "markets.Market", on_delete=models.PROTECT, related_name="teacher_applications"
    )
    bio = models.TextField(blank=True)
    intro_video_url = models.URLField(blank=True)
    document = models.FileField(upload_to="teacher_docs/", null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_applications",
    )
    review_notes = models.TextField(blank=True)
    # Set once an application is approved and a teacher account is created.
    created_profile = models.OneToOneField(
        "teachers.TeacherProfile",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="application",
    )

    def __str__(self):
        return f"{self.full_name} — {self.status}"


class TeacherProfile(TimeStampedModel):
    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"

    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="teacher_profile"
    )
    market = models.ForeignKey(
        "markets.Market", on_delete=models.PROTECT, related_name="teachers"
    )
    photo = models.ImageField(upload_to="teacher_photos/", null=True, blank=True)
    gender = models.CharField(max_length=6, choices=Gender.choices, blank=True)
    languages = models.CharField(
        max_length=120, blank=True, help_text="Comma-separated, e.g. 'ar,en'"
    )
    bio_en = models.TextField(blank=True)
    bio_ar = models.TextField(blank=True)
    intro_video_url = models.URLField(blank=True, help_text="YouTube URL (Vidstack player)")
    free_lessons_offered = models.PositiveSmallIntegerField(default=0)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)
    lessons_count = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    def __str__(self):
        return f"Teacher: {self.user}"


class TeacherSubject(TimeStampedModel):
    """A lesson category (market/vertical/grade/subject) the teacher teaches."""

    teacher = models.ForeignKey(
        TeacherProfile, on_delete=models.CASCADE, related_name="subjects"
    )
    lesson_category = models.ForeignKey(
        "catalog.LessonCategory", on_delete=models.PROTECT, related_name="teachers"
    )

    class Meta:
        unique_together = [("teacher", "lesson_category")]

    def __str__(self):
        return f"{self.teacher} · {self.lesson_category}"


class TeacherPrice(TimeStampedModel):
    """Per-teacher price override for a lesson category (moderator-approved)."""

    teacher = models.ForeignKey(
        TeacherProfile, on_delete=models.CASCADE, related_name="prices"
    )
    lesson_category = models.ForeignKey(
        "catalog.LessonCategory", on_delete=models.PROTECT, related_name="teacher_prices"
    )
    custom_student_price_minor = models.IntegerField()
    is_approved = models.BooleanField(default=False)

    class Meta:
        unique_together = [("teacher", "lesson_category")]

    def __str__(self):
        return f"{self.teacher} · {self.lesson_category} = {self.custom_student_price_minor}"


class FavoriteTeacher(TimeStampedModel):
    """A teacher a student has saved/bookmarked."""

    student = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="favorite_teachers"
    )
    teacher = models.ForeignKey(
        TeacherProfile, on_delete=models.CASCADE, related_name="favorited_by"
    )

    class Meta:
        unique_together = [("student", "teacher")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student} ♥ {self.teacher}"


class AvailabilityRule(TimeStampedModel):
    """Recurring weekly availability window for a teacher (local to their market TZ)."""

    class Weekday(models.IntegerChoices):
        MON = 0, "Monday"
        TUE = 1, "Tuesday"
        WED = 2, "Wednesday"
        THU = 3, "Thursday"
        FRI = 4, "Friday"
        SAT = 5, "Saturday"
        SUN = 6, "Sunday"

    teacher = models.ForeignKey(
        TeacherProfile, on_delete=models.CASCADE, related_name="availability"
    )
    weekday = models.IntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ["weekday", "start_time"]

    def __str__(self):
        return f"{self.teacher} · {self.get_weekday_display()} {self.start_time}-{self.end_time}"
