"""Teacher self-serve API (`/api/teacher/`): manage own profile, subjects,
availability and custom-price requests, and publish/unpublish the profile."""
from rest_framework.generics import (
    DestroyAPIView,
    ListAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
)
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsTeacher
from apps.catalog.models import LessonCategory
from apps.catalog.serializers import LessonCategorySerializer

from . import errors
from .models import AvailabilityRule, TeacherPrice, TeacherProfile, TeacherSubject
from .self_serializers import (
    AvailabilitySerializer,
    TeacherPriceCreateSerializer,
    TeacherPriceReadSerializer,
    TeacherProfileSerializer,
    TeacherSubjectCreateSerializer,
    TeacherSubjectReadSerializer,
)


class _TeacherScoped:
    permission_classes = [IsTeacher]

    def get_teacher(self) -> TeacherProfile:
        try:
            return self.request.user.teacher_profile
        except TeacherProfile.DoesNotExist:
            raise NotFound("No teacher profile for this account.")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["teacher"] = self.get_teacher()
        return ctx


class TeacherProfileView(_TeacherScoped, RetrieveUpdateAPIView):
    """GET / PATCH the authenticated teacher's own profile."""

    serializer_class = TeacherProfileSerializer

    def get_object(self):
        return self.get_teacher()


class TeacherProfilePublishView(_TeacherScoped, APIView):
    def post(self, request):
        teacher = self.get_teacher()
        missing = []
        if not teacher.subjects.exists():
            missing.append("subject")
        if not (teacher.bio_en or teacher.bio_ar):
            missing.append("bio")
        if missing:
            raise errors.ProfileIncomplete(missing)
        if not teacher.is_published:
            teacher.is_published = True
            teacher.save(update_fields=["is_published"])
        return Response(TeacherProfileSerializer(teacher).data)


class TeacherProfileUnpublishView(_TeacherScoped, APIView):
    def post(self, request):
        teacher = self.get_teacher()
        if teacher.is_published:
            teacher.is_published = False
            teacher.save(update_fields=["is_published"])
        return Response(TeacherProfileSerializer(teacher).data)


class LessonCategoryListView(_TeacherScoped, ListAPIView):
    """Pickable lesson categories in the teacher's market."""

    serializer_class = LessonCategorySerializer
    pagination_class = None

    def get_queryset(self):
        teacher = self.get_teacher()
        return LessonCategory.objects.filter(
            market_id=teacher.market_id, is_active=True
        ).select_related("vertical", "grade_level", "subject")


class TeacherSubjectListCreateView(_TeacherScoped, ListCreateAPIView):
    pagination_class = None

    def get_serializer_class(self):
        return (
            TeacherSubjectCreateSerializer
            if self.request.method == "POST"
            else TeacherSubjectReadSerializer
        )

    def get_queryset(self):
        return TeacherSubject.objects.filter(
            teacher=self.get_teacher()
        ).select_related("lesson_category__vertical", "lesson_category__grade_level", "lesson_category__subject")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        teacher = ctx["teacher"]
        ctx["overrides"] = {
            p.lesson_category_id: p.custom_student_price_minor
            for p in teacher.prices.filter(is_approved=True)
        }
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subject = serializer.save()
        read = TeacherSubjectReadSerializer(subject, context=self.get_serializer_context())
        return Response(read.data, status=201)


class TeacherSubjectDeleteView(_TeacherScoped, DestroyAPIView):
    def get_queryset(self):
        return TeacherSubject.objects.filter(teacher=self.get_teacher())


class AvailabilityListCreateView(_TeacherScoped, ListCreateAPIView):
    serializer_class = AvailabilitySerializer
    pagination_class = None

    def get_queryset(self):
        return AvailabilityRule.objects.filter(teacher=self.get_teacher())


class AvailabilityDeleteView(_TeacherScoped, DestroyAPIView):
    def get_queryset(self):
        return AvailabilityRule.objects.filter(teacher=self.get_teacher())


class TeacherPriceListCreateView(_TeacherScoped, ListCreateAPIView):
    pagination_class = None

    def get_serializer_class(self):
        return (
            TeacherPriceCreateSerializer
            if self.request.method == "POST"
            else TeacherPriceReadSerializer
        )

    def get_queryset(self):
        return TeacherPrice.objects.filter(
            teacher=self.get_teacher()
        ).select_related("lesson_category__vertical", "lesson_category__grade_level", "lesson_category__subject")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        price = serializer.save()
        return Response(TeacherPriceReadSerializer(price).data, status=201)


class TeacherPriceDeleteView(_TeacherScoped, DestroyAPIView):
    def get_queryset(self):
        return TeacherPrice.objects.filter(teacher=self.get_teacher())
