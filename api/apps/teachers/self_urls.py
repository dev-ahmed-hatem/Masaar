from django.urls import path

from .self_views import (
    AvailabilityDeleteView,
    AvailabilityListCreateView,
    LessonCategoryListView,
    TeacherPriceDeleteView,
    TeacherPriceListCreateView,
    TeacherProfilePublishView,
    TeacherProfileUnpublishView,
    TeacherProfileView,
    TeacherSubjectDeleteView,
    TeacherSubjectListCreateView,
)

app_name = "teacher_self"

urlpatterns = [
    path("profile/", TeacherProfileView.as_view(), name="profile"),
    path("profile/publish/", TeacherProfilePublishView.as_view(), name="profile-publish"),
    path("profile/unpublish/", TeacherProfileUnpublishView.as_view(), name="profile-unpublish"),
    path("lesson-categories/", LessonCategoryListView.as_view(), name="lesson-categories"),
    path("subjects/", TeacherSubjectListCreateView.as_view(), name="subjects"),
    path("subjects/<int:pk>/", TeacherSubjectDeleteView.as_view(), name="subject-delete"),
    path("availability/", AvailabilityListCreateView.as_view(), name="availability"),
    path("availability/<int:pk>/", AvailabilityDeleteView.as_view(), name="availability-delete"),
    path("prices/", TeacherPriceListCreateView.as_view(), name="prices"),
    path("prices/<int:pk>/", TeacherPriceDeleteView.as_view(), name="price-delete"),
]
