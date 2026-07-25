from rest_framework import status
from rest_framework.exceptions import APIException


class InvalidTransition(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "That action is not allowed from the booking's current status."
    default_code = "invalid_transition"


class NotTeaching(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This teacher does not teach the selected subject."
    default_code = "not_teaching"


class MarketMismatch(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "You can only book teachers in your own market."
    default_code = "market_mismatch"


class SlotUnavailable(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "That time is not available or overlaps another booking."
    default_code = "slot_unavailable"


class TrialUnavailable(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "A free trial lesson is not available with this teacher."
    default_code = "trial_unavailable"
