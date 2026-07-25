"""Teacher onboarding: approve/reject applications, provisioning accounts."""
import secrets
import string

from django.db import transaction

from apps.accounts.models import User
from apps.accounts.senders import get_account_sender

from . import errors
from .models import TeacherApplication, TeacherProfile

_ALPHABET = string.ascii_letters + string.digits


def generate_temp_password(length: int = 10) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


@transaction.atomic
def approve_application(application: TeacherApplication, reviewer: User) -> User:
    """Approve an application: create the teacher account + draft profile, and
    WhatsApp a temporary password the teacher must change on first sign-in."""
    if application.status != TeacherApplication.Status.PENDING:
        raise errors.ApplicationNotPending()
    if User.objects.filter(phone=application.phone).exists():
        raise errors.PhoneAlreadyUser()

    temp_password = generate_temp_password()
    user = User.objects.create_user(
        phone=application.phone,
        password=temp_password,
        full_name=application.full_name,
        email=application.email,
        role=User.Role.TEACHER,
        market=application.market,
        is_verified=True,
        must_change_password=True,
    )
    profile = TeacherProfile.objects.create(
        user=user,
        market=application.market,
        bio_en=application.bio,
        intro_video_url=application.intro_video_url,
        is_published=False,
    )
    application.status = TeacherApplication.Status.APPROVED
    application.reviewed_by = reviewer
    application.created_profile = profile
    application.save()

    get_account_sender().send_message(
        application.phone,
        f"Your Masaar teacher account is approved. Temporary password: {temp_password}. "
        "Sign in and set a new password.",
    )
    return user


@transaction.atomic
def reject_application(
    application: TeacherApplication, reviewer: User, notes: str = ""
) -> TeacherApplication:
    if application.status not in (
        TeacherApplication.Status.PENDING,
        TeacherApplication.Status.CHANGES_REQUESTED,
    ):
        raise errors.ApplicationNotPending()
    application.status = TeacherApplication.Status.REJECTED
    application.reviewed_by = reviewer
    application.review_notes = notes
    application.save()
    return application
