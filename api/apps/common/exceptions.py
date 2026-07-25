from rest_framework.views import exception_handler as drf_exception_handler


def masaar_exception_handler(exc, context):
    """Wrap DRF errors in a consistent envelope.

    { "error": { "code": <str>, "message": <str>, "detail": <original DRF body> } }
    """
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    code = getattr(exc, "default_code", None) or "error"
    # Prefer an explicit {"code": ...} provided by the raiser.
    if isinstance(data, dict) and "code" in data and isinstance(data["code"], str):
        code = data["code"]

    message = _extract_message(data)
    response.data = {"error": {"code": code, "message": message, "detail": data}}
    return response


def _extract_message(data) -> str:
    if isinstance(data, dict):
        if "detail" in data:
            return str(data["detail"])
        for value in data.values():
            if isinstance(value, (list, tuple)) and value:
                return str(value[0])
            if isinstance(value, str):
                return value
    if isinstance(data, (list, tuple)) and data:
        return str(data[0])
    return "Request failed."
