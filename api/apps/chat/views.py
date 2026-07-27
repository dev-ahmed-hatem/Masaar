from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsStudent

from . import services
from .models import Message, Thread
from .serializers import (
    MessageCreateSerializer,
    MessageSerializer,
    ThreadCreateSerializer,
    ThreadSerializer,
)


def _is_staff(user):
    return user.role in (User.Role.MODERATOR, User.Role.SUPERADMIN)


def _assert_participant(user, thread, write=False):
    """Participants read/write their thread; staff may read any thread."""
    if thread.student_id == user.id or thread.teacher.user_id == user.id:
        return
    if not write and _is_staff(user):
        return
    raise PermissionDenied("You are not a participant in this conversation.")


class ThreadListCreateView(ListCreateAPIView):
    """List the caller's conversations (staff see all); students start one."""

    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStudent()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        return ThreadCreateSerializer if self.request.method == "POST" else ThreadSerializer

    def get_queryset(self):
        return services.annotated_threads(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = ThreadCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        thread, created = services.get_or_create_thread(
            request.user, serializer.validated_data["teacher"]
        )
        annotated = services.annotated_threads(request.user).get(pk=thread.pk)
        return Response(ThreadSerializer(annotated).data, status=201 if created else 200)


class ThreadDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ThreadSerializer

    def get_object(self):
        thread = get_object_or_404(
            Thread.objects.select_related("student", "teacher__user"), pk=self.kwargs["pk"]
        )
        _assert_participant(self.request.user, thread)
        # Re-fetch through the annotated queryset for preview/unread fields.
        return services.annotated_threads(self.request.user).get(pk=thread.pk)


class MessageCursorPagination(CursorPagination):
    """Newest-first, cursor-based: page boundaries stay stable while new
    messages arrive between polls ("load older" never skips/duplicates)."""

    ordering = ("-created_at", "-id")
    page_size = 30
    page_size_query_param = "page_size"


class MessageListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = MessageCursorPagination

    def get_serializer_class(self):
        return MessageCreateSerializer if self.request.method == "POST" else MessageSerializer

    def _thread(self, write=False) -> Thread:
        thread = get_object_or_404(
            Thread.objects.select_related("student", "teacher__user"), pk=self.kwargs["pk"]
        )
        _assert_participant(self.request.user, thread, write=write)
        return thread

    def get_queryset(self):
        return Message.objects.filter(thread=self._thread()).select_related("sender")

    def create(self, request, *args, **kwargs):
        thread = self._thread(write=True)
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = services.send_message(thread, request.user, serializer.validated_data["body"])
        return Response(MessageSerializer(message).data, status=201)


class ThreadMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        thread = get_object_or_404(Thread.objects.select_related("teacher__user"), pk=pk)
        _assert_participant(request.user, thread, write=True)
        services.mark_read(thread, request.user)
        return Response({"unread_count": 0})


class UnreadCountView(APIView):
    """Lightweight aggregate for the header badge (polled by the web app)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: {"type": "object", "properties": {"unread_count": {"type": "integer"}}}})
    def get(self, request):
        return Response({"unread_count": services.unread_total(request.user)})
