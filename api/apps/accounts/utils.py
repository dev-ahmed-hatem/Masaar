import re

from apps.markets.countries import DIAL_CODES as MARKET_DIAL_CODES


def normalize_phone(phone: str, market_code: str | None = None) -> str:
    """Best-effort E.164-ish normalization.

    - strips spaces, dashes, and parentheses
    - converts a leading 00 to +
    - if no country code is present, prefixes the market's dial code
    """
    if not phone:
        return phone
    cleaned = re.sub(r"[\s\-()]", "", phone.strip())
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if cleaned.startswith("+"):
        return cleaned
    dial = MARKET_DIAL_CODES.get((market_code or "").upper())
    if cleaned.startswith("0"):
        cleaned = cleaned[1:]
    if dial:
        return f"+{dial}{cleaned}"
    return f"+{cleaned}"


def mask_email(email: str) -> str:
    """Hide most of the local part: "ahmed@gmail.com" -> "a****@gmail.com"."""
    local, sep, domain = (email or "").partition("@")
    if not sep:
        return email
    return f"{local[:1]}{'*' * max(len(local) - 1, 3)}@{domain}"
