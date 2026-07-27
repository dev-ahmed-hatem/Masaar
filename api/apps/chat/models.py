from django.db import models

from apps.common.models import TimeStampedModel


class Thread(TimeStampedModel):
    """A 1:1 student↔teacher conversation. Available before any booking exists
    (spec §13) and continues after booking to coordinate the lesson."""

    student = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="chat_threads"
    )
    teacher = models.ForeignKey(
        "teachers.TeacherProfile", on_delete=models.PROTECT, related_name="chat_threads"
    )
    market = models.ForeignKey(
        "markets.Market", on_delete=models.PROTECT, related_name="chat_threads"
    )
    last_message_at = models.DateTimeField(null=True, blank=True)
    # Per-participant read watermarks: a message is unread for a side when it was
    # sent by the other side after that side's watermark.
    student_last_read_at = models.DateTimeField(null=True, blank=True)
    teacher_last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "teacher"], name="uniq_thread_student_teacher"
            )
        ]
        indexes = [
            models.Index(fields=["student", "-last_message_at"]),
            models.Index(fields=["teacher", "-last_message_at"]),
        ]

    def __str__(self):
        return f"{self.student} ↔ {self.teacher}"


class Message(TimeStampedModel):
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="chat_messages_sent"
    )
    body = models.TextField()

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["thread", "-created_at"])]

    def __str__(self):
        return f"{self.sender}: {self.body[:40]}"
