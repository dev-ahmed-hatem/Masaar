"""Seed baseline reference data: markets, verticals, grade levels, subjects,
sample lesson categories, and sample manual-payment accounts.

Idempotent — safe to run repeatedly.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market, PaymentAccount


class Command(BaseCommand):
    help = "Seed baseline reference data for Masaar."

    @transaction.atomic
    def handle(self, *args, **options):
        # --- Markets -------------------------------------------------------
        eg, _ = Market.objects.get_or_create(
            code=Market.Code.EG,
            defaults={"name": "Egypt", "currency": "EGP", "timezone": "Africa/Cairo"},
        )
        sa, _ = Market.objects.get_or_create(
            code=Market.Code.SA,
            defaults={"name": "Saudi Arabia", "currency": "SAR", "timezone": "Asia/Riyadh"},
        )

        # --- Verticals -----------------------------------------------------
        verticals = {}
        for order, (code, en, ar) in enumerate(
            [
                (Vertical.Code.PRIMARY, "Primary (KG–G12)", "المرحلة الابتدائية والثانوية"),
                (Vertical.Code.UNIVERSITY, "University", "الجامعة"),
                (Vertical.Code.HIGHER_ED, "Higher education", "الدراسات العليا"),
            ]
        ):
            v, _ = Vertical.objects.get_or_create(
                code=code, defaults={"name_en": en, "name_ar": ar, "order": order}
            )
            verticals[code] = v

        # --- Grade levels --------------------------------------------------
        primary_levels = [("KG", "روضة")] + [
            (f"Grade {i}", f"الصف {i}") for i in range(1, 13)
        ]
        self._levels(verticals[Vertical.Code.PRIMARY], primary_levels)
        self._levels(
            verticals[Vertical.Code.UNIVERSITY],
            [(f"Year {i}", f"السنة {i}") for i in range(1, 6)],
        )
        self._levels(
            verticals[Vertical.Code.HIGHER_ED],
            [("BSc", "بكالوريوس"), ("Master", "ماجستير"), ("PhD", "دكتوراه")],
        )

        # --- Subjects ------------------------------------------------------
        subjects = {}
        for en, ar in [
            ("Mathematics", "الرياضيات"),
            ("Science", "العلوم"),
            ("English", "اللغة الإنجليزية"),
            ("Arabic", "اللغة العربية"),
            ("Physics", "الفيزياء"),
            ("Chemistry", "الكيمياء"),
            ("Biology", "الأحياء"),
        ]:
            s, _ = Subject.objects.get_or_create(name_en=en, defaults={"name_ar": ar})
            subjects[en] = s

        # --- Sample lesson categories -------------------------------------
        g4_eg = GradeLevel.objects.get(
            vertical=verticals[Vertical.Code.PRIMARY], name_en="Grade 4"
        )
        # EG · Primary · Grade 4 · Math = 60.00 EGP (teacher wage 35.00) — the spec example.
        self._category(eg, verticals[Vertical.Code.PRIMARY], g4_eg, subjects["Mathematics"], 6000, 3500, "EGP")
        self._category(eg, verticals[Vertical.Code.PRIMARY], g4_eg, subjects["Science"], 6000, 3500, "EGP")
        # SA · Primary · Grade 4 · Math = 40.00 SAR (teacher wage 25.00).
        self._category(sa, verticals[Vertical.Code.PRIMARY], g4_eg, subjects["Mathematics"], 4000, 2500, "SAR")

        # --- Sample payment accounts (manual transfer targets) ------------
        PaymentAccount.objects.get_or_create(
            market=eg,
            display_name="Masaar — Bank (EG)",
            defaults={
                "kind": PaymentAccount.Kind.BANK,
                "details": "IBAN: EG000000000000000000000000000",
                "instructions": "Transfer the exact amount and upload the receipt.",
                "sort_order": 0,
            },
        )
        PaymentAccount.objects.get_or_create(
            market=sa,
            display_name="Masaar — Bank (SA)",
            defaults={
                "kind": PaymentAccount.Kind.BANK,
                "details": "IBAN: SA0000000000000000000000",
                "instructions": "Transfer the exact amount and upload the receipt.",
                "sort_order": 0,
            },
        )

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(
            f"  markets={Market.objects.count()} verticals={Vertical.objects.count()} "
            f"grade_levels={GradeLevel.objects.count()} subjects={Subject.objects.count()} "
            f"lesson_categories={LessonCategory.objects.count()} "
            f"payment_accounts={PaymentAccount.objects.count()}"
        )

    def _levels(self, vertical, pairs):
        for order, (en, ar) in enumerate(pairs):
            GradeLevel.objects.get_or_create(
                vertical=vertical,
                name_en=en,
                defaults={"name_ar": ar, "order": order},
            )

    def _category(self, market, vertical, grade, subject, price, wage, currency):
        LessonCategory.objects.get_or_create(
            market=market,
            vertical=vertical,
            grade_level=grade,
            subject=subject,
            defaults={
                "student_price_minor": price,
                "teacher_wage_minor": wage,
                "currency": currency,
            },
        )
