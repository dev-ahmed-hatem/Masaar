from rest_framework import status
from rest_framework.exceptions import APIException


class InsufficientBalance(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Your wallet balance is not enough for this booking."
    default_code = "insufficient_balance"
