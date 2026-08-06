from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsStaff, IsStudent

from . import services
from .models import Review
from .serializers import ReviewCreateSerializer, ReviewSerializer


class ReviewListCreateView(ListCreateAPIView):
    """Students post reviews for completed lessons; anyone reads published
    reviews for a teacher; moderators see all (incl. unpublished)."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStudent()]
        return [AllowAny()]

    def get_serializer_class(self):
        return ReviewCreateSerializer if self.request.method == "POST" else ReviewSerializer

    def _is_staff(self):
        user = self.request.user
        return user.is_authenticated and user.role in (User.Role.MODERATOR, User.Role.SUPERADMIN)

    def get_queryset(self):
        qs = Review.objects.select_related("student", "teacher__user")
        # A student's own review history (published or not).
        mine = self.request.query_params.get("mine")
        if mine and mine.lower() == "true" and self.request.user.is_authenticated:
            return qs.filter(student=self.request.user)
        teacher = self.request.query_params.get("teacher")
        if teacher:
            qs = qs.filter(teacher_id=teacher)
        if self._is_staff():
            published = self.request.query_params.get("published")
            if published is not None:
                qs = qs.filter(is_published=published.lower() == "true")
        else:
            qs = qs.filter(is_published=True)
        return qs

    @extend_schema(parameters=[OpenApiParameter("teacher", int), OpenApiParameter("published", bool)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = ReviewCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        review = services.create_review(
            request.user,
            serializer.validated_data["booking"],
            serializer.validated_data["rating"],
            serializer.validated_data.get("text", ""),
        )
        return Response(ReviewSerializer(review).data, status=201)


class _ModerationView(APIView):
    permission_classes = [IsStaff]
    published: bool = True

    def post(self, request, pk):
        review = get_object_or_404(Review.objects.select_related("teacher__user", "student"), pk=pk)
        services.set_published(review, self.published)
        return Response(ReviewSerializer(review).data)


class ReviewUnpublishView(_ModerationView):
    published = False


class ReviewRepublishView(_ModerationView):
    published = True
