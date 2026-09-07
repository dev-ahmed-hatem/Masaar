from django.db import models

from apps.common.models import TimeStampedModel


class Vertical(TimeStampedModel):
    """A top-level educational Stage (Primary / Secondary / College).

    Surfaced as "Stage" across the API/UI; the class name is kept for
    back-compat with the many FKs that reference it (LessonCategory, etc.).
    `code` is a free-form unique slug so moderators can create new stages;
    the `Code` constants below are used only by the seed. `child_kind` tells
    the UI what the optional intermediate grouping (Track) is called.
    """

    class Code(models.TextChoices):
        PRIMARY = "PRIMARY", "Primary"
        SECONDARY = "SECONDARY", "Secondary"
        COLLEGE = "COLLEGE", "College"
        # Legacy codes kept for historical data / migrations.
        UNIVERSITY = "UNIVERSITY", "University"
        HIGHER_ED = "HIGHER_ED", "Higher education"

    class ChildKind(models.TextChoices):
        NONE = "NONE", "No grouping (subjects directly)"
        BRANCH = "BRANCH", "Branches"
        FACULTY = "FACULTY", "Faculties"

    code = models.CharField(max_length=32, unique=True)
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    child_kind = models.CharField(
        max_length=10, choices=ChildKind.choices, default=ChildKind.NONE
    )
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.name_en


class Track(TimeStampedModel):
    """An optional grouping under a Stage: a Branch (Secondary) or Faculty (College)."""

    vertical = models.ForeignKey(
        Vertical, on_delete=models.CASCADE, related_name="tracks"
    )
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["vertical", "order"]
        unique_together = [("vertical", "name_en")]

    def __str__(self):
        return f"{self.vertical.code} · {self.name_en}"


class GradeLevel(TimeStampedModel):
    """A level within a vertical (e.g. Grade 4, or University Year 1)."""

    vertical = models.ForeignKey(
        Vertical, on_delete=models.CASCADE, related_name="grade_levels"
    )
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["vertical", "order"]
        unique_together = [("vertical", "name_en")]

    def __str__(self):
        return f"{self.vertical.code} · {self.name_en}"


class Subject(TimeStampedModel):
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name_en"]

    def __str__(self):
        return self.name_en


class StageSubject(TimeStampedModel):
    """Which subjects are listed under a Stage (track=null → e.g. Primary) or
    under a specific Branch/Faculty. Keeps Subject a reusable global pool."""

    vertical = models.ForeignKey(
        Vertical, on_delete=models.CASCADE, related_name="stage_subjects"
    )
    track = models.ForeignKey(
        Track,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="stage_subjects",
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="stage_subjects"
    )
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["vertical", "track", "order", "subject"]
        unique_together = [("vertical", "track", "subject")]

    def __str__(self):
        track = f" · {self.track.name_en}" if self.track else ""
        return f"{self.vertical.code}{track} · {self.subject.name_en}"


class LessonCategory(TimeStampedModel):
    """The subject taxonomy/booking key: market + vertical + grade + subject.

    Identifies what a lesson is about (and what a teacher teaches, via
    ``TeacherSubject``). Pricing is no longer stored here — it lives per stage on
    ``StagePricingRule`` (minimum + commission) and ``TeacherStagePrice`` (the
    teacher's price).
    """

    market = models.ForeignKey(
        "markets.Market", on_delete=models.CASCADE, related_name="lesson_categories"
    )
    vertical = models.ForeignKey(
        Vertical, on_delete=models.PROTECT, related_name="lesson_categories"
    )
    grade_level = models.ForeignKey(
        GradeLevel,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="lesson_categories",
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.PROTECT, related_name="lesson_categories"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Lesson categories"
        unique_together = [("market", "vertical", "grade_level", "subject")]

    def __str__(self):
        grade = f" · {self.grade_level.name_en}" if self.grade_level else ""
        return f"{self.market.code} · {self.vertical.code}{grade} · {self.subject.name_en}"


class StagePricingRule(TimeStampedModel):
    """Moderator-set pricing floor + platform commission for a stage in a market.

    A teacher's per-stage price must be at least ``min_price_minor``. The
    platform keeps ``commission_pct`` percent of each lesson, deducted from the
    teacher's price — so the teacher receives ``price × (1 − commission_pct/100)``
    and the student pays the teacher's price unchanged.
    """

    market = models.ForeignKey(
        "markets.Market", on_delete=models.CASCADE, related_name="stage_pricing_rules"
    )
    vertical = models.ForeignKey(
        Vertical, on_delete=models.PROTECT, related_name="stage_pricing_rules"
    )
    min_price_minor = models.IntegerField(
        help_text="Minimum lesson price a teacher may set, in minor units"
    )
    commission_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Platform commission (0-100), deducted from the teacher's price",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("market", "vertical")]
        ordering = ["market", "vertical"]

    @property
    def currency(self) -> str:
        return self.market.currency

    def __str__(self):
        return f"{self.market.code} · {self.vertical.code}: min {self.min_price_minor}, {self.commission_pct}%"
