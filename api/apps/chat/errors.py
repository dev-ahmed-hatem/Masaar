from rest_framework import status
from rest_framework.exceptions import APIException


class MarketMismatch(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "You can only message teachers in your market."
    default_code = "market_mismatch"
