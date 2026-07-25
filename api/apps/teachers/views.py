from django.db.models import F, IntegerField, OuterRef, Prefetch, Subquery
from django.db.models.functions import Coalesce
from django_filters import rest_framework as filters
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from apps.markets.models import Market
from apps.reviews.models import Review

from .models import AvailabilityRule, TeacherPrice, TeacherProfile, TeacherSubject
from .serializers import TeacherDetailSerializer, TeacherListSerializer


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
    subject = filters.NumberFilter(
        field_name="subjects__lesson_category__subject_id", distinct=True
    )
    grade = filters.NumberFilter(
        field_name="subjects__lesson_category__grade_level_id", distinct=True
    )
    vertical = filters.CharFilter(
        field_name="subjects__lesson_category__vertical__code", distinct=True
    )
    language = filters.CharFilter(field_name="languages", lookup_expr="icontains")
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
        OpenApiParameter("subject", int, description="Subject id"),
        OpenApiParameter("grade", int, description="Grade level id"),
        OpenApiParameter("vertical", str, description="Vertical code"),
        OpenApiParameter("gender", str, description="MALE / FEMALE"),
        OpenApiParameter("language", str, description="Language code substring, e.g. 'en'"),
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
                )
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
            )
            .annotate(from_price_minor=from_price_subquery())
        )
