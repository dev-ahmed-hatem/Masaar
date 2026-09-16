"""Teacher onboarding: approve/reject applications, provisioning accounts."""
import secrets
import string

from django.db import transaction

from apps.accounts.models import User
from apps.accounts.senders import get_account_sender, uses_email

from . import errors, stage_setup
from .models import TeacherApplication, TeacherProfile, TeacherStage

_ALPHABET = string.ascii_letters + string.digits


def generate_temp_password(length: int = 10) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def _materialize_teaching_setup(application: TeacherApplication, profile: TeacherProfile) -> None:
    """Turn the application's stage cards into real rows on the new profile.

    Cards were validated at submit time; an already-present stage/track is
    skipped so a retried approval stays idempotent.
    """
    for card in application.stages or []:
        if not TeacherStage.objects.filter(
            teacher=profile, vertical_id=card.get("vertical"), track_id=card.get("track")
        ).exists():
            stage_setup.write_card(profile, card)


@transaction.atomic
def approve_application(application: TeacherApplication, reviewer: User) -> User:
    """Approve an application: create the teacher account and a draft profile
    populated with everything the applicant submitted (so the reviewed data
    becomes their profile), and send (WhatsApp or email, per OTP_CHANNEL) a
    temporary password to change on first sign-in."""
    if application.status != TeacherApplication.Status.PENDING:
        raise errors.ApplicationNotPending()
    if uses_email() and not application.email:
        raise errors.ApplicationEmailMissing()
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
        gender=application.gender,
        languages=application.languages,
        bio_en=application.bio,
        bio_ar=application.bio_ar,
        intro_video_url=application.intro_video_url,
        photo=application.photo or None,
        specialties=application.specialties or [],
        education=application.education or [],
        work_experience=application.work_experience or [],
        certifications=application.certifications or [],
        is_published=False,
    )
    _materialize_teaching_setup(application, profile)

    application.status = TeacherApplication.Status.APPROVED
    application.reviewed_by = reviewer
    application.created_profile = profile
    application.save()

    get_account_sender().send_message(
        application.phone,
        f"Your Wisal teacher account is approved. Temporary password: {temp_password}. "
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
