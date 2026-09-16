"""Shared helpers for staff-facing CRUD endpoints (`/api/admin/`)."""
from django.db.models import ProtectedError
from rest_framework.exceptions import APIException


class InUse(APIException):
    status_code = 409
    default_detail = "This item is in use and cannot be deleted. Deactivate it instead."
    default_code = "in_use"


class ProtectedDestroyMixin:
    """Turn a PROTECT-guarded delete (row still referenced) into a clean 409."""

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise InUse() from exc
