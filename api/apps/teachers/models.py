from django.db import models

from apps.common.models import TimeStampedModel


class TeacherApplication(TimeStampedModel):
    """Public teacher application reviewed/approved by moderators.

    Collects the applicant's full profile up-front so moderators review
    everything before it goes live; on approval the data is materialized into
    the created ``TeacherProfile`` (and its stage cards). ``bio`` holds the English bio; ``bio_ar`` the Arabic one.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        CHANGES_REQUESTED = "CHANGES_REQUESTED", "Changes requested"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"

    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    market = models.ForeignKey(
        "markets.Market", on_delete=models.PROTECT, related_name="teacher_applications"
    )
    bio = models.TextField(blank=True)
    intro_video_url = models.URLField(blank=True)
    document = models.FileField(upload_to="teacher_docs/", null=True, blank=True)
    # --- Full profile data, mirrored from TeacherProfile and materialized on
    # approval so moderators can review the whole profile before it's live. ---
    gender = models.CharField(max_length=6, choices=Gender.choices, blank=True)
    languages = models.CharField(
        max_length=120, blank=True, help_text="Comma-separated, e.g. 'ar,en'"
    )
    bio_ar = models.TextField(blank=True)
    photo = models.ImageField(upload_to="teacher_photos/", null=True, blank=True)
    specialties = models.JSONField(default=list, blank=True)
    education = models.JSONField(default=list, blank=True)
    work_experience = models.JSONField(default=list, blank=True)
    certifications = models.JSONField(default=list, blank=True)
    # Teaching setup as stage cards, turned into real rows on approval:
    #   list[{vertical, track|null, subjects: [subject ids], price_minor,
    #         free_lessons_offered, availability: [{weekday, start_time, end_time}]}]
    stages = models.JSONField(default=list, blank=True)
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
    # Free-form résumé sections shown on the public profile, edited by the teacher
    # in one form. Display-only (never queried), so stored as JSON rather than
    # child tables. Shapes (see self_serializers validation):
    #   specialties:     list[str]
    #   education:       list[{degree, institution, start_year, end_year, description}]
    #   work_experience: list[{title, organization, start_year, end_year, description}]
    #   certifications:  list[{name, issuer, year, description}]
    specialties = models.JSONField(default=list, blank=True)
    education = models.JSONField(default=list, blank=True)
    work_experience = models.JSONField(default=list, blank=True)
    certifications = models.JSONField(default=list, blank=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)
    lessons_count = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    def __str__(self):
        return f"Teacher: {self.user}"


class TeacherStage(TimeStampedModel):
    """A "stage card": one stage (+ branch/faculty) the teacher teaches.

    Everything set here — price, free trial lessons and weekly availability —
    applies to every subject in the card. ``track`` is null for stages with no
    branch/faculty grouping (e.g. Primary). The price must be at least the
    market's stage minimum (``catalog.StagePricingRule.min_price_minor``); see
    ``teachers.stage_setup`` for the shared validation rules.
    """

    teacher = models.ForeignKey(
        TeacherProfile, on_delete=models.CASCADE, related_name="stages"
    )
    vertical = models.ForeignKey(
        "catalog.Vertical", on_delete=models.PROTECT, related_name="teacher_stages"
    )
    track = models.ForeignKey(
        "catalog.Track",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="teacher_stages",
    )
    price_minor = models.IntegerField()
    free_lessons_offered = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["vertical__order", "track__order", "id"]
        constraints = [
            # Two constraints because NULL tracks never collide in a plain
            # unique index.
            models.UniqueConstraint(
                fields=["teacher", "vertical", "track"],
                condition=models.Q(track__isnull=False),
                name="uniq_teacher_stage_track",
            ),
            models.UniqueConstraint(
                fields=["teacher", "vertical"],
                condition=models.Q(track__isnull=True),
                name="uniq_teacher_stage_notrack",
            ),
        ]

    def __str__(self):
        track = f" · {self.track.name_en}" if self.track_id else ""
        return f"{self.teacher} · {self.vertical.code}{track}"


class TeacherStageSubject(TimeStampedModel):
    """A subject taught within a stage card."""

    teacher_stage = models.ForeignKey(
        TeacherStage, on_delete=models.CASCADE, related_name="subjects"
    )
    subject = models.ForeignKey(
        "catalog.Subject", on_delete=models.PROTECT, related_name="teacher_stage_subjects"
    )

    class Meta:
        ordering = ["subject__name_en"]
        unique_together = [("teacher_stage", "subject")]

    def __str__(self):
        return f"{self.teacher_stage} · {self.subject.name_en}"


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
    # The stage card this window belongs to (availability is set per card).
    teacher_stage = models.ForeignKey(
        TeacherStage, on_delete=models.CASCADE, related_name="availability"
    )
    weekday = models.IntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ["weekday", "start_time"]

    def __str__(self):
        return f"{self.teacher} · {self.get_weekday_display()} {self.start_time}-{self.end_time}"
