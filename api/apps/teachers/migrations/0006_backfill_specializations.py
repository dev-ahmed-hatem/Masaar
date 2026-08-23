"""Seed TeacherSpecialization from each teacher's existing offerings.

Every TeacherSubject (a LessonCategory the teacher teaches) yields one
specialization (stage + subject, track left null for the teacher to refine).
Idempotent via get_or_create.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    TeacherSubject = apps.get_model("teachers", "TeacherSubject")
    TeacherSpecialization = apps.get_model("teachers", "TeacherSpecialization")

    for ts in TeacherSubject.objects.select_related("lesson_category").all():
        cat = ts.lesson_category
        TeacherSpecialization.objects.get_or_create(
            teacher_id=ts.teacher_id,
            vertical_id=cat.vertical_id,
            track=None,
            subject_id=cat.subject_id,
        )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("teachers", "0005_teacherspecialization"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
