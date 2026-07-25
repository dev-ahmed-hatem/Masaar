from django.urls import path

from .views import ReviewListCreateView, ReviewRepublishView, ReviewUnpublishView

app_name = "reviews"

urlpatterns = [
    path("", ReviewListCreateView.as_view(), name="list-create"),
    path("<int:pk>/unpublish/", ReviewUnpublishView.as_view(), name="unpublish"),
    path("<int:pk>/republish/", ReviewRepublishView.as_view(), name="republish"),
]
