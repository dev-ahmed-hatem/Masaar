"""Seed baseline reference data: markets, verticals, grade levels, subjects,
sample lesson categories, and sample manual-payment accounts.

Idempotent — safe to run repeatedly.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.catalog.models import GradeLevel, LessonCategory, Subject, Vertical
from apps.markets.models import Market, PaymentAccount
from apps.payments import services as wallet_services
from apps.payments.models import Receipt, Wallet
from apps.teachers.models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherPrice,
    TeacherProfile,
    TeacherSubject,
)


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

        # --- Sample published teachers (for discovery / admin browser) ----
        eg_math = LessonCategory.objects.get(
            market=eg, grade_level=g4_eg, subject=subjects["Mathematics"]
        )
        eg_science = LessonCategory.objects.get(
            market=eg, grade_level=g4_eg, subject=subjects["Science"]
        )

        t_ahmed = self._teacher(
            eg, "+201111111101", "Ahmed Fathy", gender=TeacherProfile.Gender.MALE,
            rating=4.7, count=18, lessons=120, free=1, bio_en="Maths & science tutor, 8 years.",
        )
        self._offer(t_ahmed, eg_math)
        self._offer(t_ahmed, eg_science)
        self._availability(t_ahmed, [AvailabilityRule.Weekday.MON, AvailabilityRule.Weekday.WED])

        t_sara = self._teacher(
            eg, "+201111111102", "Sara Nabil", gender=TeacherProfile.Gender.FEMALE,
            rating=4.9, count=42, lessons=310, free=2, bio_en="Patient maths teacher for primary.",
        )
        self._offer(t_sara, eg_math)
        # An approved per-teacher discount below the category default (6000).
        TeacherPrice.objects.get_or_create(
            teacher=t_sara, lesson_category=eg_math,
            defaults={"custom_student_price_minor": 5500, "is_approved": True},
        )
        self._availability(t_sara, [AvailabilityRule.Weekday.SUN, AvailabilityRule.Weekday.TUE])

        # --- Sample student with a funded wallet (for booking demos) ------
        student, created = User.objects.get_or_create(
            phone="+201333333301",
            defaults={
                "full_name": "Omar Student",
                "role": User.Role.STUDENT,
                "market": eg,
                "is_verified": True,
            },
        )
        if created:
            student.set_password("Student12345")
            student.save(update_fields=["password"])
        if not Wallet.objects.filter(user=student).exists():
            wallet_services.credit(wallet_services.get_or_create_wallet(student), 50000)
        # A pending top-up receipt so the verification queue has something to review.
        if not Receipt.objects.filter(user=student).exists():
            Receipt.objects.create(
                user=student, market=eg, amount_minor=10000, currency="EGP",
                method=Receipt.Method.BANK, reference="SEED-TXN-001",
                purpose=Receipt.Purpose.TOPUP, status=Receipt.Status.PENDING,
            )

        # --- Sample pending teacher applications (for the review queue) ---
        for full_name, phone, bio in [
            ("Mona Adel", "+201222222201", "Physics & chemistry, 5 years of prep-school tutoring."),
            ("Khaled Omar", "+201222222202", "English language and IELTS coach."),
        ]:
            TeacherApplication.objects.get_or_create(
                phone=phone,
                status=TeacherApplication.Status.PENDING,
                defaults={
                    "full_name": full_name,
                    "market": eg,
                    "bio": bio,
                    "intro_video_url": "https://youtu.be/dQw4w9WgXcQ",
                },
            )

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
            f"teachers={TeacherProfile.objects.count()} "
            f"applications={TeacherApplication.objects.count()} "
            f"students={User.objects.filter(role=User.Role.STUDENT).count()} "
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

    def _teacher(self, market, phone, full_name, *, gender, rating, count, lessons, free, bio_en):
        user, created = User.objects.get_or_create(
            phone=phone,
            defaults={
                "full_name": full_name,
                "role": User.Role.TEACHER,
                "market": market,
                "is_verified": True,
            },
        )
        if created:
            user.set_password("Teacher12345")
            user.save(update_fields=["password"])
        profile, _ = TeacherProfile.objects.get_or_create(
            user=user,
            defaults={
                "market": market,
                "gender": gender,
                "languages": "ar,en",
                "bio_en": bio_en,
                "rating_avg": rating,
                "rating_count": count,
                "lessons_count": lessons,
                "free_lessons_offered": free,
                "is_published": True,
            },
        )
        return profile

    def _offer(self, teacher, lesson_category):
        TeacherSubject.objects.get_or_create(teacher=teacher, lesson_category=lesson_category)

    def _availability(self, teacher, weekdays):
        for weekday in weekdays:
            AvailabilityRule.objects.get_or_create(
                teacher=teacher,
                weekday=weekday,
                start_time="16:00",
                end_time="20:00",
            )
