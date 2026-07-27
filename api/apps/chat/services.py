"""Chat thread/message operations and unread accounting."""
from django.db import transaction
from django.db.models import Count, F, IntegerField, OuterRef, Q, Subquery, Value
from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.services import notify

from .models import Message, Thread


def get_or_create_thread(student, teacher):
    """Idempotent: one thread per (student, teacher) pair."""
    return Thread.objects.get_or_create(
        student=student, teacher=teacher, defaults={"market": teacher.market}
    )


def _unread_filter(side: str, user) -> Q:
    """Messages unread for `side` ('student'/'teacher'): sent by the other party
    after that side's read watermark (everything if never read)."""
    return ~Q(messages__sender=user) & (
        Q(**{f"{side}_last_read_at__isnull": True})
        | Q(messages__created_at__gt=F(f"{side}_last_read_at"))
    )


def annotated_threads(user):
    """The user's threads with last-message preview + unread_count, one query."""
    last = Message.objects.filter(thread=OuterRef("pk")).order_by("-created_at", "-id")
    qs = Thread.objects.select_related("student", "teacher__user").annotate(
        last_body=Subquery(last.values("body")[:1]),
        last_sender_id=Subquery(last.values("sender_id")[:1]),
    )
    if user.role == User.Role.STUDENT:
        qs = qs.filter(student=user).annotate(
            unread_count=Count("messages", filter=_unread_filter("student", user))
        )
    elif user.role == User.Role.TEACHER:
        qs = qs.filter(teacher__user=user).annotate(
            unread_count=Count("messages", filter=_unread_filter("teacher", user))
        )
    else:  # staff: read-only overview, unread not meaningful
        qs = qs.annotate(unread_count=Value(0, IntegerField()))
    # Meta.ordering is dropped on aggregate-annotated queries; re-apply.
    return qs.order_by("-last_message_at", "-id")


def unread_total(user) -> int:
    if user.role not in (User.Role.STUDENT, User.Role.TEACHER):
        return 0
    return sum(annotated_threads(user).values_list("unread_count", flat=True))


@transaction.atomic
def send_message(thread, sender, body) -> Message:
    if sender.id == thread.student_id:
        recipient = thread.teacher.user
        recipient_read = thread.teacher_last_read_at
    else:
        recipient = thread.student
        recipient_read = thread.student_last_read_at

    # Notify only on the recipient's 0→1 unread transition for this thread —
    # rapid-fire messages produce one notification until the thread is read.
    prior_unread = thread.messages.exclude(sender=recipient)
    if recipient_read:
        prior_unread = prior_unread.filter(created_at__gt=recipient_read)
    should_notify = not prior_unread.exists()

    message = Message.objects.create(thread=thread, sender=sender, body=body)
    thread.last_message_at = message.created_at
    thread.save(update_fields=["last_message_at", "updated_at"])

    if should_notify:
        notify(
            recipient,
            "chat_message",
            {
                "sender": sender.full_name,
                "thread_id": thread.id,
                "preview": body[:80],
            },
        )
    return message


def mark_read(thread, user):
    field = "student_last_read_at" if user.id == thread.student_id else "teacher_last_read_at"
    setattr(thread, field, timezone.now())
    thread.save(update_fields=[field, "updated_at"])
