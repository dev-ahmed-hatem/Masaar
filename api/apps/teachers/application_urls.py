from django.urls import path

from .views import (
    ApplicationApproveView,
    ApplicationDetailView,
    ApplicationListCreateView,
    ApplicationRejectView,
)

app_name = "teacher_applications"

urlpatterns = [
    path("", ApplicationListCreateView.as_view(), name="list-create"),
    path("<int:pk>/", ApplicationDetailView.as_view(), name="detail"),
    path("<int:pk>/approve/", ApplicationApproveView.as_view(), name="approve"),
    path("<int:pk>/reject/", ApplicationRejectView.as_view(), name="reject"),
]
