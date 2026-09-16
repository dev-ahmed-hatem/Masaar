"""Copy what was booked from the lesson category onto the booking and link the
teacher's matching stage card (preferring a card that includes the subject)."""
from django.db import migrations


def forwards(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")
    TeacherStage = apps.get_model("teachers", "TeacherStage")

    for booking in Booking.objects.select_related("lesson_category"):
        category = booking.lesson_category
        cards = TeacherStage.objects.filter(
            teacher_id=booking.teacher_id, vertical_id=category.vertical_id
        )
        card = cards.filter(subjects__subject_id=category.subject_id).first() or cards.first()
        booking.vertical_id = category.vertical_id
        booking.subject_id = category.subject_id
        booking.teacher_stage = card
        booking.track_id = card.track_id if card else None
        booking.save(update_fields=["vertical", "subject", "teacher_stage", "track"])


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0003_booking_stage_snapshot"),
        ("teachers", "0010_backfill_stage_cards"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
