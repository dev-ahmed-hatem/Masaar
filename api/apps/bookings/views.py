from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsStaff, IsStudent, IsTeacher
from apps.teachers.models import TeacherProfile

from . import services
from .models import Booking
from .serializers import (
    BookingCreateSerializer,
    BookingSerializer,
    ConfirmSerializer,
    ReasonSerializer,
    RescheduleSerializer,
    ResolveSerializer,
    SlotSerializer,
)


class SlotListView(APIView):
    """Bookable slots generated from a teacher's recurring availability.

    Public: anonymous visitors browsing a teacher's profile see real open times
    (booking itself still requires a signed-in student).
    """

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter("teacher", int, required=True, description="Teacher profile id"),
            OpenApiParameter("days", int, description="Horizon in days (default from settings)"),
        ],
        responses={200: SlotSerializer(many=True)},
    )
    def get(self, request):
        teacher_id = request.query_params.get("teacher")
        if not teacher_id:
            raise ValidationError({"teacher": "This query parameter is required."})
        teacher = get_object_or_404(TeacherProfile, pk=teacher_id, is_published=True)
        days = request.query_params.get("days")
        slots = services.generate_slots(teacher, days=int(days) if days else None)
        return Response(SlotSerializer(slots, many=True).data)


class BookingListCreateView(ListCreateAPIView):
    """List the caller's bookings (role-scoped); students create new bookings."""

    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStudent()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        return BookingCreateSerializer if self.request.method == "POST" else BookingSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.select_related(
            "student", "teacher__user", "lesson_category__vertical",
            "lesson_category__grade_level", "lesson_category__subject",
        )
        if user.role == User.Role.STUDENT:
            qs = qs.filter(student=user)
        elif user.role == User.Role.TEACHER:
            qs = qs.filter(teacher__user=user)
        # staff see everything
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        # Tab grouping for lesson lists (composes with role scoping + pagination).
        group = self.request.query_params.get("group")
        if group == "requested":
            qs = qs.filter(status=Booking.Status.REQUESTED)
        elif group == "upcoming":
            qs = qs.filter(status=Booking.Status.CONFIRMED)
        elif group == "past":
            qs = qs.filter(
                status__in=[
                    Booking.Status.COMPLETED,
                    Booking.Status.DECLINED,
                    Booking.Status.CANCELLED,
                    Booking.Status.DISPUTED,
                    Booking.Status.NO_SHOW,
                ]
            )
        # Date-range filters (ISO datetimes/dates) for calendar views.
        if from_param := self.request.query_params.get("from"):
            qs = qs.filter(scheduled_start__gte=from_param)
        if to_param := self.request.query_params.get("to"):
            qs = qs.filter(scheduled_start__lt=to_param)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        booking = services.request_booking(
            request.user,
            data["teacher"],
            data["lesson_category"],
            data["scheduled_start"],
            duration_min=data.get("duration_min"),
            is_trial=data["is_trial"],
        )
        return Response(BookingSerializer(booking).data, status=201)


class BookingDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BookingSerializer

    def get_queryset(self):
        return Booking.objects.select_related(
            "student", "teacher__user", "lesson_category__vertical",
            "lesson_category__grade_level", "lesson_category__subject",
        )

    def get_object(self):
        booking = super().get_object()
        _assert_participant(self.request.user, booking)
        return booking


def _assert_participant(user, booking):
    if user.role in (User.Role.MODERATOR, User.Role.SUPERADMIN):
        return
    if booking.student_id != user.id and booking.teacher.user_id != user.id:
        raise PermissionDenied("This is not your booking.")


class _BookingAction(APIView):
    """Base for POST actions; resolves the booking and returns it serialized."""

    permission_classes = [IsAuthenticated]

    def get_booking(self, pk):
        return get_object_or_404(
            Booking.objects.select_related("student", "teacher__user", "lesson_category"), pk=pk
        )

    def ok(self, booking):
        return Response(BookingSerializer(booking).data)


class BookingConfirmView(_BookingAction):
    permission_classes = [IsTeacher]

    @extend_schema(request=ConfirmSerializer, responses={200: BookingSerializer})
    def post(self, request, pk):
        booking = self.get_booking(pk)
        if booking.teacher.user_id != request.user.id:
            raise PermissionDenied()
        serializer = ConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = services.confirm_booking(
            booking,
            meeting_provider=serializer.validated_data["meeting_provider"],
            meeting_link=serializer.validated_data["meeting_link"],
        )
        return self.ok(booking)


class BookingDeclineView(_BookingAction):
    permission_classes = [IsTeacher]

    def post(self, request, pk):
        booking = self.get_booking(pk)
        if booking.teacher.user_id != request.user.id:
            raise PermissionDenied()
        return self.ok(services.decline_booking(booking))


class BookingCompleteView(_BookingAction):
    permission_classes = [IsStudent]

    def post(self, request, pk):
        booking = self.get_booking(pk)
        if booking.student_id != request.user.id:
            raise PermissionDenied()
        return self.ok(services.complete_booking(booking))


class BookingCancelView(_BookingAction):
    def post(self, request, pk):
        booking = self.get_booking(pk)
        _assert_participant(request.user, booking)
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.ok(
            services.cancel_booking(booking, request.user, reason=serializer.validated_data["reason"])
        )


class BookingRescheduleView(_BookingAction):
    @extend_schema(request=RescheduleSerializer, responses={200: BookingSerializer})
    def post(self, request, pk):
        booking = self.get_booking(pk)
        _assert_participant(request.user, booking)
        serializer = RescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = services.reschedule_booking(
            booking,
            request.user,
            serializer.validated_data["scheduled_start"],
            duration_min=serializer.validated_data.get("duration_min"),
        )
        return self.ok(booking)


class BookingDisputeView(_BookingAction):
    def post(self, request, pk):
        booking = self.get_booking(pk)
        _assert_participant(request.user, booking)
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.ok(services.dispute_booking(booking, reason=serializer.validated_data["reason"]))


class BookingNoShowView(_BookingAction):
    permission_classes = [IsTeacher]

    def post(self, request, pk):
        booking = self.get_booking(pk)
        if booking.teacher.user_id != request.user.id:
            raise PermissionDenied()
        return self.ok(services.mark_no_show(booking))


class BookingResolveView(_BookingAction):
    permission_classes = [IsStaff]

    @extend_schema(request=ResolveSerializer, responses={200: BookingSerializer})
    def post(self, request, pk):
        booking = self.get_booking(pk)
        serializer = ResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.ok(
            services.resolve_dispute(booking, complete=serializer.validated_data["complete"])
        )
