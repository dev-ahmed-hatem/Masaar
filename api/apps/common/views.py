from django.http import JsonResponse


def health(request):
    """Lightweight, unauthenticated liveness probe."""
    return JsonResponse({"status": "ok", "service": "masaar-api"})
