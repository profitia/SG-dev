from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, timezone
from typing import Any, Mapping

DATE_ONLY_PATTERN = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
NAIVE_TIMESTAMP_PATTERN = re.compile(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$")


def _format_utc_instant(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _parse_iso_like_instant(value: str, label: str) -> datetime:
    trimmed = value.strip()
    if trimmed == "":
        raise ValueError(f"{label} must be a non-empty ISO date or timestamp.")

    date_only_match = DATE_ONLY_PATTERN.fullmatch(trimmed)
    if date_only_match is not None:
        parsed_date = date.fromisoformat(trimmed)
        return datetime(parsed_date.year, parsed_date.month, parsed_date.day, tzinfo=timezone.utc)

    naive_match = NAIVE_TIMESTAMP_PATTERN.fullmatch(trimmed)
    if naive_match is not None:
        year, month, day, hour, minute, second, milliseconds = naive_match.groups()
        return datetime(
            int(year),
            int(month),
            int(day),
            int(hour),
            int(minute),
            int(second),
            int((milliseconds or "").ljust(3, "0")[:3]) * 1000,
            tzinfo=timezone.utc,
        )

    normalized = trimmed.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{label} must be a valid ISO date or timestamp, received {value}.") from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def normalize_monthly_period_identity(value: str, label: str) -> str:
    parsed = _parse_iso_like_instant(value, label)
    if (
        parsed.day != 1
        or parsed.hour != 0
        or parsed.minute != 0
        or parsed.second != 0
        or parsed.microsecond != 0
    ):
        raise ValueError(
            f"{label} must identify a canonical MONTHLY period using the first day of the month at 00:00:00.000Z, received {value}."
        )

    return _format_utc_instant(parsed)


def normalize_source_observed_at_identity(value: str, label: str) -> str:
    return _format_utc_instant(_parse_iso_like_instant(value, label))


def build_history_fingerprint(history: Mapping[str, Any]) -> str:
    normalized_points = []
    for point in history["points"]:
        source_observed_at = point.get("sourceObservedAt")
        normalized_points.append(
            {
                "date": normalize_monthly_period_identity(str(point["date"]), "Forecast history point date"),
                "value": point.get("value"),
                "sourceObservedAt": None
                if source_observed_at in (None, "")
                else normalize_source_observed_at_identity(str(source_observed_at), "Forecast history point sourceObservedAt"),
            }
        )

    normalized_points.sort(key=lambda point: point["date"])

    segments = [
        str(history["seriesId"]),
        str(history["frequency"]),
        normalize_monthly_period_identity(str(history["start"]), "Forecast history start"),
        normalize_monthly_period_identity(str(history["end"]), "Forecast history end"),
        str(history["observations"]),
    ]

    canonicalization = history.get("canonicalization")
    if isinstance(canonicalization, Mapping):
        segments.append(str(canonicalization["method"]))
        segments.append(str(canonicalization["version"]))

    for point in normalized_points:
        segment = f"{point['date']}={'null' if point['value'] is None else point['value']}"
        if point["sourceObservedAt"] is not None:
            segment = f"{segment}@{point['sourceObservedAt']}"
        segments.append(segment)

    return hashlib.sha256("\n".join(segments).encode("utf-8")).hexdigest()