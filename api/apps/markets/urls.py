from django.urls import path

from .views import MarketListView

app_name = "markets"

urlpatterns = [
    path("", MarketListView.as_view(), name="list"),
]
