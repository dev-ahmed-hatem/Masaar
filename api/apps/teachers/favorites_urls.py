from django.urls import path

from .favorites_views import FavoriteDeleteView, FavoriteListCreateView

app_name = "favorites"

urlpatterns = [
    path("", FavoriteListCreateView.as_view(), name="list-create"),
    path("<int:teacher_id>/", FavoriteDeleteView.as_view(), name="delete"),
]
