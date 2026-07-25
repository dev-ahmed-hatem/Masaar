from rest_framework import status
from rest_framework.exceptions import APIException


class BookingNotCompleted(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "You can only review a completed lesson."
    default_code = "booking_not_completed"


class AlreadyReviewed(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This lesson has already been reviewed."
    default_code = "already_reviewed"
