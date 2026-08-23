from django.urls import path

from .staff_views import (
    LessonCategoryAdminDetailView,
    LessonCategoryAdminListCreateView,
    StageAdminDetailView,
    StageAdminListCreateView,
    StageSubjectAdminDetailView,
    StageSubjectAdminListCreateView,
    SubjectAdminDetailView,
    SubjectAdminListCreateView,
    TrackAdminDetailView,
    TrackAdminListCreateView,
)

app_name = "catalog_staff"

urlpatterns = [
    path(
        "lesson-categories/",
        LessonCategoryAdminListCreateView.as_view(),
        name="lesson-categories",
    ),
    path(
        "lesson-categories/<int:pk>/",
        LessonCategoryAdminDetailView.as_view(),
        name="lesson-category-detail",
    ),
    path("stages/", StageAdminListCreateView.as_view(), name="stages"),
    path("stages/<int:pk>/", StageAdminDetailView.as_view(), name="stage-detail"),
    path("tracks/", TrackAdminListCreateView.as_view(), name="tracks"),
    path("tracks/<int:pk>/", TrackAdminDetailView.as_view(), name="track-detail"),
    path("subjects/", SubjectAdminListCreateView.as_view(), name="subjects"),
    path("subjects/<int:pk>/", SubjectAdminDetailView.as_view(), name="subject-detail"),
    path("stage-subjects/", StageSubjectAdminListCreateView.as_view(), name="stage-subjects"),
    path("stage-subjects/<int:pk>/", StageSubjectAdminDetailView.as_view(), name="stage-subject-detail"),
]
