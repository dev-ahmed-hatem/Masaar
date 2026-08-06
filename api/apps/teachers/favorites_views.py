from rest_framework import serializers
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStudent

from .models import FavoriteTeacher, TeacherProfile
from .serializers import TeacherListSerializer
from .views import from_price_subquery


class FavoriteCreateSerializer(serializers.Serializer):
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=TeacherProfile.objects.filter(is_published=True)
    )


class FavoriteListCreateView(ListCreateAPIView):
    """A student's saved teachers (list) and add-to-favorites (create)."""

    permission_classes = [IsStudent]
    pagination_class = None

    def get_serializer_class(self):
        return FavoriteCreateSerializer if self.request.method == "POST" else TeacherListSerializer

    def get_queryset(self):
        fav_ids = list(
            FavoriteTeacher.objects.filter(student=self.request.user).values_list(
                "teacher_id", flat=True
            )
        )
        return (
            TeacherProfile.objects.filter(id__in=fav_ids, is_published=True)
            .select_related("user", "market")
            .prefetch_related("subjects__lesson_category__subject")
            .annotate(from_price_minor=from_price_subquery())
        )

    def create(self, request, *args, **kwargs):
        serializer = FavoriteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        FavoriteTeacher.objects.get_or_create(
            student=request.user, teacher=serializer.validated_data["teacher"]
        )
        return Response(status=201)


class FavoriteDeleteView(APIView):
    permission_classes = [IsStudent]

    def delete(self, request, teacher_id):
        FavoriteTeacher.objects.filter(student=request.user, teacher_id=teacher_id).delete()
        return Response(status=204)
