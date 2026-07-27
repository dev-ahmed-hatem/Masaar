from django.urls import path

from .views import NotificationListView, NotificationMarkReadView, NotificationUnreadCountView

app_name = "notifications"

urlpatterns = [
    path("", NotificationListView.as_view(), name="list"),
    path("mark-read/", NotificationMarkReadView.as_view(), name="mark-read"),
    path("unread-count/", NotificationUnreadCountView.as_view(), name="unread-count"),
]
