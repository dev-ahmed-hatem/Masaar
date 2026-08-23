"""Teacher self-serve API (`/api/teacher/`): manage own profile, subjects,
availability and custom-price requests, and publish/unpublish the profile."""
from django.db.models import Sum
from django.utils import timezone
from rest_framework.generics import (
    DestroyAPIView,
    ListAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
)
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsTeacher
from apps.catalog.models import LessonCategory
from apps.catalog.serializers import LessonCategorySerializer

from . import errors
from .models import (
    AvailabilityRule,
    TeacherPrice,
    TeacherProfile,
    TeacherSpecialization,
    TeacherSubject,
)
from .self_serializers import (
    AvailabilitySerializer,
    TeacherPhotoSerializer,
    TeacherPriceCreateSerializer,
    TeacherPriceReadSerializer,
    TeacherProfileSerializer,
    TeacherSpecializationSerializer,
    TeacherSubjectCreateSerializer,
    TeacherSubjectReadSerializer,
)


class _TeacherScoped:
    permission_classes = [IsTeacher]

    def get_teacher(self) -> TeacherProfile:
        try:
            return self.request.user.teacher_profile
        except TeacherProfile.DoesNotExist:
            raise NotFound("No teacher profile for this account.")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["teacher"] = self.get_teacher()
        return ctx


class TeacherProfileView(_TeacherScoped, RetrieveUpdateAPIView):
    """GET / PATCH the authenticated teacher's own profile."""

    serializer_class = TeacherProfileSerializer

    def get_object(self):
        return self.get_teacher()


class TeacherProfilePublishView(_TeacherScoped, APIView):
    def post(self, request):
        teacher = self.get_teacher()
        missing = []
        if not teacher.subjects.exists():
            missing.append("subject")
        if not (teacher.bio_en or teacher.bio_ar):
            missing.append("bio")
        if missing:
            raise errors.ProfileIncomplete(missing)
        if not teacher.is_published:
            teacher.is_published = True
            teacher.save(update_fields=["is_published"])
        return Response(TeacherProfileSerializer(teacher, context={"request": request}).data)


class TeacherProfileUnpublishView(_TeacherScoped, APIView):
    def post(self, request):
        teacher = self.get_teacher()
        if teacher.is_published:
            teacher.is_published = False
            teacher.save(update_fields=["is_published"])
        return Response(TeacherProfileSerializer(teacher, context={"request": request}).data)


class LessonCategoryListView(_TeacherScoped, ListAPIView):
    """Pickable lesson categories in the teacher's market."""

    serializer_class = LessonCategorySerializer
    pagination_class = None

    def get_queryset(self):
        teacher = self.get_teacher()
        return LessonCategory.objects.filter(
            market_id=teacher.market_id, is_active=True
        ).select_related("vertical", "grade_level", "subject")


class TeacherSubjectListCreateView(_TeacherScoped, ListCreateAPIView):
    pagination_class = None

    def get_serializer_class(self):
        return (
            TeacherSubjectCreateSerializer
            if self.request.method == "POST"
            else TeacherSubjectReadSerializer
        )

    def get_queryset(self):
        return TeacherSubject.objects.filter(
            teacher=self.get_teacher()
        ).select_related("lesson_category__vertical", "lesson_category__grade_level", "lesson_category__subject")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        teacher = ctx["teacher"]
        ctx["overrides"] = {
            p.lesson_category_id: p.custom_student_price_minor
            for p in teacher.prices.filter(is_approved=True)
        }
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subject = serializer.save()
        read = TeacherSubjectReadSerializer(subject, context=self.get_serializer_context())
        return Response(read.data, status=201)


class TeacherSubjectDeleteView(_TeacherScoped, DestroyAPIView):
    def get_queryset(self):
        return TeacherSubject.objects.filter(teacher=self.get_teacher())


class AvailabilityListCreateView(_TeacherScoped, ListCreateAPIView):
    serializer_class = AvailabilitySerializer
    pagination_class = None

    def get_queryset(self):
        return AvailabilityRule.objects.filter(teacher=self.get_teacher())


