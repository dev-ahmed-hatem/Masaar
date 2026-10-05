"""Seed baseline reference data + rich demo content for Wisal.

Reference data (markets, catalog, teachers, students, packages, payment
accounts) is idempotent via get_or_create. The transactional demo activity
(bookings across every status, reviews, payouts, chats, notifications) is
seeded only on a fresh database (guarded by "no bookings exist"), so re-runs
never pile up duplicates.
"""
import random
from datetime import date, timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import (
    GradeLevel,
    StageGroup,
    StagePricingRule,
    StageSubject,
    Subject,
    Track,
    Vertical,
)
from apps.chat.models import Message, Thread
from apps.markets.models import Market, PaymentAccount
from apps.notifications.models import Notification
from apps.payments import services as wallet_services
from apps.payments.models import Package, Receipt, Wallet
from apps.payouts import services as payout_services
from apps.reviews.models import Review
from apps.teachers.models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherProfile,
    TeacherStage,
    TeacherStageSubject,
)

W = AvailabilityRule.Weekday
YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # placeholder intro video


class Command(BaseCommand):
    help = "Seed baseline reference data + rich demo content for Wisal."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-demo",
            action="store_true",
            help="Reference data only; skip the generated demo activity (fast, for tests).",
        )

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

        # --- Stage groups (display-only headers) --------------------------
        intl_group, _ = StageGroup.objects.get_or_create(
            code="INTERNATIONAL",
            defaults={"name_en": "International Education", "name_ar": "التعليم الدولي", "order": 1},
        )

        # --- Stages --------------------------------------------------------
        # `order` is global and a group's stages must be contiguous: clients
        # render the group header before the first stage that carries it.
        K = Vertical.ChildKind
        stages = {}
        for key, code, en, ar, kind, label, order, group in [
            ("primary",    Vertical.Code.PRIMARY,     "Primary",     "المرحلة الابتدائية", K.NONE,    None, 1, None),
            ("prep",       Vertical.Code.PREPARATORY, "Preparatory", "المرحلة الإعدادية",  K.NONE,    None, 2, None),
            ("secondary",  Vertical.Code.SECONDARY,   "Secondary",   "المرحلة الثانوية",   K.BRANCH,  None, 3, None),
            ("university", Vertical.Code.COLLEGE,     "University",  "المرحلة الجامعية",   K.FACULTY, None, 4, None),
            ("intl_curricula", Vertical.Code.INTL_CURRICULA, "International Curricula",
             "المناهج الدولية", K.GROUPED, ("Curriculum", "المنهج"), 5, intl_group),
            ("intl_exams", Vertical.Code.INTL_EXAMS, "International Exams",
             "الاختبارات الدولية", K.GROUPED, ("Exam", "الاختبار"), 6, intl_group),
        ]:
            stages[key], _ = Vertical.objects.get_or_create(
                code=code,
                defaults={
                    "name_en": en, "name_ar": ar, "child_kind": kind, "order": order, "group": group,
                    "child_label_en": label[0] if label else "",
                    "child_label_ar": label[1] if label else "",
                },
            )

        # --- Grade levels --------------------------------------------------
        # International stages get none: a curriculum/exam track already says
        # the level, and the student profile's grade picker disables itself.
        self._levels(stages["primary"], [("KG", "روضة")] + [(f"Grade {i}", f"الصف {i}") for i in range(1, 7)])
        self._levels(stages["prep"], [(f"Grade {i}", f"الصف {i}") for i in range(7, 10)])
        self._levels(stages["secondary"], [(f"Grade {i}", f"الصف {i}") for i in range(10, 13)])
        self._levels(stages["university"], [(f"Year {i}", f"السنة {i}") for i in range(1, 5)])

        # --- Subjects ------------------------------------------------------
        # Curricula reuse the generic pool (IGCSE Physics is still Physics), but
        # exam sections are prefixed: a bare "Mathematics" badge on a teacher
        # card tells an SAT student nothing. ASCII hyphens only -- an en-dash is
        # invisible in a diff and Subject.name_en has no unique constraint.
        subjects = {}
        for en, ar in [
            ("Mathematics", "الرياضيات"), ("Science", "العلوم"), ("English", "اللغة الإنجليزية"),
            ("Arabic", "اللغة العربية"), ("Physics", "الفيزياء"), ("Chemistry", "الكيمياء"),
            ("Biology", "الأحياء"), ("Social Studies", "الدراسات الاجتماعية"),
            ("History", "التاريخ"), ("Geography", "الجغرافيا"),
            ("Further Mathematics", "الرياضيات المتقدمة"), ("Economics", "الاقتصاد"),
            ("Business Studies", "إدارة الأعمال"), ("Computer Science", "علوم الحاسب"),
            ("ICT", "تكنولوجيا المعلومات"), ("French", "اللغة الفرنسية"),
            ("Theory of Knowledge", "نظرية المعرفة"),
            ("SAT - Math", "SAT - الرياضيات"), ("SAT - Reading and Writing", "SAT - القراءة والكتابة"),
            ("EST - Math", "EST - الرياضيات"), ("EST - Literacy", "EST - اللغة"),
            ("EST - Science", "EST - العلوم"),
            ("ACT - Math", "ACT - الرياضيات"), ("ACT - English", "ACT - اللغة الإنجليزية"),
            ("ACT - Reading", "ACT - القراءة"), ("ACT - Science", "ACT - العلوم"),
            ("AP Calculus", "AP - التفاضل والتكامل"), ("AP Physics", "AP - الفيزياء"),
            ("AP Chemistry", "AP - الكيمياء"), ("AP Biology", "AP - الأحياء"),
            ("AP Computer Science", "AP - علوم الحاسب"),
        ]:
            s, _ = Subject.objects.get_or_create(name_en=en, defaults={"name_ar": ar})
            subjects[en] = s

        # --- Tracks (branches / faculties / curricula / exams) -------------
        tracks = {}
        for key, stage_key, en, ar, order in [
            ("science",    "secondary",      "Science",          "علمي", 1),
            ("literature", "secondary",      "Literature",       "أدبي", 2),
            ("eng",        "university",     "Engineering",      "الهندسة", 1),
            ("med",        "university",     "Medicine",         "الطب", 2),
            ("biz",        "university",     "Business",         "التجارة", 3),
            ("igcse",      "intl_curricula", "British IGCSE",    "بريطاني - IGCSE", 1),
            ("alevel",     "intl_curricula", "British A Level",  "بريطاني - A Level", 2),
            ("american",   "intl_curricula", "American Diploma", "الدبلومة الأمريكية", 3),
            ("ib",         "intl_curricula", "IB",               "البكالوريا الدولية", 4),
            ("canadian",   "intl_curricula", "Canadian",         "المنهج الكندي", 5),
            ("sat",        "intl_exams",     "SAT",              "SAT", 1),
            ("est",        "intl_exams",     "EST",              "EST", 2),
            ("act",        "intl_exams",     "ACT",              "ACT", 3),
            ("ap",         "intl_exams",     "AP",               "AP", 4),
        ]:
            tracks[key], _ = Track.objects.get_or_create(
                vertical=stages[stage_key], name_en=en, defaults={"name_ar": ar, "order": order},
            )

        # --- Stage x subject links (the offer matrix) ----------------------
        def link(stage_key, track_key, names):
            for i, name in enumerate(names):
                StageSubject.objects.get_or_create(
                    vertical=stages[stage_key],
                    track=tracks[track_key] if track_key else None,
                    subject=subjects[name],
                    defaults={"order": i},
                )

        link("primary", None, ["Mathematics", "Science", "English", "Arabic"])
        link("prep", None, ["Mathematics", "Science", "English", "Arabic", "Social Studies"])
        link("secondary", "science", ["Mathematics", "Physics", "Chemistry", "Biology"])
        link("secondary", "literature", ["Arabic", "English", "History", "Geography"])
        link("university", "eng", ["Mathematics", "Physics", "Computer Science"])
        link("university", "med", ["Biology", "Chemistry"])
        link("university", "biz", ["English", "Mathematics", "Economics"])
        link("intl_curricula", "igcse",
             ["Mathematics", "Physics", "Chemistry", "Biology", "English", "ICT", "Business Studies"])
        link("intl_curricula", "alevel",
             ["Mathematics", "Further Mathematics", "Physics", "Chemistry", "Biology",
              "Economics", "Computer Science"])
        link("intl_curricula", "american",
             ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Economics"])
        link("intl_curricula", "ib",
             ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Economics",
              "Theory of Knowledge"])
        link("intl_curricula", "canadian",
             ["Mathematics", "Physics", "Chemistry", "Biology", "English", "French"])
        link("intl_exams", "sat", ["SAT - Math", "SAT - Reading and Writing"])
        link("intl_exams", "est", ["EST - Math", "EST - Literacy", "EST - Science"])
        link("intl_exams", "act", ["ACT - Math", "ACT - English", "ACT - Reading", "ACT - Science"])
        link("intl_exams", "ap",
             ["AP Calculus", "AP Physics", "AP Chemistry", "AP Biology", "AP Computer Science"])

        # --- Moderator stage pricing: (min, max, commission_pct) -----------
        # Every market prices every stage, so nothing downstream ever has to
        # invent a price for an unpriced (market, stage) pair. The ceiling sits
        # well above the demo prices below (min × 1.5 at most), so no seeded
        # card lands outside its own band.
        BANDS = {
            "EG": {"primary": (5000, 15000, 15), "prep": (6000, 18000, 15), "secondary": (8000, 24000, 18),
                   "university": (11000, 33000, 20), "intl_curricula": (20000, 60000, 20), "intl_exams": (25000, 75000, 22)},
            "SA": {"primary": (3500, 10000, 15), "prep": (4000, 12000, 15), "secondary": (5000, 15000, 18),
                   "university": (7000, 21000, 20), "intl_curricula": (12000, 36000, 20), "intl_exams": (15000, 45000, 22)},
        }
        for market in (eg, sa):
            for key, (minp, maxp, pct) in BANDS[market.code].items():
                StagePricingRule.objects.get_or_create(
                    market=market, vertical=stages[key],
                    defaults={"min_price_minor": minp, "max_price_minor": maxp, "commission_pct": pct},
                )

        # --- Teacher roster ------------------------------------------------
        floors_by_id = {
            (r.market_id, r.vertical_id): r.min_price_minor
            for r in StagePricingRule.objects.filter(is_active=True)
        }
        roster = [
            {"m": eg, "phone": "+201111111101", "name": "Ahmed Fathy", "g": "MALE", "rating": 4.7, "count": 128, "lessons": 128, "free": 1, "video": YT,
             "bio_en": "Maths & science tutor with 8 years helping primary and prep students build strong fundamentals.",
             "bio_ar": "مدرّس رياضيات وعلوم بخبرة 8 سنوات في تأسيس طلاب المرحلة الابتدائية والإعدادية.",
             "spec": [("primary", None, "Mathematics"), ("primary", None, "Science"),
                      ("prep", None, "Mathematics"), ("prep", None, "Science"),
                      ("secondary", "science", "Physics")],
             "avail": [(W.MON, "16:00", "20:00"), (W.WED, "16:00", "20:00")]},
            {"m": eg, "phone": "+201111111102", "name": "Sara Nabil", "g": "FEMALE", "rating": 4.9, "count": 312, "lessons": 312, "free": 2, "video": YT,
             "bio_en": "Patient primary maths and English teacher who makes every lesson feel approachable.",
             "bio_ar": "معلّمة رياضيات ولغة إنجليزية للمرحلة الابتدائية، أسلوبها بسيط ومحبّب.",
             "spec": [("primary", None, "Mathematics"), ("primary", None, "English")],
             "avail": [(W.SUN, "16:00", "20:00"), (W.TUE, "16:00", "20:00")]},
            {"m": eg, "phone": "+201111111103", "name": "Mona Adel", "g": "FEMALE", "rating": 4.8, "count": 96, "lessons": 96, "free": 0,
             "bio_en": "Secondary physics and chemistry specialist focused on Thanaweya Amma exam technique.",
             "bio_ar": "متخصصة في فيزياء وكيمياء الثانوية العامة مع تركيز على مهارات الامتحان.",
             "spec": [("secondary", "science", "Physics"), ("secondary", "science", "Chemistry")],
             "avail": [(W.SAT, "17:00", "21:00"), (W.MON, "17:00", "21:00")]},
            {"m": eg, "phone": "+201111111104", "name": "Khaled Omar", "g": "MALE", "rating": 4.6, "count": 210, "lessons": 210, "free": 1, "video": YT,
             "bio_en": "English language and IELTS coach — conversation, writing and exam prep for all levels.",
             "bio_ar": "مدرّب لغة إنجليزية وآيلتس: محادثة وكتابة وتحضير للامتحانات لكل المستويات.",
             "spec": [("primary", None, "English"), ("secondary", "literature", "English"), ("university", "biz", "English")],
             "avail": [(W.SUN, "18:00", "22:00"), (W.WED, "18:00", "22:00"), (W.THU, "18:00", "22:00")]},
            {"m": eg, "phone": "+201111111105", "name": "Layla Mansour", "g": "FEMALE", "rating": 5.0, "count": 54, "lessons": 54, "free": 1,
             "bio_en": "Arabic language teacher passionate about grammar, literature and expressive writing.",
             "bio_ar": "معلّمة لغة عربية شغوفة بالنحو والأدب والتعبير الكتابي.",
             "spec": [("primary", None, "Arabic"), ("prep", None, "Arabic"),
                      ("secondary", "literature", "Arabic"), ("secondary", "literature", "English")],
             "avail": [(W.FRI, "10:00", "14:00"), (W.SAT, "10:00", "14:00")]},
            {"m": eg, "phone": "+201111111106", "name": "Youssef Hany", "g": "MALE", "rating": 4.5, "count": 74, "lessons": 74, "free": 0,
             "bio_en": "Engineering-track tutor for university calculus and physics fundamentals.",
             "bio_ar": "مدرّس لطلاب كليات الهندسة في التفاضل والتكامل وأساسيات الفيزياء.",
             "spec": [("university", "eng", "Mathematics"), ("university", "eng", "Physics")],
             "avail": [(W.MON, "19:00", "22:00"), (W.WED, "19:00", "22:00")]},
            {"m": eg, "phone": "+201111111107", "name": "Dina Samir", "g": "FEMALE", "rating": 4.9, "count": 188, "lessons": 188, "free": 2, "video": YT,
             "bio_en": "Biology tutor for secondary science and pre-med students — clear diagrams, real examples.",
             "bio_ar": "مدرّسة أحياء لطلاب الثانوي العلمي وكليات الطب، شرح مبسّط بالرسومات والأمثلة.",
             "spec": [("secondary", "science", "Biology"), ("university", "med", "Biology")],
             "avail": [(W.SUN, "16:00", "20:00"), (W.TUE, "16:00", "20:00"), (W.THU, "16:00", "20:00")]},
            {"m": eg, "phone": "+201111111108", "name": "Tarek Zaki", "g": "MALE", "rating": 4.4, "count": 41, "lessons": 41, "free": 0,
             "bio_en": "Chemistry tutor covering secondary and first-year medical chemistry.",
             "bio_ar": "مدرّس كيمياء للمرحلة الثانوية وكيمياء السنة الأولى بكليات الطب.",
             "spec": [("secondary", "science", "Chemistry"), ("university", "med", "Chemistry")],
             "avail": [(W.SAT, "18:00", "21:00"), (W.MON, "18:00", "21:00")]},
            {"m": sa, "phone": "+966511111109", "name": "Faisal Al-Harbi", "g": "MALE", "rating": 4.8, "count": 133, "lessons": 133, "free": 1, "video": YT,
             "bio_en": "Physics and maths tutor for Saudi secondary students, exam-focused and encouraging.",
             "bio_ar": "مدرّس فيزياء ورياضيات لطلاب الثانوية في السعودية، يركّز على الاختبارات ويحفّز الطلاب.",
             "spec": [("primary", None, "Mathematics"), ("secondary", "science", "Physics")],
             "avail": [(W.SUN, "17:00", "21:00"), (W.TUE, "17:00", "21:00")]},
            {"m": sa, "phone": "+966511111110", "name": "Huda Al-Qahtani", "g": "FEMALE", "rating": 4.7, "count": 90, "lessons": 90, "free": 1,
             "bio_en": "English teacher for Saudi learners — friendly, structured, results-driven.",
             "bio_ar": "معلّمة لغة إنجليزية للطلاب في السعودية، أسلوب ودود ومنظّم يركّز على النتائج.",
             "spec": [("secondary", "literature", "English")],
             "avail": [(W.MON, "18:00", "22:00"), (W.WED, "18:00", "22:00")]},
            {"m": eg, "phone": "+201111111111", "name": "Nadia Shawky", "g": "FEMALE", "rating": 4.9, "count": 74, "lessons": 210, "free": 1, "video": YT,
             "bio_en": "Cambridge-trained maths and physics tutor for IGCSE and A Level.",
             "bio_ar": "\u0645\u062f\u0631\u0651\u0633\u0629 \u0631\u064a\u0627\u0636\u064a\u0627\u062a \u0648\u0641\u064a\u0632\u064a\u0627\u0621 \u0644\u0645\u0646\u0627\u0647\u062c IGCSE \u0648 A Level.",
             "spec": [("intl_curricula", "igcse", "Mathematics"), ("intl_curricula", "igcse", "Physics"),
                      ("intl_curricula", "alevel", "Further Mathematics")],
             "avail": [(W.SAT, "16:00", "20:00"), (W.TUE, "17:00", "21:00")]},
            {"m": eg, "phone": "+201111111112", "name": "Peter Nabil", "g": "MALE", "rating": 4.8, "count": 51, "lessons": 140, "free": 0, "video": "",
             "bio_en": "SAT and ACT maths coach; 700+ average score gain across two seasons.",
             "bio_ar": "\u0645\u062f\u0631\u0651\u0628 \u0631\u064a\u0627\u0636\u064a\u0627\u062a \u0644\u0627\u062e\u062a\u0628\u0627\u0631\u064a SAT \u0648 ACT.",
             "spec": [("intl_exams", "sat", "SAT - Math"), ("intl_exams", "act", "ACT - Math")],
             "avail": [(W.SUN, "18:00", "22:00"), (W.THU, "16:00", "20:00")]},
            {"m": sa, "phone": "+966511111113", "name": "Reem Al-Ghamdi", "g": "FEMALE", "rating": 4.7, "count": 33, "lessons": 88, "free": 1, "video": "",
             "bio_en": "IB diploma maths and SAT verbal, patient and exam-focused.",
             "bio_ar": "\u0631\u064a\u0627\u0636\u064a\u0627\u062a \u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064a\u0627 \u0627\u0644\u062f\u0648\u0644\u064a\u0629 \u0648\u0642\u0633\u0645 \u0627\u0644\u0644\u063a\u0629 \u0641\u064a SAT.",
             "spec": [("intl_curricula", "ib", "Mathematics"), ("intl_exams", "sat", "SAT - Reading and Writing")],
             "avail": [(W.MON, "17:00", "21:00")]},
        ]

        T = {}
        for r in roster:
            profile = self._teacher(
                r["m"], r["phone"], r["name"], gender=getattr(TeacherProfile.Gender, r["g"]),
                rating=r["rating"], count=r["count"], lessons=r["lessons"],
                bio_en=r["bio_en"], bio_ar=r.get("bio_ar", ""), video=r.get("video", ""),
            )
            # One stage card per (stage, track): its subjects, a price above the
            # stage minimum, the teacher's trial offer, and a share of their hours.
            cards: dict[tuple, list] = {}
            for vkey, tkey, sname in r["spec"]:
                cards.setdefault((vkey, tkey), []).append(sname)
            for idx, ((vkey, tkey), names) in enumerate(cards.items()):
                vertical = stages[vkey]
                # No floor means the stage isn't sold in this market. Inventing a
                # price here is how demo cards end up under a floor added later.
                minimum = floors_by_id[(r["m"].id, vertical.id)]
                windows = [w for i, w in enumerate(r["avail"]) if i % len(cards) == idx] or r["avail"]
                self._stage_card(
                    profile, vertical, tracks[tkey] if tkey else None,
                    [subjects[n] for n in names], int(minimum * 1.2), r["free"], windows,
                )
            T[r["name"]] = profile

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
        def app_card(stage_key, track_key, names, price, free, windows):
            return {
                "vertical": stages[stage_key].id,
                "track": tracks[track_key].id if track_key else None,
                "subjects": [subjects[n].id for n in names], "price_minor": price,
                "free_lessons_offered": free,
                "availability": [{"weekday": int(d), "start_time": a, "end_time": b} for d, a, b in windows],
            }

        for full_name, phone, email, gender, bio, stages in [
            ("Mona Adel", "+201222222201", "mona.adel@example.com", "FEMALE",
             "Physics & chemistry, 5 years of prep-school tutoring.",
             [app_card("secondary", "science", ["Physics", "Chemistry"], 9500, 1, [(W.SAT, "17:00", "21:00")])]),
            ("Khaled Omar", "+201222222202", "khaled.omar@example.com", "MALE",
             "English language and IELTS coach.",
             [app_card("secondary", "literature", ["English"], 9000, 0, [(W.SUN, "18:00", "22:00")]),
              app_card("university", "biz", ["English"], 12000, 1, [(W.WED, "18:00", "22:00")])]),
            ("Rana Saleh", "+201222222203", "rana.saleh@example.com", "FEMALE",
             "Primary maths and science, playful and structured.",
             [app_card("primary", None, ["Mathematics", "Science"], 6000, 2,
                       [(W.MON, "16:00", "19:00"), (W.TUE, "16:00", "19:00")])]),
            ("Dina Wagih", "+201222222204", "dina.wagih@example.com", "FEMALE",
             "IGCSE and A Level maths, Cambridge-trained.",
             [app_card("intl_curricula", "igcse", ["Mathematics", "Physics"], 24000, 1,
                       [(W.SAT, "16:00", "20:00")]),
              app_card("intl_exams", "sat", ["SAT - Math"], 28000, 0,
                       [(W.TUE, "18:00", "21:00")])]),
        ]:
            TeacherApplication.objects.get_or_create(
                phone=phone, status=TeacherApplication.Status.PENDING,
                defaults={"full_name": full_name, "market": eg, "email": email, "gender": gender,
                          "languages": "ar,en", "bio": bio, "intro_video_url": YT, "stages": stages},
            )

        # --- Payment accounts ---------------------------------------------
        PaymentAccount.objects.get_or_create(
            market=eg, display_name="Wisal — Bank (EG)",
            defaults={"kind": PaymentAccount.Kind.BANK, "details": "IBAN: EG000000000000000000000000000",
                      "instructions": "Transfer the exact amount and upload the receipt.", "sort_order": 0},
        )
        PaymentAccount.objects.get_or_create(
            market=eg, display_name="Wisal — Vodafone Cash",
            defaults={"kind": PaymentAccount.Kind.WALLET, "details": "01000000000",
                      "instructions": "Send to this wallet number, then upload the confirmation.", "sort_order": 1},
        )
        PaymentAccount.objects.get_or_create(
            market=sa, display_name="Wisal — Bank (SA)",
            defaults={"kind": PaymentAccount.Kind.BANK, "details": "IBAN: SA0000000000000000000000",
                      "instructions": "Transfer the exact amount and upload the receipt.", "sort_order": 0},
        )

        # A pending top-up receipt so the verification queue has content.
        if not Receipt.objects.filter(reference="SEED-TXN-001").exists():
            Receipt.objects.create(
                user=S["Omar Student"], market=eg, amount_minor=10000, currency="EGP",
                method=Receipt.Method.BANK, reference="SEED-TXN-001",
                payment_account=PaymentAccount.objects.get(market=eg, display_name="Wisal — Bank (EG)"),
                purpose=Receipt.Purpose.TOPUP, status=Receipt.Status.PENDING,
            )

        # --- Rich demo activity (fresh DB only) ---------------------------
        if not options.get("no_demo") and not Booking.objects.exists():
            self._seed_activity(admin, eg, sa, S, T)

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(
            f"  markets={Market.objects.count()} stage_groups={StageGroup.objects.count()} "
            f"stages={Vertical.objects.count()} tracks={Track.objects.count()} "
            f"grade_levels={GradeLevel.objects.count()} subjects={Subject.objects.count()} "
            f"stage_pricing={StagePricingRule.objects.count()} "
            f"teachers={TeacherProfile.objects.count()} students={User.objects.filter(role=User.Role.STUDENT).count()} "
            f"bookings={Booking.objects.count()} reviews={Review.objects.count()} "
            f"applications={TeacherApplication.objects.count()} packages={Package.objects.count()}"
        )

    # ------------------------------------------------------------------ demo activity
    def _seed_activity(self, admin, eg, sa, S, T):
        """Generate large, varied demo activity with bulk inserts. Deterministic
        (seeded RNG) and only ever runs on a fresh DB (guarded by the caller)."""
        random.seed(1234)
        now = timezone.now()
        td = timedelta
        Status = Booking.Status

        # Tunables — scale the whole dataset from here.
        N_TEACHERS, N_TEACHERS_SA = 58, 12
        N_STUDENTS, N_STUDENTS_SA = 430, 70
        N_THREADS = 300

        # The offer matrix, read back from the rows the caller just seeded rather
        # than hand-maintained here: demo teachers can then never reference a
        # subject that isn't offered, or a stage with no price floor.
        OFFERS = {m.id: self._offers(m) for m in (eg, sa)}

        FIRST_M = ["Ahmed", "Mohamed", "Mahmoud", "Omar", "Youssef", "Khaled", "Tarek", "Hassan", "Kareem",
                   "Amr", "Mostafa", "Sameh", "Ziad", "Bilal", "Adham", "Sherif", "Ali", "Ibrahim", "Waleed", "Nabil"]
        FIRST_F = ["Sara", "Mona", "Layla", "Dina", "Nour", "Yara", "Nada", "Salma", "Heba", "Rana",
                   "Aya", "Mariam", "Farida", "Habiba", "Reem", "Ghada", "Amira", "Doaa", "Hana", "Rasha"]
        LAST = ["Fathy", "Nabil", "Adel", "Omar", "Mansour", "Hany", "Samir", "Zaki", "Hassan", "Fouad",
                "Saleh", "Kamal", "Ismail", "Rashad", "Gaber", "Sabry", "Lotfy", "Badr", "Shawky", "Helmy"]
        SA_LAST = ["Al-Harbi", "Al-Qahtani", "Al-Otaibi", "Al-Ghamdi", "Al-Shehri", "Al-Dosari", "Al-Zahrani", "Al-Malki"]
        BIOS = ["Experienced tutor focused on strong fundamentals and confidence.",
                "Friendly, structured lessons tailored to each student's level.",
                "Exam-focused coaching with plenty of practice and feedback.",
                "Patient teacher who makes tough topics approachable.",
                "Results-driven lessons with clear explanations and real examples."]
        REVIEWS = ["Very helpful and patient.", "Explains everything clearly.", "My grades improved a lot.",
                   "Highly recommended!", "Great teacher, always prepared.", "Made a hard subject simple.",
                   "Friendly and professional.", "On time and well organized.",
                   "Really understands how students learn.", "Lessons are engaging and useful."]
        STU_LINES = ["Hi! Do you have availability this week?", "Can we focus on exam revision?",
                     "Thanks for the last lesson!", "What should I prepare before we start?",
                     "Could we reschedule to the evening?"]
        TCH_LINES = ["Hello! Yes, I have a few open slots.", "Sure, we can focus on that.",
                     "You're welcome — great progress!", "Just bring your notes, I'll handle the rest.",
                     "Of course, evenings work well for me."]
        WINDOWS = [("16:00", "20:00"), ("17:00", "21:00"), ("18:00", "22:00"), ("10:00", "14:00"), ("19:00", "22:00")]
        WEEKDAYS = list(AvailabilityRule.Weekday)
        TPWD, SPWD = make_password("Teacher12345"), make_password("Student12345")

        # --- Generated teachers (bulk) ------------------------------------
        teacher_users, tmeta = [], []
        for i in range(N_TEACHERS + N_TEACHERS_SA):
            market = eg if i < N_TEACHERS else sa
            gender = random.choice(["MALE", "FEMALE"])
            fn = random.choice(FIRST_M if gender == "MALE" else FIRST_F)
            ln = random.choice(SA_LAST if market is sa else LAST)
            phone = f"+2019{i:07d}" if market is eg else f"+96659{i:06d}"
            teacher_users.append(User(phone=phone, full_name=f"{fn} {ln}", role=User.Role.TEACHER,
                                      market=market, is_verified=True, password=TPWD))
            tmeta.append((market, gender))
        User.objects.bulk_create(teacher_users, batch_size=500)

        profiles, pmeta = [], []
        for u, (market, gender) in zip(teacher_users, tmeta):
            offers = OFFERS[market.id]
            keys = [k for k, subs in offers.items() if subs]
            chosen = []
            for key in random.sample(keys, k=random.randint(1, min(2, len(keys)))):
                subs = offers[key]
                for subject in random.sample(subs, k=random.randint(1, min(3, len(subs)))):
                    chosen.append((key, subject))
            profiles.append(TeacherProfile(
                user=u, market=market, gender=gender, languages="ar,en",
                bio_en=random.choice(BIOS), intro_video_url=(YT if random.random() < 0.3 else ""),
                rating_avg=round(random.uniform(3.8, 5.0), 1), rating_count=0, lessons_count=0,
                is_published=True))
            pmeta.append(chosen)
        TeacherProfile.objects.bulk_create(profiles, batch_size=500)

        rule_min = {
            (r.market_id, r.vertical_id): r.min_price_minor
            for r in StagePricingRule.objects.filter(is_active=True)
        }
        # Stage cards: group each teacher's chosen subjects by (stage, track).
        card_rows, card_meta = [], []
        for prof, chosen in zip(profiles, pmeta):
            grouped: dict[tuple, list] = {}
            for key, subject in chosen:
                picked = grouped.setdefault(key, [])
                if subject not in picked:
                    picked.append(subject)
            for (vertical_id, track_id), picked in grouped.items():
                minimum = rule_min[(prof.market_id, vertical_id)]
                card_rows.append(TeacherStage(
                    teacher=prof, vertical_id=vertical_id, track_id=track_id,
                    price_minor=int(minimum * random.choice([1.0, 1.2, 1.5])),
                    free_lessons_offered=random.choice([0, 0, 1, 2])))
                card_meta.append(picked)
        TeacherStage.objects.bulk_create(card_rows, batch_size=1000)
        card_subjects, avails = [], []
        for card, picked in zip(card_rows, card_meta):
            card_subjects.extend(TeacherStageSubject(teacher_stage=card, subject=s) for s in picked)
            slots = {(random.choice(WEEKDAYS), random.choice(WINDOWS)) for _ in range(random.randint(1, 3))}
            # Keep one window per weekday so a card's windows never overlap.
            for wd, (st, en) in {wd: (st, en) for wd, (st, en) in slots}.items():
                avails.append(AvailabilityRule(teacher=card.teacher, teacher_stage=card,
                                               weekday=wd, start_time=st, end_time=en))
        TeacherStageSubject.objects.bulk_create(card_subjects, batch_size=1000)
        AvailabilityRule.objects.bulk_create(avails, batch_size=1000)

        # Bookable (card, subject) pairs per teacher, incl. the hand-crafted roster.
        all_teachers = list(profiles) + list(T.values())
        teacher_lessons: dict[int, list] = {}
        for card in TeacherStage.objects.filter(teacher__in=all_teachers).prefetch_related("subjects__subject"):
            for cs in card.subjects.all():
                teacher_lessons.setdefault(card.teacher_id, []).append((card, cs.subject))

        # --- Generated students (bulk) + wallets --------------------------
        student_users = []
        for i in range(N_STUDENTS + N_STUDENTS_SA):
            market = eg if i < N_STUDENTS else sa
            fn = random.choice(FIRST_M + FIRST_F)
            ln = random.choice(SA_LAST if market is sa else LAST)
            phone = f"+2018{i:07d}" if market is eg else f"+96658{i:06d}"
            student_users.append(User(phone=phone, full_name=f"{fn} {ln}", role=User.Role.STUDENT,
                                      market=market, is_verified=True, password=SPWD))
        User.objects.bulk_create(student_users, batch_size=500)
        Wallet.objects.bulk_create(
            [Wallet(user=u, market=u.market, currency=u.market.currency,
                    available_minor=random.randint(50000, 500000), reserved_minor=0)
             for u in student_users],
            batch_size=500,
        )

        students_by_market = {eg.id: [], sa.id: []}
        for u in student_users:
            students_by_market[u.market_id].append(u)
        for name, u in S.items():  # named students too
            students_by_market[u.market_id].append(u)

        # --- Bookings (bulk) across every status --------------------------
        # Freeze price/wage from the stage card's price + the stage commission.
        rule_pct = {
            (r.market_id, r.vertical_id): float(r.commission_pct)
            for r in StagePricingRule.objects.filter(is_active=True)
        }

        def price_wage(teacher, card):
            # Deliberately not .get(..., 0): a missing rule is a seed bug, and a
            # silent 0% commission would only surface much later in payouts.
            price = card.price_minor
            pct = rule_pct[(teacher.market_id, card.vertical_id)]
            return price, price - int(round(price * pct / 100))

        def lesson(card, subject):
            return {"teacher_stage": card, "vertical_id": card.vertical_id,
                    "track_id": card.track_id, "subject": subject}

        rating_choices, rating_weights = [5, 4, 3], [0.6, 0.3, 0.1]
        bookings, review_for = [], []
        for teacher in all_teachers:
            cats = teacher_lessons.get(teacher.id) or []
            studs = students_by_market.get(teacher.market_id) or []
            if not cats or not studs:
                continue
            curr = teacher.market.currency
            for _ in range(random.randint(30, 120)):  # completed history
                (card, subj), stu = random.choice(cats), random.choice(studs)
                pm, wm = price_wage(teacher, card)
                d = random.randint(1, 150)
                b = Booking(student=stu, teacher=teacher, **lesson(card, subj),
                            scheduled_start=now - td(days=d), duration_min=60,
                            completed_at=now - td(days=d) + td(hours=1),
                            price_minor=pm, teacher_wage_minor=wm,
                            currency=curr, status=Status.COMPLETED, wage_settled=True,
                            meeting_provider="ZOOM", meeting_link="https://zoom.us/j/000000000")
                bookings.append(b)
                if random.random() < 0.6:
                    review_for.append((b, random.choices(rating_choices, rating_weights)[0], random.choice(REVIEWS)))
            for _ in range(random.randint(0, 4)):  # upcoming active
                confirmed = random.random() < 0.5
                (card, subj), stu = random.choice(cats), random.choice(studs)
                pm, wm = price_wage(teacher, card)
                bookings.append(Booking(
                    student=stu, teacher=teacher, **lesson(card, subj),
                    scheduled_start=now + td(days=random.randint(1, 20), hours=random.randint(0, 8)),
                    duration_min=60, price_minor=pm, teacher_wage_minor=wm,
                    currency=curr, status=Status.CONFIRMED if confirmed else Status.REQUESTED,
                    meeting_provider="ZOOM" if confirmed else "",
                    meeting_link="https://zoom.us/j/000000000" if confirmed else ""))
            for _ in range(random.randint(0, 5)):  # unhappy paths
                st = random.choice([Status.CANCELLED, Status.DECLINED, Status.NO_SHOW])
                (card, subj), stu = random.choice(cats), random.choice(studs)
                pm, wm = price_wage(teacher, card)
                extra = {}
                start = now - td(days=random.randint(1, 120))
                if st == Status.NO_SHOW:
                    extra["wage_settled"] = True
                elif st == Status.CANCELLED:
                    extra["cancel_reason"] = "Schedule conflict"
                else:  # DECLINED
                    start = now + td(days=random.randint(1, 10))
                bookings.append(Booking(student=stu, teacher=teacher, **lesson(card, subj),
                                        scheduled_start=start, duration_min=60,
                                        price_minor=pm, teacher_wage_minor=wm,
                                        currency=curr, status=st, **extra))
        Booking.objects.bulk_create(bookings, batch_size=1000)
        Review.objects.bulk_create(
            [Review(booking=b, student=b.student, teacher=b.teacher, rating=r, text=t, is_published=True)
             for (b, r, t) in review_for],
            batch_size=1000,
        )

        # Reflect real review/lesson volume onto teacher aggregates.
        rev = {r["teacher"]: r for r in Review.objects.values("teacher").annotate(c=Count("id"), a=Avg("rating"))}
        comp = {r["teacher"]: r["c"] for r in
                Booking.objects.filter(status=Status.COMPLETED).values("teacher").annotate(c=Count("id"))}
        profs = list(TeacherProfile.objects.all())
        for p in profs:
            if p.id in rev:
                p.rating_count = rev[p.id]["c"]
                p.rating_avg = round(rev[p.id]["a"] or 0, 2)
            p.lessons_count = comp.get(p.id, p.lessons_count)
        TeacherProfile.objects.bulk_update(profs, ["rating_avg", "rating_count", "lessons_count"], batch_size=500)

        # Reserve funds for a sample of active bookings (realistic wallet holds).
        for b in Booking.objects.filter(status__in=[Status.REQUESTED, Status.CONFIRMED]).order_by("?")[:150]:
            try:
                wallet_services.reserve(wallet_services.get_or_create_wallet(b.student), b.price_minor, booking=b)
            except Exception:
                pass

        # Payout cycles sweep settled bookings into per-teacher items; mark ~half paid.
        ps, pe = date.today() - timedelta(days=45), date.today()
        payout_services.generate_cycle(eg, ps, pe, created_by=admin)
        payout_services.generate_cycle(sa, ps, pe, created_by=admin)
        from apps.payouts.models import PayoutItem

        paid = []
        for idx, it in enumerate(PayoutItem.objects.all()):
            if idx % 2 == 0:
                it.status, it.paid_at, it.reference = "PAID", now, f"SEED-PAYOUT-{idx:04d}"
                paid.append(it)
        PayoutItem.objects.bulk_update(paid, ["status", "paid_at", "reference"], batch_size=500)

        # --- Chat threads + messages (bulk) -------------------------------
        threads, pairs, attempts = [], set(), 0
        while len(threads) < N_THREADS and attempts < N_THREADS * 8:
            attempts += 1
            teacher = random.choice(all_teachers)
            studs = students_by_market.get(teacher.market_id) or []
            if not studs:
                continue
            stu = random.choice(studs)
            key = (stu.id, teacher.id)
            if key in pairs:
                continue
            pairs.add(key)
            threads.append(Thread(student=stu, teacher=teacher, market_id=teacher.market_id,
                                  last_message_at=now - td(days=random.randint(0, 20), hours=random.randint(0, 20))))
        Thread.objects.bulk_create(threads, batch_size=500)
        messages = []
        for th in threads:
            for j in range(random.randint(2, 5)):
                if j % 2 == 0:
                    messages.append(Message(thread=th, sender=th.student, body=random.choice(STU_LINES)))
                else:
                    messages.append(Message(thread=th, sender=th.teacher.user, body=random.choice(TCH_LINES)))
        Message.objects.bulk_create(messages, batch_size=1000)

        # --- Notifications (bulk) -----------------------------------------
        events = ["booking_confirmed", "lesson_completed", "booking_requested", "booking_cancelled",
                  "payout_paid", "chat_message", "receipt_approved"]
        recipients = random.sample(student_users, min(250, len(student_users))) + [t.user for t in all_teachers]
        notis = []
        for u in recipients:
            for _ in range(random.randint(1, 4)):
                read = random.random() < 0.4
                notis.append(Notification(
                    user=u, channel=Notification.Channel.PUSH, event_type=random.choice(events),
                    payload={}, status=Notification.Status.SENT, sent_at=now,
                    read_at=(now - td(days=random.randint(1, 10)) if read else None)))
        Notification.objects.bulk_create(notis, batch_size=1000)

    # ------------------------------------------------------------------ helpers
    def _offers(self, market):
        """(vertical_id, track_id) -> [Subject] for every combination sold here.

        Derived from StageSubject and StagePricingRule, so demo teachers can only
        ever land on a stage that has a price floor in their market.
        """
        priced = set(
            StagePricingRule.objects.filter(market=market, is_active=True)
            .values_list("vertical_id", flat=True)
        )
        out: dict[tuple[int, int | None], list] = {}
        for ss in (
            StageSubject.objects.filter(is_active=True, subject__is_active=True)
            .select_related("subject")
        ):
            if ss.vertical_id in priced:
                out.setdefault((ss.vertical_id, ss.track_id), []).append(ss.subject)
        return out

    def _levels(self, vertical, pairs):
        for order, (en, ar) in enumerate(pairs):
            GradeLevel.objects.get_or_create(
                vertical=vertical, name_en=en, defaults={"name_ar": ar, "order": order}
            )

    def _teacher(self, market, phone, full_name, *, gender, rating, count, lessons, bio_en, bio_ar="", video=""):
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
                "is_published": True,
            },
        )
        return profile

    def _stage_card(self, teacher, vertical, track_obj, subject_objs, price, free, windows):
        card, created = TeacherStage.objects.get_or_create(
            teacher=teacher, vertical=vertical, track=track_obj,
            defaults={"price_minor": price, "free_lessons_offered": free},
        )
        if created:
            for subject in subject_objs:
                TeacherStageSubject.objects.create(teacher_stage=card, subject=subject)
            for weekday, start, end in windows:
                AvailabilityRule.objects.create(
                    teacher=teacher, teacher_stage=card, weekday=weekday, start_time=start, end_time=end
                )
        return card

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
