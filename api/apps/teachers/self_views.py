"""Teacher self-serve API (`/api/teacher/`): manage own profile and stage cards
(subjects, price, free trials and availability per stage), and publish/unpublish
the profile."""
from django.db.models import Sum
from django.utils import timezone
from rest_framework.generics import (
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsTeacher

from . import errors, stage_setup
from .models import TeacherProfile, TeacherStage
from .self_serializers import (
    TeacherPhotoSerializer,
    TeacherProfileSerializer,
    TeacherStageSerializer,
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
        if not (teacher.bio_en or teacher.bio_ar):
            missing.append("bio")
        cards = list(
            teacher.stages.prefetch_related("subjects", "availability")
        )
        incomplete = {}
        for card in cards:
            reasons = stage_setup.incomplete_reasons(card, teacher.market_id)
            if reasons:
                incomplete[card.id] = reasons
        if not cards:
            missing.append("stage")
        for reason in ("subject", "price", "availability"):
            if any(reason in r for r in incomplete.values()):
                missing.append(reason)
        if missing:
            raise errors.ProfileIncomplete(missing, incomplete_stages=list(incomplete))
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


class TeacherStageListCreateView(_TeacherScoped, ListCreateAPIView):
    """The teacher's stage cards; POST adds a stage."""

    serializer_class = TeacherStageSerializer
    pagination_class = None

    def get_queryset(self):
        return TeacherStage.objects.filter(teacher=self.get_teacher())


class TeacherStageDetailView(_TeacherScoped, RetrieveUpdateDestroyAPIView):
    """Edit one stage card (PATCH replaces subjects/availability when sent)."""

    serializer_class = TeacherStageSerializer

    def get_queryset(self):
        return TeacherStage.objects.filter(teacher=self.get_teacher())

    def perform_destroy(self, instance):
        from apps.bookings.models import Booking

        if instance.bookings.filter(
            status__in=[Booking.Status.REQUESTED, Booking.Status.CONFIRMED]
        ).exists():
            raise errors.StageInUse()
        instance.delete()


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
            .select_related("student", "teacher__user", "vertical", "track", "subject")
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
