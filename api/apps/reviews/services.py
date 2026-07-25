"""Review creation and teacher rating recomputation."""
from django.db import transaction
from django.db.models import Avg, Count

from .models import Review


def recompute_rating(teacher):
    """Recompute a teacher's rating_avg / rating_count from published reviews."""
    agg = teacher.reviews.filter(is_published=True).aggregate(avg=Avg("rating"), n=Count("id"))
    teacher.rating_avg = round(agg["avg"] or 0, 2)
    teacher.rating_count = agg["n"] or 0
    teacher.save(update_fields=["rating_avg", "rating_count", "updated_at"])


@transaction.atomic
def create_review(student, booking, rating, text=""):
    review = Review.objects.create(
        booking=booking,
        student=student,
        teacher=booking.teacher,
        rating=rating,
        text=text,
        is_published=True,
    )
    recompute_rating(booking.teacher)
    return review


@transaction.atomic
def set_published(review, published):
    review.is_published = published
    review.save(update_fields=["is_published", "updated_at"])
    recompute_rating(review.teacher)
    return review
