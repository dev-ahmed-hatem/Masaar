from django.urls import path

from .self_views import (
    TeacherDashboardView,
    TeacherPhotoView,
    TeacherProfilePublishView,
    TeacherProfileUnpublishView,
    TeacherProfileView,
    TeacherStageDetailView,
    TeacherStageListCreateView,
)

app_name = "teacher_self"

urlpatterns = [
    path("dashboard/", TeacherDashboardView.as_view(), name="dashboard"),
    path("profile/", TeacherProfileView.as_view(), name="profile"),
    path("profile/photo/", TeacherPhotoView.as_view(), name="profile-photo"),
    path("profile/publish/", TeacherProfilePublishView.as_view(), name="profile-publish"),
    path("profile/unpublish/", TeacherProfileUnpublishView.as_view(), name="profile-unpublish"),
    path("stages/", TeacherStageListCreateView.as_view(), name="stages"),
    path("stages/<int:pk>/", TeacherStageDetailView.as_view(), name="stage-detail"),
]
