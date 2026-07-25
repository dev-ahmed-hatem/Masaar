from django.urls import path

from .views import GradeLevelListView, SubjectListView, VerticalListView

app_name = "catalog"

urlpatterns = [
    path("verticals/", VerticalListView.as_view(), name="verticals"),
    path("grade-levels/", GradeLevelListView.as_view(), name="grade-levels"),
    path("subjects/", SubjectListView.as_view(), name="subjects"),
]
