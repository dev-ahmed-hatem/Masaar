from django.urls import path

from .views import (
    BookingCancelView,
    BookingCompleteView,
    BookingConfirmView,
    BookingDeclineView,
    BookingDetailView,
    BookingDisputeView,
    BookingListCreateView,
    BookingNoShowView,
    BookingResolveView,
    SlotListView,
)

app_name = "bookings"

urlpatterns = [
    path("", BookingListCreateView.as_view(), name="list-create"),
    path("slots/", SlotListView.as_view(), name="slots"),
    path("<int:pk>/", BookingDetailView.as_view(), name="detail"),
    path("<int:pk>/confirm/", BookingConfirmView.as_view(), name="confirm"),
    path("<int:pk>/decline/", BookingDeclineView.as_view(), name="decline"),
    path("<int:pk>/complete/", BookingCompleteView.as_view(), name="complete"),
    path("<int:pk>/cancel/", BookingCancelView.as_view(), name="cancel"),
    path("<int:pk>/dispute/", BookingDisputeView.as_view(), name="dispute"),
    path("<int:pk>/no-show/", BookingNoShowView.as_view(), name="no-show"),
    path("<int:pk>/resolve/", BookingResolveView.as_view(), name="resolve"),
]
