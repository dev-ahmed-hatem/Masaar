from django.db import models

from apps.common.models import TimeStampedModel, format_money


class Vertical(TimeStampedModel):
    """Top-level segment: Primary (KG–G12), University, Higher education."""

    class Code(models.TextChoices):
        PRIMARY = "PRIMARY", "Primary (KG–G12)"
        UNIVERSITY = "UNIVERSITY", "University"
        HIGHER_ED = "HIGHER_ED", "Higher education"

    code = models.CharField(max_length=20, choices=Code.choices, unique=True)
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.name_en


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


class LessonCategory(TimeStampedModel):
    """The pricing key: market + vertical + grade + subject -> price & teacher wage."""

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
    student_price_minor = models.IntegerField(help_text="Price charged to the student, in minor units")
    teacher_wage_minor = models.IntegerField(help_text="Wage paid to the teacher, in minor units")
    currency = models.CharField(max_length=3)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Lesson categories"
        unique_together = [("market", "vertical", "grade_level", "subject")]

    @property
    def commission_minor(self) -> int:
        return self.student_price_minor - self.teacher_wage_minor

    def __str__(self):
        grade = f" · {self.grade_level.name_en}" if self.grade_level else ""
        price = format_money(self.student_price_minor, self.currency)
        return f"{self.market.code} · {self.vertical.code}{grade} · {self.subject.name_en} ({price})"
