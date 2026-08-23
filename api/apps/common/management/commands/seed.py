"""Seed baseline reference data: markets, verticals, grade levels, subjects,
sample lesson categories, and sample manual-payment accounts.

Idempotent — safe to run repeatedly.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.catalog.models import (
    GradeLevel,
    LessonCategory,
    StageSubject,
    Subject,
    Track,
    Vertical,
)
from apps.markets.models import Market, PaymentAccount
from apps.payments import services as wallet_services
from apps.payments.models import Package, Receipt, Wallet
from apps.teachers.models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherPrice,
    TeacherProfile,
    TeacherSpecialization,
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

        # --- Super-admin so the dashboard is reachable on a fresh deploy ----
        admin, admin_created = User.objects.get_or_create(
            phone="+201000000000",
            defaults={
                "full_name": "Dev Admin", "role": User.Role.SUPERADMIN,
                "market": eg, "is_verified": True, "is_staff": True, "is_superuser": True,
            },
        )
        if admin_created:
            admin.set_password("Admin12345")
            admin.save(update_fields=["password"])

        # --- Stages (verticals) -------------------------------------------
        verticals = {}
        for order, (code, en, ar, kind) in enumerate(
            [
                (Vertical.Code.PRIMARY, "Primary", "المرحلة الابتدائية", Vertical.ChildKind.NONE),
                (Vertical.Code.SECONDARY, "Secondary", "المرحلة الثانوية", Vertical.ChildKind.BRANCH),
                (Vertical.Code.COLLEGE, "College", "الكلية", Vertical.ChildKind.FACULTY),
            ]
        ):
            v, _ = Vertical.objects.get_or_create(
                code=code,
                defaults={"name_en": en, "name_ar": ar, "order": order, "child_kind": kind},
            )
            verticals[code] = v
        primary = verticals[Vertical.Code.PRIMARY]
        secondary = verticals[Vertical.Code.SECONDARY]
        college = verticals[Vertical.Code.COLLEGE]

        # --- Grade levels (optional refinement) ---------------------------
        self._levels(primary, [("KG", "روضة")] + [(f"Grade {i}", f"الصف {i}") for i in range(1, 10)])
        self._levels(secondary, [(f"Grade {i}", f"الصف {i}") for i in range(10, 13)])
        self._levels(college, [(f"Year {i}", f"السنة {i}") for i in range(1, 5)])

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

        # --- Tracks (branches / faculties) --------------------------------
        def track(vertical, en, ar, order):
            t, _ = Track.objects.get_or_create(
                vertical=vertical, name_en=en, defaults={"name_ar": ar, "order": order}
            )
            return t

        science = track(secondary, "Science", "علمي", 1)
        literature = track(secondary, "Literature", "أدبي", 2)
        eng_fac = track(college, "Engineering", "الهندسة", 1)
        med_fac = track(college, "Medicine", "الطب", 2)
        biz_fac = track(college, "Business", "التجارة", 3)

        # --- Stage ↔ subject links ----------------------------------------
        def link(vertical, track_obj, names):
            for i, name in enumerate(names):
                StageSubject.objects.get_or_create(
                    vertical=vertical, track=track_obj, subject=subjects[name],
                    defaults={"order": i},
                )

        link(primary, None, ["Mathematics", "Science", "English", "Arabic"])
        link(secondary, science, ["Mathematics", "Physics", "Chemistry", "Biology"])
        link(secondary, literature, ["Arabic", "English"])
        link(college, eng_fac, ["Mathematics", "Physics"])
        link(college, med_fac, ["Biology", "Chemistry"])
        link(college, biz_fac, ["English", "Mathematics"])

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

        # --- Sample specialization tags (discovery) -----------------------
        def specialize(teacher, vertical, track_obj, subject_name):
            TeacherSpecialization.objects.get_or_create(
                teacher=teacher, vertical=vertical, track=track_obj, subject=subjects[subject_name]
            )

        specialize(t_ahmed, primary, None, "Mathematics")
        specialize(t_ahmed, primary, None, "Science")
        specialize(t_ahmed, secondary, science, "Physics")
        specialize(t_sara, primary, None, "Mathematics")

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

        # --- Sample chat thread (student ↔ Sara) so the messages UI demos ---
        from apps.chat import services as chat_services
        from apps.chat.models import Thread

        if not Thread.objects.filter(student=student, teacher=t_sara).exists():
            thread, _ = chat_services.get_or_create_thread(student, t_sara)
            chat_services.send_message(
                thread, student, "Hello! Do you have availability for Grade 4 maths this week?"
            )
            chat_services.send_message(
                thread, t_sara.user, "Hi Omar! Yes — Sunday or Tuesday after 4pm works."
            )
            chat_services.send_message(thread, student, "Great, I'll book a Sunday slot. Thanks!")

        # --- A pending custom-price request (for the moderation queue) -----
        TeacherPrice.objects.get_or_create(
            teacher=t_ahmed, lesson_category=eg_science,
            defaults={"custom_student_price_minor": 7000, "is_approved": False},
        )

        # --- Sample bookings so the teacher/admin screens have real activity,
        #     since the student app (which would create these) is not built yet.
        from datetime import timedelta as _td

        from django.utils import timezone as _tz

        from apps.bookings.models import Booking
        from apps.reviews import services as review_services
        from apps.reviews.models import Review

        # A pending request Sara can Confirm/Decline from her Lessons screen
        # (wallet reserved like a real booking so those actions settle cleanly).
        if not Booking.objects.filter(
            student=student, teacher=t_sara, status=Booking.Status.REQUESTED
        ).exists():
            pending = Booking.objects.create(
                student=student, teacher=t_sara, lesson_category=eg_math,
                scheduled_start=_tz.now() + _td(days=2, hours=1), duration_min=60,
                price_minor=5500, teacher_wage_minor=3500, currency="EGP",
                status=Booking.Status.REQUESTED,
            )
            wallet_services.reserve(
                wallet_services.get_or_create_wallet(student), 5500, booking=pending
            )

        # A completed, settled lesson for Ahmed -> powers Payouts + Earnings,
        # and carries a published review for the Reviews-moderation screen.
        done = Booking.objects.filter(
            student=student, teacher=t_ahmed, status=Booking.Status.COMPLETED
        ).first()
        if done is None:
            done = Booking.objects.create(
                student=student, teacher=t_ahmed, lesson_category=eg_math,
                scheduled_start=_tz.now() - _td(days=3), duration_min=60,
                completed_at=_tz.now() - _td(days=3),
                price_minor=6000, teacher_wage_minor=3500, currency="EGP",
                status=Booking.Status.COMPLETED, wage_settled=True,
            )
        if not Review.objects.filter(booking=done).exists():
            review_services.create_review(
                student, done, 5, "Clear explanations and very patient — highly recommended."
            )

        # A teacher who must set a new password on first sign-in, so the forced
        # password-change screen is testable without reading a temp password.
        nour, created = User.objects.get_or_create(
            phone="+201444444401",
            defaults={
                "full_name": "Nour Hassan", "role": User.Role.TEACHER,
                "market": eg, "is_verified": True, "must_change_password": True,
            },
        )
        if created:
            nour.set_password("Temp12345")
            nour.save(update_fields=["password"])
            TeacherProfile.objects.get_or_create(
                user=nour, defaults={"market": eg, "is_published": False}
            )

        # --- Sample lesson packages (EG) — priced at face value; discount
        #     structure is a §16 open item, so a grant equals what's paid. ----
        for name, credits in [("Starter — 5 lessons", 5), ("Value — 10 lessons", 10)]:
            Package.objects.get_or_create(
                market=eg,
                name=name,
                defaults={"credits": credits, "price_minor": credits * 6000, "currency": "EGP"},
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
            f"packages={Package.objects.count()} "
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
