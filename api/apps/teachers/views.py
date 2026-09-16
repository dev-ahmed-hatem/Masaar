from django.db.models import IntegerField, OuterRef, Prefetch, Subquery
from django.shortcuts import get_object_or_404
from django_filters import rest_framework as filters
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStaff
from apps.markets.models import Market
from apps.reviews.models import Review

from . import services
from .models import AvailabilityRule, TeacherApplication, TeacherProfile, TeacherStage
from .serializers import (
    ApplicationRejectSerializer,
    TeacherApplicationCreateSerializer,
    TeacherApplicationSerializer,
    TeacherDetailSerializer,
    TeacherListSerializer,
)


class MarketRequired(APIException):
    status_code = 400
    default_detail = "Specify a market (?market=EG) or sign in with a market on your account."
    default_code = "market_required"


class UnknownMarket(APIException):
    status_code = 400
    default_detail = "Unknown market code."
    default_code = "unknown_market"


def from_price_subquery() -> Subquery:
    """A teacher's cheapest stage-card price (their "from" price for discovery cards)."""
    cheapest = (
        TeacherStage.objects.filter(teacher=OuterRef("pk"))
        .order_by("price_minor")
        .values("price_minor")[:1]
    )
    return Subquery(cheapest, output_field=IntegerField())


def stage_cards_prefetch() -> Prefetch:
    """Stage cards with everything the list/detail serializers read."""
    return Prefetch(
        "stages",
        queryset=TeacherStage.objects.select_related("vertical", "track").prefetch_related(
            "subjects__subject",
            Prefetch("availability", queryset=AvailabilityRule.objects.all()),
        ),
    )


class TeacherFilter(filters.FilterSet):
    # stage / track / subject match within ONE stage card together (so "Math" in
    # one card and "Secondary" in another doesn't match) — see filter_stage_card.
    subject = filters.NumberFilter(method="filter_stage_card")
    stage = filters.NumberFilter(method="filter_stage_card")
    track = filters.NumberFilter(method="filter_stage_card")
    grade = filters.NumberFilter(field_name="stages__vertical__grade_levels", distinct=True)
    vertical = filters.CharFilter(field_name="stages__vertical__code", distinct=True)
    language = filters.CharFilter(field_name="languages", lookup_expr="icontains")
    name = filters.CharFilter(field_name="user__full_name", lookup_expr="icontains")
    min_rating = filters.NumberFilter(field_name="rating_avg", lookup_expr="gte")
    price_min = filters.NumberFilter(field_name="from_price_minor", lookup_expr="gte")
    price_max = filters.NumberFilter(field_name="from_price_minor", lookup_expr="lte")
    weekday = filters.NumberFilter(field_name="availability__weekday", distinct=True)

    class Meta:
        model = TeacherProfile
        fields = ["gender"]

    def filter_stage_card(self, queryset, name, value):
        # Called once per param present; apply the combined card filter only once.
        if getattr(self, "_stage_card_filtered", False):
            return queryset
        self._stage_card_filtered = True
        data = self.form.cleaned_data
        cards = TeacherStage.objects.all()
        if data.get("stage") is not None:
            cards = cards.filter(vertical_id=data["stage"])
        if data.get("track") is not None:
            cards = cards.filter(track_id=data["track"])
        if data.get("subject") is not None:
            cards = cards.filter(subjects__subject_id=data["subject"])
        return queryset.filter(id__in=cards.values("teacher_id"))


class _MarketScopedMixin:
    permission_classes = [AllowAny]

    def resolve_market(self) -> Market:
        code = self.request.query_params.get("market")
        if not code:
            user = self.request.user
            market = getattr(user, "market", None) if user.is_authenticated else None
            if market is None:
                raise MarketRequired()
            return market
        try:
            return Market.objects.get(code=code.upper())
        except Market.DoesNotExist:
            raise UnknownMarket()


