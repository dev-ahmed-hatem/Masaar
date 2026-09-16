"""Test helpers for building a teacher's stage cards."""
from apps.teachers.models import AvailabilityRule, TeacherStage, TeacherStageSubject

ALL_WEEK = [(wd, "00:00", "23:59") for wd in range(7)]


def make_stage_card(teacher, vertical, subjects, *, track=None, price_minor=6000,
                    free_lessons_offered=0, windows=ALL_WEEK):
    card = TeacherStage.objects.create(
        teacher=teacher, vertical=vertical, track=track,
        price_minor=price_minor, free_lessons_offered=free_lessons_offered,
    )
    for subject in subjects:
        TeacherStageSubject.objects.create(teacher_stage=card, subject=subject)
    for weekday, start, end in windows:
        AvailabilityRule.objects.create(
            teacher=teacher, teacher_stage=card, weekday=weekday, start_time=start, end_time=end
        )
    return card


def booking_lesson(card, subject):
    """Booking kwargs describing what was booked within a card."""
    return {"teacher_stage": card, "vertical": card.vertical, "track": card.track, "subject": subject}
