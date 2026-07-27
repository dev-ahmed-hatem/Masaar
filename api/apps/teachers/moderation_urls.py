from django.urls import path

from .moderation_views import (
    PriceRequestApproveView,
    PriceRequestListView,
    PriceRequestRejectView,
)

app_name = "teacher_moderation"

urlpatterns = [
    path("", PriceRequestListView.as_view(), name="price-requests"),
    path("<int:pk>/approve/", PriceRequestApproveView.as_view(), name="price-request-approve"),
    path("<int:pk>/reject/", PriceRequestRejectView.as_view(), name="price-request-reject"),
]