@extend_schema(
    parameters=[
        OpenApiParameter("market", str, description="Market code (EG/SA). Falls back to the signed-in user's market."),
        OpenApiParameter("subject", int, description="Subject id (taught in a stage card)"),
        OpenApiParameter("stage", int, description="Stage id (combined with subject/track per card)"),
        OpenApiParameter("track", int, description="Branch/faculty id (combined with stage/subject per card)"),
        OpenApiParameter("grade", int, description="Grade level id (teachers of the grade's stage)"),
        OpenApiParameter("vertical", str, description="Stage code"),
        OpenApiParameter("gender", str, description="MALE / FEMALE"),
        OpenApiParameter("language", str, description="Language code substring, e.g. 'en'"),
        OpenApiParameter("name", str, description="Teacher name substring (case-insensitive)"),
        OpenApiParameter("min_rating", float, description="Minimum average rating"),
        OpenApiParameter("price_min", int, description="Min starting price (minor units)"),
        OpenApiParameter("price_max", int, description="Max starting price (minor units)"),
        OpenApiParameter("weekday", int, description="Weekday with availability (0=Mon..6=Sun)"),
        OpenApiParameter("ordering", str, description="rating_avg | from_price_minor | lessons_count (prefix '-' to reverse)"),
    ]
)
class TeacherListView(_MarketScopedMixin, ListAPIView):
    """Browse published teachers within a market, with filters and ordering."""

    serializer_class = TeacherListSerializer
    filter_backends = [filters.DjangoFilterBackend, OrderingFilter]
    filterset_class = TeacherFilter
    ordering_fields = ["rating_avg", "from_price_minor", "lessons_count", "created_at"]
    ordering = ["-rating_avg", "-lessons_count"]

    def get_queryset(self):
        market = self.resolve_market()
        return (
            TeacherProfile.objects.filter(is_published=True, market=market)
            .select_related("user", "market")
            .prefetch_related(stage_cards_prefetch())
            .annotate(from_price_minor=from_price_subquery())
        )


class TeacherDetailView(RetrieveAPIView):
    """A published teacher's full profile, resolved prices, availability and reviews."""

    permission_classes = [AllowAny]
    serializer_class = TeacherDetailSerializer

    def get_queryset(self):
        return (
            TeacherProfile.objects.filter(is_published=True)
            .select_related("user", "market")
            .prefetch_related(
                stage_cards_prefetch(),
                Prefetch("availability", queryset=AvailabilityRule.objects.all()),
                Prefetch(
                    "reviews",
                    queryset=Review.objects.filter(is_published=True).select_related(
                        "student"
                    ),
                ),
            )
            .annotate(from_price_minor=from_price_subquery())
        )


# --- Onboarding: teacher applications --------------------------------------

class ApplicationListCreateView(ListCreateAPIView):
    """Public application submission (POST) and moderator review queue (GET)."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsStaff()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TeacherApplicationCreateSerializer
        return TeacherApplicationSerializer

    def get_queryset(self):
        qs = TeacherApplication.objects.select_related("market", "reviewed_by").order_by(
            "-created_at"
        )
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = serializer.save()
        # Echo back the created application using the read serializer.
        return Response(
            TeacherApplicationSerializer(application, context={"request": request}).data,
            status=201,
        )


class ApplicationDetailView(RetrieveAPIView):
    permission_classes = [IsStaff]
    serializer_class = TeacherApplicationSerializer
    queryset = TeacherApplication.objects.select_related("market", "reviewed_by", "created_profile")


class ApplicationApproveView(APIView):
    permission_classes = [IsStaff]

    @extend_schema(request=None, responses={200: TeacherApplicationSerializer})
    def post(self, request, pk):
        application = get_object_or_404(TeacherApplication, pk=pk)
        services.approve_application(application, request.user)
        application.refresh_from_db()
        return Response(
            {
                "message": "Application approved; temporary password sent to the teacher.",
                "application": TeacherApplicationSerializer(
                    application, context={"request": request}
                ).data,
            }
        )


class ApplicationRejectView(APIView):
    permission_classes = [IsStaff]
    serializer_class = ApplicationRejectSerializer

    @extend_schema(request=ApplicationRejectSerializer, responses={200: TeacherApplicationSerializer})
    def post(self, request, pk):
        application = get_object_or_404(TeacherApplication, pk=pk)
        serializer = ApplicationRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reject_application(
            application, request.user, serializer.validated_data["notes"]
        )
        return Response(TeacherApplicationSerializer(application, context={"request": request}).data)
