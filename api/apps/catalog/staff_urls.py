from django.urls import path

from .staff_views import LessonCategoryAdminDetailView, LessonCategoryAdminListCreateView

app_name = "catalog_staff"

urlpatterns = [
    path(
        "lesson-categories/",
        LessonCategoryAdminListCreateView.as_view(),
        name="lesson-categories",
    ),
    path(
        "lesson-categories/<int:pk>/",
        LessonCategoryAdminDetailView.as_view(),
        name="lesson-category-detail",
    ),
]
