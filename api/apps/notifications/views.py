from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(ListAPIView):
    """The authenticated user's own notification feed."""

    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(APIView):
    """Mark the caller's notifications read — all of them, or just `ids: [..]`."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        qs = Notification.objects.filter(user=request.user, read_at__isnull=True)
        ids = request.data.get("ids")
        if ids is not None:
            qs = qs.filter(id__in=ids)
        updated = qs.update(read_at=timezone.now())
        return Response({"marked_read": updated})


class NotificationUnreadCountView(APIView):
    """Lightweight unread counter for the header bell badge."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"unread_count": count})
