from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from apps.markets.models import Market

from .models import GradeLevel, LessonCategory, StageSubject, Subject, Track, Vertical
from .serializers import (
    GradeLevelSerializer,
    LessonCategorySerializer,
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


class LessonCategoryListView(ListAPIView):
    """Public list of pickable lesson categories, scoped to a market (?market=EG).

    Powers the teaching-subject picker on the public "become a teacher" form,
    which has no authenticated market to fall back on.
    """

    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = LessonCategorySerializer

    def get_queryset(self):
        code = self.request.query_params.get("market")
        if not code:
            raise ValidationError({"market": "Specify a market (?market=EG)."})
        try:
            market = Market.objects.get(code=code.upper())
        except Market.DoesNotExist:
            raise ValidationError({"market": "Unknown market code."})
        return LessonCategory.objects.filter(
            market=market, is_active=True
        ).select_related("vertical", "grade_level", "subject")