class AvailabilityDeleteView(_TeacherScoped, DestroyAPIView):
    def get_queryset(self):
        return AvailabilityRule.objects.filter(teacher=self.get_teacher())


class TeacherSpecializationListCreateView(_TeacherScoped, ListCreateAPIView):
    serializer_class = TeacherSpecializationSerializer
    pagination_class = None

    def get_queryset(self):
        return TeacherSpecialization.objects.filter(
            teacher=self.get_teacher()
        ).select_related("vertical", "track", "subject")


class TeacherSpecializationDeleteView(_TeacherScoped, DestroyAPIView):
    def get_queryset(self):
        return TeacherSpecialization.objects.filter(teacher=self.get_teacher())


class TeacherPhotoView(_TeacherScoped, APIView):
    """Upload (multipart `photo`) or remove the teacher's profile photo."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        teacher = self.get_teacher()
        serializer = TeacherPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if teacher.photo:
            teacher.photo.delete(save=False)
        teacher.photo = serializer.validated_data["photo"]
        teacher.save(update_fields=["photo", "updated_at"])
        return Response(TeacherProfileSerializer(teacher, context={"request": request}).data)

    def delete(self, request):
        teacher = self.get_teacher()
        if teacher.photo:
            teacher.photo.delete(save=False)
            teacher.photo = None
            teacher.save(update_fields=["photo", "updated_at"])
        return Response(TeacherProfileSerializer(teacher, context={"request": request}).data)


class TeacherDashboardView(_TeacherScoped, APIView):
    """One-call summary powering the teacher portal home."""

    def get(self, request):
        from apps.bookings.models import Booking
        from apps.bookings.serializers import BookingSerializer
        from apps.chat.services import unread_total
        from apps.notifications.models import Notification
        from apps.payouts.models import PayoutItem

        teacher = self.get_teacher()
        now = timezone.now()
        bookings = Booking.objects.filter(teacher=teacher)
        upcoming = bookings.filter(status=Booking.Status.CONFIRMED, scheduled_start__gte=now)
        next_booking = (
            upcoming.order_by("scheduled_start")
            .select_related(
                "student", "teacher__user", "lesson_category__vertical",
                "lesson_category__grade_level", "lesson_category__subject",
            )
            .first()
        )
        pending_minor = (
            bookings.filter(wage_settled=True, payout_item__isnull=True)
            .aggregate(s=Sum("teacher_wage_minor"))["s"]
            or 0
        )
        paid_minor = (
            PayoutItem.objects.filter(teacher=teacher, status=PayoutItem.Status.PAID)
            .aggregate(s=Sum("amount_minor"))["s"]
            or 0
        )
        return Response(
            {
                "profile": {
                    "full_name": teacher.user.full_name,
                    "is_published": teacher.is_published,
                    "rating_avg": float(teacher.rating_avg),
                    "rating_count": teacher.rating_count,
                    "lessons_count": teacher.lessons_count,
                },
                "pending_requests": bookings.filter(status=Booking.Status.REQUESTED).count(),
                "upcoming_count": upcoming.count(),
                "next_lesson": BookingSerializer(next_booking).data if next_booking else None,
                "earnings": {
                    "pending_minor": pending_minor,
                    "paid_minor": paid_minor,
                    "currency": teacher.market.currency,
                },
                "unread_notifications": Notification.objects.filter(
                    user=request.user, read_at__isnull=True
                ).count(),
                "unread_messages": unread_total(request.user),
            }
        )


class TeacherPriceListCreateView(_TeacherScoped, ListCreateAPIView):
    pagination_class = None

    def get_serializer_class(self):
        return (
            TeacherPriceCreateSerializer
            if self.request.method == "POST"
            else TeacherPriceReadSerializer
        )

    def get_queryset(self):
        return TeacherPrice.objects.filter(
            teacher=self.get_teacher()
        ).select_related("lesson_category__vertical", "lesson_category__grade_level", "lesson_category__subject")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        price = serializer.save()
        return Response(TeacherPriceReadSerializer(price).data, status=201)


class TeacherPriceDeleteView(_TeacherScoped, DestroyAPIView):
    def get_queryset(self):
        return TeacherPrice.objects.filter(teacher=self.get_teacher())
