from django.db.models import F, IntegerField, OuterRef, Prefetch, Subquery
from django.db.models.functions import Coalesce
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
from .models import (
    AvailabilityRule,
    TeacherApplication,
    TeacherPrice,
    TeacherProfile,
    TeacherSubject,
)
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
    """Min effective price across a teacher's offerings.

    Effective price resolves an approved per-teacher override, falling back to
    the lesson category's default student price.
    """
    approved_override = TeacherPrice.objects.filter(
        teacher=OuterRef("teacher_id"),
        lesson_category=OuterRef("lesson_category_id"),
        is_approved=True,
    ).values("custom_student_price_minor")[:1]

    cheapest = (
        TeacherSubject.objects.filter(teacher=OuterRef("pk"))
        .annotate(
            eff=Coalesce(
                Subquery(approved_override, output_field=IntegerField()),
                F("lesson_category__student_price_minor"),
            )
        )
        .order_by("eff")
        .values("eff")[:1]
    )
    return Subquery(cheapest, output_field=IntegerField())


class TeacherFilter(filters.FilterSet):
    # Discovery filters run off the teacher's specialization tags (stage → track
    # → subject), which are seeded from offerings and refined by the teacher.
    subject = filters.NumberFilter(
        field_name="specializations__subject_id", distinct=True
    )
    stage = filters.NumberFilter(
        field_name="specializations__vertical_id", distinct=True
    )
    track = filters.NumberFilter(
        field_name="specializations__track_id", distinct=True
    )
    grade = filters.NumberFilter(
        field_name="subjects__lesson_category__grade_level_id", distinct=True
    )
    vertical = filters.CharFilter(
        field_name="subjects__lesson_category__vertical__code", distinct=True
    )
    language = filters.CharFilter(field_name="languages", lookup_expr="icontains")
    name = filters.CharFilter(field_name="user__full_name", lookup_expr="icontains")
    min_rating = filters.NumberFilter(field_name="rating_avg", lookup_expr="gte")
    price_min = filters.NumberFilter(field_name="from_price_minor", lookup_expr="gte")
    price_max = filters.NumberFilter(field_name="from_price_minor", lookup_expr="lte")
    weekday = filters.NumberFilter(field_name="availability__weekday", distinct=True)

    class Meta:
        model = TeacherProfile
        fields = ["gender"]


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
        OpenApiParameter("subject", int, description="Subject id (from specialization tags)"),
        OpenApiParameter("stage", int, description="Stage id (from specialization tags)"),
        OpenApiParameter("track", int, description="Branch/faculty id (from specialization tags)"),
        OpenApiParameter("grade", int, description="Grade level id"),
        OpenApiParameter("vertical", str, description="Vertical code (from offerings)"),
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
            .prefetch_related(
                Prefetch(
                    "subjects",
                    queryset=TeacherSubject.objects.select_related(
                        "lesson_category__subject"
                    ),
                ),
                "specializations__vertical",
                "specializations__track",
                "specializations__subject",
            )
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
                Prefetch(
                    "subjects",
                    queryset=TeacherSubject.objects.select_related(
                        "lesson_category__subject",
                        "lesson_category__vertical",
                        "lesson_category__grade_level",
                    ),
                ),
                "prices",
                Prefetch(
                    "availability",
                    queryset=AvailabilityRule.objects.all(),
                ),
                Prefetch(
                    "reviews",
                    queryset=Review.objects.filter(is_published=True).select_related(
                        "student"
                    ),
                ),
                "specializations__vertical",
                "specializations__track",
                "specializations__subject",
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
            TeacherApplicationSerializer(application).data, status=201
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
                "application": TeacherApplicationSerializer(application).data,
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
        return Response(TeacherApplicationSerializer(application).data)
