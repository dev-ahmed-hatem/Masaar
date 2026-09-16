from rest_framework import status
from rest_framework.exceptions import APIException


class DuplicateApplication(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "An application for this phone number is already under review."
    default_code = "duplicate_application"


class ApplicationNotPending(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This application has already been reviewed."
    default_code = "application_not_pending"


class PhoneAlreadyUser(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "An account already exists for this phone number."
    default_code = "phone_taken"


class ApplicationEmailMissing(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This application has no email, so the sign-in details can't be sent."
    default_code = "application_email_missing"


class ProfileIncomplete(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Complete your profile before publishing."
    default_code = "profile_incomplete"

    def __init__(self, missing: list[str], incomplete_stages: list[int] | None = None):
        # Carry the machine-readable list of what's missing in the envelope detail.
        super().__init__(
            detail={
                "code": self.default_code,
                "detail": self.default_detail,
                "missing": missing,
            }
        )
        # Keep the ids numeric (DRF turns detail values into strings).
        self.detail["incomplete_stages"] = list(incomplete_stages or [])


class StageInUse(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This stage has upcoming lessons. Cancel or finish them before removing it."
    default_code = "stage_in_use"
