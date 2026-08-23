from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .models import GradeLevel, StageSubject, Subject, Track, Vertical
from .serializers import (
    GradeLevelSerializer,
    StageSubjectSerializer,
    SubjectSerializer,
    TrackSerializer,
    VerticalSerializer,
)


class VerticalListView(ListAPIView):
    """Public list of active stages (Primary / Secondary / College)."""

    permission_classes = [AllowAny]
    pagination_class = None  # small fixed reference set
    serializer_class = VerticalSerializer
    queryset = Vertical.objects.filter(is_active=True)


class TrackListView(ListAPIView):
    """Public list of active tracks (branches/faculties), scoped to a stage."""

    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = TrackSerializer
    queryset = Track.objects.filter(is_active=True).select_related("vertical")
    filterset_fields = ["vertical"]


class StageSubjectListView(ListAPIView):
    """Public list of subjects available under a stage/track (drives the pickers)."""

    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = StageSubjectSerializer
    queryset = (
        StageSubject.objects.filter(is_active=True, subject__is_active=True)
        .select_related("subject", "vertical", "track")
    )
    filterset_fields = ["vertical", "track"]


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
