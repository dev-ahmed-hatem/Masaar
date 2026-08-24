"""Seed baseline reference data + rich demo content for Masaar.

Reference data (markets, catalog, teachers, students, packages, payment
accounts) is idempotent via get_or_create. The transactional demo activity
(bookings across every status, reviews, payouts, chats, notifications) is
seeded only on a fresh database (guarded by "no bookings exist"), so re-runs
never pile up duplicates.
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings import services as booking_services
from apps.bookings.models import Booking
from apps.catalog.models import (
    GradeLevel,
    LessonCategory,
    StageSubject,
    Subject,
    Track,
    Vertical,
)
from apps.chat import services as chat_services
from apps.markets.models import Market, PaymentAccount
from apps.notifications.services import notify
from apps.payments import services as wallet_services
from apps.payments.models import Package, Receipt, Wallet
from apps.payouts import services as payout_services
from apps.reviews.models import Review
from apps.teachers.models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherPrice,
    TeacherProfile,
    TeacherSpecialization,
    TeacherSubject,
)

W = AvailabilityRule.Weekday
YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # placeholder intro video


class Command(BaseCommand):
    help = "Seed baseline reference data + rich demo content for Masaar."

    @transaction.atomic
    def handle(self, *args, **options):
        eg, _ = Market.objects.get_or_create(
            code=Market.Code.EG,
            defaults={"name": "Egypt", "currency": "EGP", "timezone": "Africa/Cairo"},
        )
        sa, _ = Market.objects.get_or_create(
            code=Market.Code.SA,
            defaults={"name": "Saudi Arabia", "currency": "SAR", "timezone": "Asia/Riyadh"},
        )

        # --- Super-admin ---------------------------------------------------
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
        for order, (code, en, ar, kind) in enumerate([
            (Vertical.Code.PRIMARY, "Primary", "المرحلة الابتدائية", Vertical.ChildKind.NONE),
            (Vertical.Code.SECONDARY, "Secondary", "المرحلة الثانوية", Vertical.ChildKind.BRANCH),
            (Vertical.Code.COLLEGE, "College", "الكلية", Vertical.ChildKind.FACULTY),
        ]):
            v, _ = Vertical.objects.get_or_create(
                code=code,
                defaults={"name_en": en, "name_ar": ar, "order": order, "child_kind": kind},
            )
            verticals[code] = v
        primary = verticals[Vertical.Code.PRIMARY]
        secondary = verticals[Vertical.Code.SECONDARY]
        college = verticals[Vertical.Code.COLLEGE]

        # --- Grade levels --------------------------------------------------
        self._levels(primary, [("KG", "روضة")] + [(f"Grade {i}", f"الصف {i}") for i in range(1, 10)])
        self._levels(secondary, [(f"Grade {i}", f"الصف {i}") for i in range(10, 13)])
        self._levels(college, [(f"Year {i}", f"السنة {i}") for i in range(1, 5)])

        # --- Subjects ------------------------------------------------------
        subjects = {}
        for en, ar in [
            ("Mathematics", "الرياضيات"), ("Science", "العلوم"), ("English", "اللغة الإنجليزية"),
            ("Arabic", "اللغة العربية"), ("Physics", "الفيزياء"), ("Chemistry", "الكيمياء"),
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
        tracks = {"science": science, "literature": literature, "eng": eng_fac, "med": med_fac, "biz": biz_fac}

        # --- Stage ↔ subject links ----------------------------------------
        def link(vertical, track_obj, names):
            for i, name in enumerate(names):
                StageSubject.objects.get_or_create(
                    vertical=vertical, track=track_obj, subject=subjects[name], defaults={"order": i}
                )

        link(primary, None, ["Mathematics", "Science", "English", "Arabic"])
        link(secondary, science, ["Mathematics", "Physics", "Chemistry", "Biology"])
        link(secondary, literature, ["Arabic", "English"])
        link(college, eng_fac, ["Mathematics", "Physics"])
        link(college, med_fac, ["Biology", "Chemistry"])
        link(college, biz_fac, ["English", "Mathematics"])

        # --- Lesson categories (priced per market) ------------------------
        g_primary = GradeLevel.objects.get(vertical=primary, name_en="Grade 4")
        g_sec = GradeLevel.objects.get(vertical=secondary, name_en="Grade 11")
        g_col = GradeLevel.objects.get(vertical=college, name_en="Year 1")
        vmap = {"primary": (primary, g_primary), "secondary": (secondary, g_sec), "college": (college, g_col)}

        eg_prices = {
            "primary": {"Mathematics": (6000, 3500), "Science": (6000, 3500), "English": (6500, 3800), "Arabic": (5500, 3200)},
            "secondary": {"Physics": (9000, 5500), "Chemistry": (9000, 5500), "Biology": (8500, 5000), "Mathematics": (9000, 5500), "English": (8000, 4800)},
            "college": {"Mathematics": (12000, 7500), "Physics": (12000, 7500), "Biology": (13000, 8000), "Chemistry": (12500, 7800), "English": (11000, 6800)},
        }
        sa_prices = {
            "primary": {"Mathematics": (4000, 2500)},
            "secondary": {"Physics": (6000, 3800), "English": (5500, 3400)},
        }
        for vkey, subs in eg_prices.items():
            v, g = vmap[vkey]
            for sname, (p, wg) in subs.items():
                self._category(eg, v, g, subjects[sname], p, wg, "EGP")
        for vkey, subs in sa_prices.items():
            v, g = vmap[vkey]
            for sname, (p, wg) in subs.items():
                self._category(sa, v, g, subjects[sname], p, wg, "SAR")

        def cat(market, vkey, sname):
            v, g = vmap[vkey]
            return LessonCategory.objects.get(market=market, vertical=v, grade_level=g, subject=subjects[sname])

        # --- Teacher roster ------------------------------------------------
        roster = [
            {"m": eg, "phone": "+201111111101", "name": "Ahmed Fathy", "g": "MALE", "rating": 4.7, "count": 128, "lessons": 128, "free": 1, "video": YT,
             "bio_en": "Maths & science tutor with 8 years helping primary and prep students build strong fundamentals.",
             "bio_ar": "مدرّس رياضيات وعلوم بخبرة 8 سنوات في تأسيس طلاب المرحلة الابتدائية والإعدادية.",
             "offer": [("primary", "Mathematics"), ("primary", "Science"), ("secondary", "Physics")],
             "spec": [("primary", None, "Mathematics"), ("primary", None, "Science"), ("secondary", "science", "Physics")],
             "avail": [(W.MON, "16:00", "20:00"), (W.WED, "16:00", "20:00")]},
            {"m": eg, "phone": "+201111111102", "name": "Sara Nabil", "g": "FEMALE", "rating": 4.9, "count": 312, "lessons": 312, "free": 2, "video": YT,
             "bio_en": "Patient primary maths and English teacher who makes every lesson feel approachable.",
             "bio_ar": "معلّمة رياضيات ولغة إنجليزية للمرحلة الابتدائية، أسلوبها بسيط ومحبّب.",
             "offer": [("primary", "Mathematics"), ("primary", "English")],
             "spec": [("primary", None, "Mathematics"), ("primary", None, "English")],
             "avail": [(W.SUN, "16:00", "20:00"), (W.TUE, "16:00", "20:00")]},
            {"m": eg, "phone": "+201111111103", "name": "Mona Adel", "g": "FEMALE", "rating": 4.8, "count": 96, "lessons": 96, "free": 0,
             "bio_en": "Secondary physics and chemistry specialist focused on Thanaweya Amma exam technique.",
             "bio_ar": "متخصصة في فيزياء وكيمياء الثانوية العامة مع تركيز على مهارات الامتحان.",
             "offer": [("secondary", "Physics"), ("secondary", "Chemistry")],
             "spec": [("secondary", "science", "Physics"), ("secondary", "science", "Chemistry")],
             "avail": [(W.SAT, "17:00", "21:00"), (W.MON, "17:00", "21:00")]},
            {"m": eg, "phone": "+201111111104", "name": "Khaled Omar", "g": "MALE", "rating": 4.6, "count": 210, "lessons": 210, "free": 1, "video": YT,
             "bio_en": "English language and IELTS coach — conversation, writing and exam prep for all levels.",
             "bio_ar": "مدرّب لغة إنجليزية وآيلتس: محادثة وكتابة وتحضير للامتحانات لكل المستويات.",
             "offer": [("primary", "English"), ("secondary", "English"), ("college", "English")],
             "spec": [("primary", None, "English"), ("secondary", "literature", "English"), ("college", "biz", "English")],
             "avail": [(W.SUN, "18:00", "22:00"), (W.WED, "18:00", "22:00"), (W.THU, "18:00", "22:00")]},
            {"m": eg, "phone": "+201111111105", "name": "Layla Mansour", "g": "FEMALE", "rating": 5.0, "count": 54, "lessons": 54, "free": 1,
             "bio_en": "Arabic language teacher passionate about grammar, literature and expressive writing.",
             "bio_ar": "معلّمة لغة عربية شغوفة بالنحو والأدب والتعبير الكتابي.",
             "offer": [("primary", "Arabic"), ("secondary", "English")],
             "spec": [("primary", None, "Arabic"), ("secondary", "literature", "Arabic"), ("secondary", "literature", "English")],
             "avail": [(W.FRI, "10:00", "14:00"), (W.SAT, "10:00", "14:00")]},
            {"m": eg, "phone": "+201111111106", "name": "Youssef Hany", "g": "MALE", "rating": 4.5, "count": 74, "lessons": 74, "free": 0,
             "bio_en": "Engineering-track tutor for university calculus and physics fundamentals.",
             "bio_ar": "مدرّس لطلاب كليات الهندسة في التفاضل والتكامل وأساسيات الفيزياء.",
             "offer": [("college", "Mathematics"), ("college", "Physics")],
             "spec": [("college", "eng", "Mathematics"), ("college", "eng", "Physics")],
             "avail": [(W.MON, "19:00", "22:00"), (W.WED, "19:00", "22:00")]},
            {"m": eg, "phone": "+201111111107", "name": "Dina Samir", "g": "FEMALE", "rating": 4.9, "count": 188, "lessons": 188, "free": 2, "video": YT,
             "bio_en": "Biology tutor for secondary science and pre-med students — clear diagrams, real examples.",
             "bio_ar": "مدرّسة أحياء لطلاب الثانوي العلمي وكليات الطب، شرح مبسّط بالرسومات والأمثلة.",
             "offer": [("secondary", "Biology"), ("college", "Biology")],
             "spec": [("secondary", "science", "Biology"), ("college", "med", "Biology")],
             "avail": [(W.SUN, "16:00", "20:00"), (W.TUE, "16:00", "20:00"), (W.THU, "16:00", "20:00")]},
            {"m": eg, "phone": "+201111111108", "name": "Tarek Zaki", "g": "MALE", "rating": 4.4, "count": 41, "lessons": 41, "free": 0,
             "bio_en": "Chemistry tutor covering secondary and first-year medical chemistry.",
             "bio_ar": "مدرّس كيمياء للمرحلة الثانوية وكيمياء السنة الأولى بكليات الطب.",
             "offer": [("secondary", "Chemistry"), ("college", "Chemistry")],
             "spec": [("secondary", "science", "Chemistry"), ("college", "med", "Chemistry")],
             "avail": [(W.SAT, "18:00", "21:00"), (W.MON, "18:00", "21:00")]},
            {"m": sa, "phone": "+966511111109", "name": "Faisal Al-Harbi", "g": "MALE", "rating": 4.8, "count": 133, "lessons": 133, "free": 1, "video": YT,
             "bio_en": "Physics and maths tutor for Saudi secondary students, exam-focused and encouraging.",
             "bio_ar": "مدرّس فيزياء ورياضيات لطلاب الثانوية في السعودية، يركّز على الاختبارات ويحفّز الطلاب.",
             "offer": [("primary", "Mathematics"), ("secondary", "Physics")],
             "spec": [("primary", None, "Mathematics"), ("secondary", "science", "Physics")],
             "avail": [(W.SUN, "17:00", "21:00"), (W.TUE, "17:00", "21:00")]},
            {"m": sa, "phone": "+966511111110", "name": "Huda Al-Qahtani", "g": "FEMALE", "rating": 4.7, "count": 90, "lessons": 90, "free": 1,
             "bio_en": "English teacher for Saudi learners — friendly, structured, results-driven.",
             "bio_ar": "معلّمة لغة إنجليزية للطلاب في السعودية، أسلوب ودود ومنظّم يركّز على النتائج.",
             "offer": [("secondary", "English")],
             "spec": [("secondary", "literature", "English")],
             "avail": [(W.MON, "18:00", "22:00"), (W.WED, "18:00", "22:00")]},
        ]

        T = {}
        for r in roster:
            profile = self._teacher(
                r["m"], r["phone"], r["name"], gender=getattr(TeacherProfile.Gender, r["g"]),
                rating=r["rating"], count=r["count"], lessons=r["lessons"], free=r["free"],
                bio_en=r["bio_en"], bio_ar=r.get("bio_ar", ""), video=r.get("video", ""),
            )
            for vkey, sname in r["offer"]:
                self._offer(profile, cat(r["m"], vkey, sname))
            for vkey, tkey, sname in r["spec"]:
                TeacherSpecialization.objects.get_or_create(
                    teacher=profile, vertical=vmap[vkey][0],
                    track=tracks[tkey] if tkey else None, subject=subjects[sname],
                )
            self._availability(profile, r["avail"])
            T[r["name"]] = profile

        # An approved per-teacher discount (Sara, primary maths) below default.
        TeacherPrice.objects.get_or_create(
            teacher=T["Sara Nabil"], lesson_category=cat(eg, "primary", "Mathematics"),
            defaults={"custom_student_price_minor": 5500, "is_approved": True},
        )
        # A pending custom-price request (admin moderation queue demo).
        TeacherPrice.objects.get_or_create(
            teacher=T["Ahmed Fathy"], lesson_category=cat(eg, "primary", "Science"),
            defaults={"custom_student_price_minor": 7000, "is_approved": False},
        )

        # --- Students (funded wallets) ------------------------------------
        S = {}
        for phone, name, market, credit in [
            ("+201333333301", "Omar Student", eg, 300000),
            ("+201333333302", "Yara Ali", eg, 250000),
            ("+201333333303", "Hassan Tarek", eg, 200000),
            ("+201333333304", "Nada Fouad", eg, 180000),
            ("+966533333305", "Sultan Al-Otaibi", sa, 200000),
        ]:
            S[name] = self._student(phone, name, market, credit)

        # A pending top-up receipt so the verification queue has content.
        if not Receipt.objects.filter(reference="SEED-TXN-001").exists():
            Receipt.objects.create(
                user=S["Omar Student"], market=eg, amount_minor=10000, currency="EGP",
                method=Receipt.Method.BANK, reference="SEED-TXN-001",
                purpose=Receipt.Purpose.TOPUP, status=Receipt.Status.PENDING,
            )

        # A teacher who must reset their password on first sign-in.
        nour, created = User.objects.get_or_create(
            phone="+201444444401",
            defaults={"full_name": "Nour Hassan", "role": User.Role.TEACHER,
                      "market": eg, "is_verified": True, "must_change_password": True},
        )
        if created:
            nour.set_password("Temp12345")
            nour.save(update_fields=["password"])
            TeacherProfile.objects.get_or_create(user=nour, defaults={"market": eg, "is_published": False})

        # --- Packages ------------------------------------------------------
        for name, credits in [("Starter — 5 lessons", 5), ("Value — 10 lessons", 10)]:
            Package.objects.get_or_create(
                market=eg, name=name,
                defaults={"credits": credits, "price_minor": credits * 6000, "currency": "EGP"},
            )
        Package.objects.get_or_create(
            market=sa, name="Starter — 5 lessons",
            defaults={"credits": 5, "price_minor": 5 * 4000, "currency": "SAR"},
        )

        # --- Pending teacher applications ---------------------------------
        for full_name, phone, bio in [
            ("Mona Adel", "+201222222201", "Physics & chemistry, 5 years of prep-school tutoring."),
            ("Khaled Omar", "+201222222202", "English language and IELTS coach."),
            ("Rana Saleh", "+201222222203", "Primary maths and science, playful and structured."),
        ]:
            TeacherApplication.objects.get_or_create(
                phone=phone, status=TeacherApplication.Status.PENDING,
                defaults={"full_name": full_name, "market": eg, "bio": bio, "intro_video_url": YT},
            )

        # --- Payment accounts ---------------------------------------------
        PaymentAccount.objects.get_or_create(
            market=eg, display_name="Masaar — Bank (EG)",
            defaults={"kind": PaymentAccount.Kind.BANK, "details": "IBAN: EG000000000000000000000000000",
                      "instructions": "Transfer the exact amount and upload the receipt.", "sort_order": 0},
        )
        PaymentAccount.objects.get_or_create(
            market=eg, display_name="Masaar — Vodafone Cash",
            defaults={"kind": PaymentAccount.Kind.WALLET, "details": "01000000000",
                      "instructions": "Send to this wallet number, then upload the confirmation.", "sort_order": 1},
        )
        PaymentAccount.objects.get_or_create(
            market=sa, display_name="Masaar — Bank (SA)",
            defaults={"kind": PaymentAccount.Kind.BANK, "details": "IBAN: SA0000000000000000000000",
                      "instructions": "Transfer the exact amount and upload the receipt.", "sort_order": 0},
        )

        # --- Rich demo activity (fresh DB only) ---------------------------
        if not Booking.objects.exists():
            self._seed_activity(admin, eg, sa, S, T, cat, subjects)

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(
            f"  markets={Market.objects.count()} verticals={Vertical.objects.count()} "
            f"tracks={Track.objects.count()} grade_levels={GradeLevel.objects.count()} "
            f"subjects={Subject.objects.count()} categories={LessonCategory.objects.count()} "
            f"teachers={TeacherProfile.objects.count()} students={User.objects.filter(role=User.Role.STUDENT).count()} "
            f"bookings={Booking.objects.count()} reviews={Review.objects.count()} "
            f"applications={TeacherApplication.objects.count()} packages={Package.objects.count()}"
        )

    # ------------------------------------------------------------------ demo activity
    def _seed_activity(self, admin, eg, sa, S, T, cat, subjects):
        now = timezone.now()
        td = timedelta

        # Active bookings. Created directly (bypassing slot validation) but with a
        # real wallet reserve + notification, so balances and bells look authentic.
        def active(student, teacher, c, when, status, link=""):
            price = booking_services.effective_price_minor(teacher, c)
            b = Booking.objects.create(
                student=student, teacher=teacher, lesson_category=c,
                scheduled_start=when, duration_min=60,
                price_minor=price, teacher_wage_minor=c.teacher_wage_minor, currency=c.currency,
                status=status, meeting_provider="ZOOM" if link else "", meeting_link=link,
            )
            if price > 0:
                wallet_services.reserve(wallet_services.get_or_create_wallet(student), price, booking=b)
            return b

        active(S["Omar Student"], T["Sara Nabil"], cat(eg, "primary", "Mathematics"), now + td(days=2, hours=1), Booking.Status.REQUESTED)
        active(S["Nada Fouad"], T["Dina Samir"], cat(eg, "college", "Biology"), now + td(days=5, hours=2), Booking.Status.REQUESTED)
        active(S["Yara Ali"], T["Ahmed Fathy"], cat(eg, "primary", "Mathematics"), now + td(days=1, hours=3), Booking.Status.CONFIRMED, link="https://zoom.us/j/000000000")
        active(S["Hassan Tarek"], T["Mona Adel"], cat(eg, "secondary", "Physics"), now + td(days=3, hours=1), Booking.Status.CONFIRMED, link="https://zoom.us/j/000000000")
        notify(T["Sara Nabil"].user, "booking_requested", {"student_name": "Omar Student", "subject": "Mathematics"})
        notify(S["Yara Ali"], "booking_confirmed", {"teacher_name": "Ahmed Fathy", "subject": "Mathematics"})

        # Completed lessons (+ reviews) — power earnings, payouts and profile reviews.
        completed = [
            (S["Omar Student"], T["Ahmed Fathy"], cat(eg, "primary", "Mathematics"), 3, 5, "Clear explanations and very patient — highly recommended."),
            (S["Yara Ali"], T["Sara Nabil"], cat(eg, "primary", "English"), 5, 5, "My daughter loves the lessons and improved fast."),
            (S["Hassan Tarek"], T["Mona Adel"], cat(eg, "secondary", "Physics"), 7, 4, "Great exam tips, helped me with tricky problems."),
            (S["Nada Fouad"], T["Dina Samir"], cat(eg, "college", "Biology"), 10, 5, "Made a hard topic feel simple. Thank you!"),
            (S["Omar Student"], T["Khaled Omar"], cat(eg, "secondary", "English"), 12, 4, "Good conversation practice and useful feedback."),
            (S["Yara Ali"], T["Ahmed Fathy"], cat(eg, "secondary", "Physics"), 6, 5, "Explains step by step — very organized."),
            (S["Sultan Al-Otaibi"], T["Faisal Al-Harbi"], cat(sa, "secondary", "Physics"), 4, 5, "Excellent teacher, always on time and prepared."),
        ]
        for student, teacher, c, days_ago, rating, text in completed:
            b = Booking.objects.create(
                student=student, teacher=teacher, lesson_category=c,
                scheduled_start=now - td(days=days_ago), duration_min=60,
                completed_at=now - td(days=days_ago) + td(hours=1),
                price_minor=c.student_price_minor, teacher_wage_minor=c.teacher_wage_minor,
                currency=c.currency, status=Booking.Status.COMPLETED, wage_settled=True,
                meeting_provider="ZOOM", meeting_link="https://zoom.us/j/000000000",
            )
            Review.objects.create(
                booking=b, student=student, teacher=teacher, rating=rating, text=text, is_published=True
            )

        # A few unhappy-path bookings so every status is represented.
        def _hist(student, teacher, c, days, status, **extra):
            Booking.objects.create(
                student=student, teacher=teacher, lesson_category=c,
                scheduled_start=now + td(days=days), duration_min=60,
                price_minor=c.student_price_minor, teacher_wage_minor=c.teacher_wage_minor,
                currency=c.currency, status=status, **extra,
            )

        _hist(S["Nada Fouad"], T["Sara Nabil"], cat(eg, "primary", "Mathematics"), -1,
              Booking.Status.CANCELLED, cancel_reason="Schedule conflict")
        _hist(S["Hassan Tarek"], T["Youssef Hany"], cat(eg, "college", "Mathematics"), 4,
              Booking.Status.DECLINED)
        _hist(S["Omar Student"], T["Tarek Zaki"], cat(eg, "secondary", "Chemistry"), -2,
              Booking.Status.NO_SHOW, wage_settled=True)

        # Payout cycles sweep the settled bookings into per-teacher items.
        period_start, period_end = date.today() - timedelta(days=30), date.today()
        eg_cycle = payout_services.generate_cycle(eg, period_start, period_end, created_by=admin)
        payout_services.generate_cycle(sa, period_start, period_end, created_by=admin)
        first_item = eg_cycle.items.order_by("id").first()
        if first_item:
            payout_services.mark_item_paid(first_item, reference="SEED-PAYOUT-001")

        # Chat threads with a short back-and-forth.
        convos = [
            (S["Omar Student"], T["Sara Nabil"], [
                ("s", "Hello! Do you have availability for Grade 4 maths this week?"),
                ("t", "Hi Omar! Yes — Sunday or Tuesday after 4pm works."),
                ("s", "Great, I'll book a Sunday slot. Thanks!"),
            ]),
            (S["Yara Ali"], T["Ahmed Fathy"], [
                ("s", "Can we focus on fractions next lesson?"),
                ("t", "Absolutely — I'll prepare extra practice on fractions."),
            ]),
            (S["Hassan Tarek"], T["Mona Adel"], [
                ("s", "Do you cover the full Thanaweya physics syllabus?"),
                ("t", "Yes, and we'll do timed exam drills too."),
            ]),
        ]
        for student, teacher, msgs in convos:
            thread, _ = chat_services.get_or_create_thread(student, teacher)
            for who, body in msgs:
                chat_services.send_message(thread, student if who == "s" else teacher.user, body)

        # An extra notification so the student's bell has variety.
        notify(S["Omar Student"], "lesson_completed",
               {"teacher_name": "Ahmed Fathy", "subject": "Mathematics"})

    # ------------------------------------------------------------------ helpers
    def _levels(self, vertical, pairs):
        for order, (en, ar) in enumerate(pairs):
            GradeLevel.objects.get_or_create(
                vertical=vertical, name_en=en, defaults={"name_ar": ar, "order": order}
            )

    def _category(self, market, vertical, grade, subject, price, wage, currency):
        LessonCategory.objects.get_or_create(
            market=market, vertical=vertical, grade_level=grade, subject=subject,
            defaults={"student_price_minor": price, "teacher_wage_minor": wage, "currency": currency},
        )

    def _teacher(self, market, phone, full_name, *, gender, rating, count, lessons, free, bio_en, bio_ar="", video=""):
        user, created = User.objects.get_or_create(
            phone=phone,
            defaults={"full_name": full_name, "role": User.Role.TEACHER, "market": market, "is_verified": True},
        )
        if created:
            user.set_password("Teacher12345")
            user.save(update_fields=["password"])
        profile, _ = TeacherProfile.objects.get_or_create(
            user=user,
            defaults={
                "market": market, "gender": gender, "languages": "ar,en",
                "bio_en": bio_en, "bio_ar": bio_ar, "intro_video_url": video,
                "rating_avg": rating, "rating_count": count, "lessons_count": lessons,
                "free_lessons_offered": free, "is_published": True,
            },
        )
        return profile

    def _offer(self, teacher, lesson_category):
        TeacherSubject.objects.get_or_create(teacher=teacher, lesson_category=lesson_category)

    def _availability(self, teacher, specs):
        for weekday, start, end in specs:
            AvailabilityRule.objects.get_or_create(
                teacher=teacher, weekday=weekday, start_time=start, end_time=end
            )

    def _student(self, phone, name, market, credit):
        user, created = User.objects.get_or_create(
            phone=phone,
            defaults={"full_name": name, "role": User.Role.STUDENT, "market": market, "is_verified": True},
        )
        if created:
            user.set_password("Student12345")
            user.save(update_fields=["password"])
        if not Wallet.objects.filter(user=user).exists():
            wallet_services.credit(wallet_services.get_or_create_wallet(user), credit)
        return user
