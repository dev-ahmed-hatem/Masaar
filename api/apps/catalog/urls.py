from django.urls import path

from .views import (
    GradeLevelListView,
    StageSubjectListView,
    SubjectListView,
    TrackListView,
    VerticalListView,
)

app_name = "catalog"

urlpatterns = [
    path("verticals/", VerticalListView.as_view(), name="verticals"),
    path("tracks/", TrackListView.as_view(), name="tracks"),
    path("grade-levels/", GradeLevelListView.as_view(), name="grade-levels"),
    path("subjects/", SubjectListView.as_view(), name="subjects"),
    path("stage-subjects/", StageSubjectListView.as_view(), name="stage-subjects"),
]
