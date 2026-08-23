"""Reshape the top-level taxonomy into Primary / Secondary / College with
branch & faculty groupings, and seed sample tracks + stage↔subject links.

Idempotent: safe to re-run. FKs reference verticals by id, so remapping the
legacy UNIVERSITY row to COLLEGE keeps existing LessonCategory/Booking rows intact.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    Vertical = apps.get_model("catalog", "Vertical")
    Track = apps.get_model("catalog", "Track")
    Subject = apps.get_model("catalog", "Subject")
    StageSubject = apps.get_model("catalog", "StageSubject")

    # Only reshape an already-populated catalog (a real DB being upgraded).
    # Fresh databases — tests and new installs — are seeded via the seed command,
    # so this migration is a no-op there and never collides with test fixtures.
    if not Vertical.objects.exists():
        return

    # --- Stages ---------------------------------------------------------
    primary, _ = Vertical.objects.update_or_create(
        code="PRIMARY",
        defaults={"name_en": "Primary", "name_ar": "المرحلة الابتدائية",
                  "child_kind": "NONE", "order": 1, "is_active": True},
    )
    secondary, _ = Vertical.objects.update_or_create(
        code="SECONDARY",
        defaults={"name_en": "Secondary", "name_ar": "المرحلة الثانوية",
                  "child_kind": "BRANCH", "order": 2, "is_active": True},
    )
    # Remap the legacy UNIVERSITY row to COLLEGE if present; else create COLLEGE.
    college = Vertical.objects.filter(code="UNIVERSITY").first()
    if college:
        college.code = "COLLEGE"
        college.name_en = "College"
        college.name_ar = "الكلية"
        college.child_kind = "FACULTY"
        college.order = 3
        college.is_active = True
        college.save()
    else:
        college, _ = Vertical.objects.update_or_create(
            code="COLLEGE",
            defaults={"name_en": "College", "name_ar": "الكلية",
                      "child_kind": "FACULTY", "order": 3, "is_active": True},
        )

    # Retire higher-ed (moderators can delete it later).
    Vertical.objects.filter(code="HIGHER_ED").update(is_active=False)

    # --- Tracks ---------------------------------------------------------
    def track(vertical, name_en, name_ar, order):
        obj, _ = Track.objects.get_or_create(
            vertical=vertical, name_en=name_en,
            defaults={"name_ar": name_ar, "order": order, "is_active": True},
        )
        return obj

    science = track(secondary, "Science", "علمي", 1)
    literature = track(secondary, "Literature", "أدبي", 2)
    faculties = {
        "Engineering": track(college, "Engineering", "الهندسة", 1),
        "Medicine": track(college, "Medicine", "الطب", 2),
        "Business": track(college, "Business", "التجارة", 3),
    }

    # --- Stage ↔ subject links (only wire subjects that exist) ----------
    subs = {s.name_en: s for s in Subject.objects.all()}

    def link(vertical, track_obj, names):
        for i, name in enumerate(names):
            subject = subs.get(name)
            if subject is None:
                continue
            StageSubject.objects.get_or_create(
                vertical=vertical, track=track_obj, subject=subject,
                defaults={"order": i, "is_active": True},
            )

    link(primary, None, ["Mathematics", "Science", "English", "Arabic"])
    link(secondary, science, ["Mathematics", "Physics", "Chemistry", "Biology"])
    link(secondary, literature, ["Arabic", "English"])
    link(college, faculties["Engineering"], ["Mathematics", "Physics"])
    link(college, faculties["Medicine"], ["Biology", "Chemistry"])
    link(college, faculties["Business"], ["English", "Mathematics"])


def backwards(apps, schema_editor):
    # Non-destructive: leave seeded rows in place.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_vertical_child_kind_vertical_is_active_and_more"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
