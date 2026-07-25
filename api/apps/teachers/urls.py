from django.urls import path

from .views import TeacherDetailView, TeacherListView

app_name = "teachers"

urlpatterns = [
    path("", TeacherListView.as_view(), name="list"),
    path("<int:pk>/", TeacherDetailView.as_view(), name="detail"),
]
