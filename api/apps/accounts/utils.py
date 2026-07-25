import re

# Default country dialing codes per market code.
MARKET_DIAL_CODES = {"EG": "20", "SA": "966"}


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
