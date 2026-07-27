from django.urls import path

from .views import (
    MessageListCreateView,
    ThreadDetailView,
    ThreadListCreateView,
    ThreadMarkReadView,
    UnreadCountView,
)

app_name = "chat"

urlpatterns = [
    path("threads/", ThreadListCreateView.as_view(), name="thread-list-create"),
    path("threads/<int:pk>/", ThreadDetailView.as_view(), name="thread-detail"),
    path("threads/<int:pk>/messages/", MessageListCreateView.as_view(), name="messages"),
    path("threads/<int:pk>/read/", ThreadMarkReadView.as_view(), name="mark-read"),
    path("unread-count/", UnreadCountView.as_view(), name="unread-count"),
]
