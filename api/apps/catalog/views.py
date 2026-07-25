from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .models import GradeLevel, Subject, Vertical
from .serializers import GradeLevelSerializer, SubjectSerializer, VerticalSerializer


class VerticalListView(ListAPIView):
    """Public list of top-level segments (Primary / University / Higher ed)."""

    permission_classes = [AllowAny]
    pagination_class = None  # small fixed reference set
    serializer_class = VerticalSerializer
    queryset = Vertical.objects.all()


class GradeLevelListView(ListAPIView):
    """Public list of grade levels, optionally scoped to a vertical."""

    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = GradeLevelSerializer
    queryset = GradeLevel.objects.select_related("vertical")
    filterset_fields = ["vertical"]


class SubjectListView(ListAPIView):
    """Public list of active subjects."""

    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = SubjectSerializer
    queryset = Subject.objects.filter(is_active=True)
