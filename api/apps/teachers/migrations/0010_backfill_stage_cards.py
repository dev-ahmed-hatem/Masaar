"""Best-effort conversion of the old per-subject teaching setup into stage cards.

Cards come from specialization tags (stage/track/subject) plus lesson-category
subjects in stages without branches. A card's price is the old stage price, else
the market's stage minimum, else 0 ("not set": the card isn't bookable and the
teacher is unpublished until they set one — such stages weren't bookable before
either). Existing weekly availability is copied to every card of the teacher.
"""
from django.db import migrations


def _cards_from(specializations, category_subjects, child_kinds):
    cards: dict[tuple, list] = {}
    for vertical_id, track_id, subject_id in specializations:
        subs = cards.setdefault((vertical_id, track_id), [])
        if subject_id not in subs:
            subs.append(subject_id)
    for vertical_id, subject_id in category_subjects:
        if child_kinds.get(vertical_id) != "NONE":
            continue
        subs = cards.setdefault((vertical_id, None), [])
        if subject_id not in subs:
            subs.append(subject_id)
    return cards


def forwards(apps, schema_editor):
    Vertical = apps.get_model("catalog", "Vertical")
    LessonCategory = apps.get_model("catalog", "LessonCategory")
    TeacherProfile = apps.get_model("teachers", "TeacherProfile")
    TeacherApplication = apps.get_model("teachers", "TeacherApplication")
    TeacherSpecialization = apps.get_model("teachers", "TeacherSpecialization")
    TeacherSubject = apps.get_model("teachers", "TeacherSubject")
    TeacherStagePrice = apps.get_model("teachers", "TeacherStagePrice")
    StagePricingRule = apps.get_model("catalog", "StagePricingRule")
    TeacherStage = apps.get_model("teachers", "TeacherStage")
    TeacherStageSubject = apps.get_model("teachers", "TeacherStageSubject")
    AvailabilityRule = apps.get_model("teachers", "AvailabilityRule")

    child_kinds = dict(Vertical.objects.values_list("id", "child_kind"))

    for teacher in TeacherProfile.objects.all():
        cards = _cards_from(
            TeacherSpecialization.objects.filter(teacher=teacher).values_list(
                "vertical_id", "track_id", "subject_id"
            ),
            TeacherSubject.objects.filter(teacher=teacher).values_list(
                "lesson_category__vertical_id", "lesson_category__subject_id"
            ),
            child_kinds,
        )
        prices = dict(
            TeacherStagePrice.objects.filter(teacher=teacher).values_list("vertical_id", "price_minor")
        )
        rules = list(AvailabilityRule.objects.filter(teacher=teacher, teacher_stage__isnull=True))
        minimums = dict(
            StagePricingRule.objects.filter(market_id=teacher.market_id, is_active=True).values_list(
                "vertical_id", "min_price_minor"
            )
        )
        first, unpriced = True, False
        for (vertical_id, track_id), subject_ids in cards.items():
            price = prices.get(vertical_id) or minimums.get(vertical_id) or 0
            unpriced = unpriced or price <= 0
            card = TeacherStage.objects.create(
                teacher=teacher,
                vertical_id=vertical_id,
                track_id=track_id,
                price_minor=price,
                free_lessons_offered=teacher.free_lessons_offered,
            )
            TeacherStageSubject.objects.bulk_create(
                [TeacherStageSubject(teacher_stage=card, subject_id=sid) for sid in subject_ids]
            )
            if first:
                AvailabilityRule.objects.filter(id__in=[r.id for r in rules]).update(teacher_stage=card)
                first = False
            else:
                AvailabilityRule.objects.bulk_create(
                    [
                        AvailabilityRule(
                            teacher=teacher,
                            teacher_stage=card,
                            weekday=r.weekday,
                            start_time=r.start_time,
                            end_time=r.end_time,
                        )
                        for r in rules
                    ]
                )
        AvailabilityRule.objects.filter(teacher=teacher, teacher_stage__isnull=True).delete()
        if teacher.is_published and (unpriced or not cards):
            teacher.is_published = False
            teacher.save(update_fields=["is_published"])

    categories = dict(
        (cid, (vid, sid))
        for cid, vid, sid in LessonCategory.objects.values_list("id", "vertical_id", "subject_id")
    )
    for application in TeacherApplication.objects.all():
        specs = [
            (sp.get("vertical"), sp.get("track"), sp.get("subject"))
            for sp in application.specializations or []
            if isinstance(sp, dict)
        ]
        cat_subjects = [categories[c] for c in application.subjects or [] if c in categories]
        cards = _cards_from(specs, cat_subjects, child_kinds)
        prices = {
            sp.get("vertical"): sp.get("price_minor")
            for sp in application.stage_prices or []
            if isinstance(sp, dict)
        }
        application.stages = [
            {
                "vertical": vertical_id,
                "track": track_id,
                "subjects": subject_ids,
                "price_minor": prices.get(vertical_id) or 0,
                "free_lessons_offered": application.free_lessons_offered,
                "availability": list(application.availability or []),
            }
            for (vertical_id, track_id), subject_ids in cards.items()
        ]
        application.save(update_fields=["stages"])


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0005_remove_lessoncategory_currency_and_more"),
        ("teachers", "0009_teacher_stage_cards"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
