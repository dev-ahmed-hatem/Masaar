from django.db import models

from apps.common.models import TimeStampedModel


class StageGroup(TimeStampedModel):
    """A display-only header that groups sibling Stages in the UI.

    Purely presentational: it adds no depth to the taxonomy — the shape stays
    Stage -> Track -> Subject — and nothing is priced, booked or filtered by it.
    "International education" is the header over the two international stages.

    Clients render the header before the first stage carrying the group, so a
    group's stages must be contiguous in ``Vertical.order``; a non-contiguous
    group simply renders its header twice.
    """

    code = models.CharField(max_length=32, unique=True)
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.name_en


class Vertical(TimeStampedModel):
    """A top-level educational Stage (Primary / Preparatory / ... ).

    Surfaced as "Stage" across the API/UI; the class name is kept for
    back-compat with the many FKs that reference it (TeacherStage, Booking,
    StudentProfile, ...). `code` is a free-form unique slug so moderators can
    create new stages; the `Code` constants below are used only by the seed.

    `child_kind` says whether the stage has an intermediate grouping (Track)
    and what to call it: BRANCH and FACULTY are translated by the clients,
    while GROUPED takes its name from `child_label_en`/`child_label_ar` so a
    moderator can add e.g. "Curriculum" or "Exam" without a deploy.

    `group` is a display-only header (see `StageGroup`) — it groups sibling
    stages in the UI and changes nothing about pricing or booking.
    """

    class Code(models.TextChoices):
        PRIMARY = "PRIMARY", "Primary"
        PREPARATORY = "PREPARATORY", "Preparatory"
        SECONDARY = "SECONDARY", "Secondary"
        COLLEGE = "COLLEGE", "University"
        INTL_CURRICULA = "INTL_CURRICULA", "International curricula"
        INTL_EXAMS = "INTL_EXAMS", "International exams"
        # Legacy codes kept for historical data / migrations.
        UNIVERSITY = "UNIVERSITY", "University (legacy)"
        HIGHER_ED = "HIGHER_ED", "Higher education"

    class ChildKind(models.TextChoices):
        NONE = "NONE", "No grouping (subjects directly)"
        BRANCH = "BRANCH", "Branches"
        FACULTY = "FACULTY", "Faculties"
        # Anything else the moderator invents: the label lives in child_label_*
        # rather than in this enum, so a new grouping needs no deploy.
        GROUPED = "GROUPED", "Custom grouping (see child_label)"

    code = models.CharField(max_length=32, unique=True)
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    group = models.ForeignKey(
        StageGroup,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="stages",
        help_text="Optional display-only header this stage appears under.",
    )
    child_kind = models.CharField(
        max_length=16, choices=ChildKind.choices, default=ChildKind.NONE
    )
    # What this stage calls its Track, when child_kind is GROUPED. Blank for
    # BRANCH/FACULTY, which the clients already translate themselves.
    child_label_en = models.CharField(max_length=60, blank=True)
    child_label_ar = models.CharField(max_length=60, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        # Ordering stays global, never by group: sorting by group first would
        # push every ungrouped stage behind the grouped ones (NULLs last).
        ordering = ["order"]

    def __str__(self):
        return self.name_en


class Track(TimeStampedModel):
    """An optional grouping under a Stage.

    What it is called depends on the stage: a Branch (Secondary), a Faculty
    (University), or whatever `Vertical.child_label_*` says (a Curriculum, an
    Exam, ...).
    """

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
    """Moderator-set price band + platform commission for a stage in a market.

    A teacher's per-stage price must be at least ``min_price_minor`` and, when
    ``max_price_minor`` is set, at most that — a blank maximum means no ceiling.
    The platform keeps ``commission_pct`` percent of each lesson, deducted from
    the teacher's price — so the teacher receives
    ``price × (1 − commission_pct/100)`` and the student pays the teacher's
    price unchanged.
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
    max_price_minor = models.IntegerField(
        null=True,
        blank=True,
        help_text=(
            "Maximum lesson price a teacher may set, in minor units; "
            "blank means no ceiling"
        ),
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
        band = f"min {self.min_price_minor}"
        if self.max_price_minor is not None:
            band += f"–max {self.max_price_minor}"
        return f"{self.market.code} · {self.vertical.code}: {band}, {self.commission_pct}%"
