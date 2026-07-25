from rest_framework import status
from rest_framework.exceptions import APIException


class PhoneAlreadyRegistered(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This phone number is already registered."
    default_code = "phone_taken"


class PhoneNotVerified(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Phone number is not verified yet."
    default_code = "phone_not_verified"


class OTPInvalid(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The code is incorrect."
    default_code = "otp_invalid"


class OTPExpired(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The code has expired. Request a new one."
    default_code = "otp_expired"


class OTPAttemptsExceeded(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Too many incorrect attempts. Request a new code."
    default_code = "otp_attempts_exceeded"


class OTPCooldown(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Please wait before requesting another code."
    default_code = "otp_cooldown"
