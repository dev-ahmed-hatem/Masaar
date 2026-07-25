from rest_framework.permissions import BasePermission

from .models import User


class _RolePermission(BasePermission):
    role: str = ""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == self.role)


class IsStudent(_RolePermission):
    role = User.Role.STUDENT


class IsTeacher(_RolePermission):
    role = User.Role.TEACHER


class IsModerator(_RolePermission):
    role = User.Role.MODERATOR


class IsSuperAdmin(_RolePermission):
    role = User.Role.SUPERADMIN


class IsStaff(BasePermission):
    """Moderator or super-admin."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (User.Role.MODERATOR, User.Role.SUPERADMIN)
        )
