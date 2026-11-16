from datetime import datetime, timezone


def to_utc(value: datetime) -> datetime:
    """Convert an aware datetime to UTC without changing its instant."""
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timestamp must include a timezone.")
    return value.astimezone(timezone.utc)
