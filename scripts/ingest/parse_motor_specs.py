#!/usr/bin/env python3
"""
Second-pass, category-specific parse: turn generic catalog_parts rows in the
"Motors and Accessories" category into typed motor_specs rows.

Approach: header labels and row values were both split on runs of 2+ spaces
(see parse_catalog.py). We re-split the nearest_header_line the same way and
zip it positionally against the row's already-split `columns`. Each header
label is classified into a canonical field by keyword match - not by exact
string match, because the catalog has 100+ slightly different header strings
across motor sub-tables (NEMA-frame motors, direct-drive fan motors, etc).

This is intentionally a best-effort mapper, not a guarantee. Rows where
nothing beyond the part number could be classified are left out of
motor_specs (they're still in catalog_parts and searchable there) rather
than inserted as an all-null row. review_status stays 'unreviewed' - this
populates a candidate pool for the question engine, not verified facts.
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import psycopg2.extras

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_conn  # noqa: E402

SPLIT_RE = re.compile(r"[ \t]{2,}")

# Order matters: more specific patterns first (e.g. "case l" before bare "l").
FIELD_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"case\s*l", re.IGNORECASE), "_ignore_case_length"),
    (re.compile(r"^dim\.?\s*\(in", re.IGNORECASE), "_ignore_dim"),
    (re.compile(r"^hp\b", re.IGNORECASE), "hp_or_watts_raw"),
    (re.compile(r"volt", re.IGNORECASE), "voltage_raw"),
    (re.compile(r"rpm", re.IGNORECASE), "rpm_raw"),
    (re.compile(r"amp", re.IGNORECASE), "amps_raw"),
    (re.compile(r"rotation", re.IGNORECASE), "rotation_raw"),
    (re.compile(r"speed", re.IGNORECASE), "num_speeds_raw"),
    (re.compile(r"capacitor", re.IGNORECASE), "capacitor_raw"),
    (re.compile(r"^dia", re.IGNORECASE), "shaft_dia_raw"),
    (re.compile(r"^l$", re.IGNORECASE), "shaft_length_raw"),
    (re.compile(r"wgt|weight", re.IGNORECASE), "weight_raw"),
]

TARGET_COLUMNS = [
    "hp_or_watts_raw", "voltage_raw", "rpm_raw", "amps_raw", "rotation_raw",
    "num_speeds_raw", "shaft_dia_raw", "shaft_length_raw", "capacitor_raw",
    "weight_raw",
]

# Shape validation, applied AFTER a header keyword match, BEFORE a value is
# accepted into a typed field. A header-position match alone isn't proof the
# cell actually contains that kind of value - misaligned/irregular rows (a
# bullet-point description, an application note) can land in the "right"
# column purely by position. Rather than store that as if it were a real
# voltage/rotation/etc., we drop it back to MISSING (None). Never silently
# keep a value that doesn't look like its field.
_NUMERIC_ISH = r"[0-9./‑\-\s]"


def _fullmatch_len(pattern: str, value: str, max_len: int) -> bool:
    return len(value) <= max_len and re.fullmatch(pattern, value) is not None


def _segments_in_range(v: str, lo: float, hi: float) -> bool:
    """All /-‑-separated numeric segments must fall in a plausible range.
    Catches e.g. an RPM value ("1075") or HP fraction ("3/4") that is
    shape-valid but semantically the wrong field for a misaligned row."""
    parts = re.split(r"[/‑\-]", v)
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        return False
    return all(lo <= n <= hi for n in nums)


def _valid(field: str, value: str) -> bool:
    v = value.strip()
    if not v:
        return False
    if field == "voltage_raw":
        return _fullmatch_len(r"[0-9]+(?:[/‑\-][0-9]+)*", v, 14) and _segments_in_range(v, 12, 600)
    if field == "rpm_raw":
        return _fullmatch_len(r"[0-9]+(?:[/‑\-][0-9]+)?", v, 9) and _segments_in_range(v, 200, 4000)
    if field == "amps_raw":
        return _fullmatch_len(
            r"[0-9]+(?:\.[0-9]+)?(?:[/‑\-][0-9]+(?:\.[0-9]+)?)?", v, 12
        ) and _segments_in_range(v, 0.02, 150)
    if field == "hp_or_watts_raw":
        return _fullmatch_len(r"[0-9]+(?:\s[0-9]+/[0-9]+)?(?:[/‑\-][0-9]+(?:/[0-9]+)?)?W?", v, 10)
    if field == "rotation_raw":
        return _fullmatch_len(r"[A-Z/]{2,10}", v, 10)
    if field == "num_speeds_raw":
        return _fullmatch_len(r"[0-9]{1,2}", v, 2) and _segments_in_range(v, 1, 6)
    if field == "shaft_dia_raw":
        v2 = re.sub(r"\s*Thd\.?$", "", v, flags=re.IGNORECASE)
        return _fullmatch_len(_NUMERIC_ISH + "+", v2, 12)
    if field == "shaft_length_raw" or field == "weight_raw":
        return _fullmatch_len(r"[0-9]+(?:\.[0-9]+)?", v, 8)
    if field == "capacitor_raw":
        if "•" in v or len(v) > 24:
            return False
        lowercase_words = re.findall(r"[a-z]{4,}", v)
        return len(lowercase_words) < 3
    return True


def classify_header(header_line: str) -> list[str | None]:
    """Return canonical field name (or None) for each header label, index 0
    onward corresponds to columns[0] onward (columns[0] is the raw part
    number token itself, which we skip when assigning)."""
    labels = SPLIT_RE.split(header_line.strip())
    result: list[str | None] = []
    for label in labels:
        field = None
        for pattern, name in FIELD_RULES:
            if pattern.search(label):
                field = None if name.startswith("_ignore") else name
                break
        result.append(field)
    return result


def map_row(header_line: str, columns: list[str]) -> dict[str, str]:
    field_names = classify_header(header_line)
    mapped: dict[str, str] = {}
    # columns[0] is the part number cell itself; header label[0] is "Part No."
    for i, value in enumerate(columns[1:], start=1):
        if i >= len(field_names):
            break
        field = field_names[i]
        if field and field not in mapped and _valid(field, value):  # keep first valid match only
            mapped[field] = value
    return mapped



def main() -> None:
    start = time.perf_counter()
    conn = get_conn()
    inserted = 0
    skipped_no_header = 0
    skipped_no_fields = 0
    total = 0
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as read_cur:
            read_cur.execute(
                """
                SELECT id, raw_part_number, normalized_part_number, columns,
                       nearest_header_line, section_title, pdf_page, catalog_page
                FROM catalog_parts
                WHERE category = 'Motors and Accessories'
                """
            )
            rows = read_cur.fetchall()

        with conn.cursor() as write_cur:
            write_cur.execute("TRUNCATE motor_specs RESTART IDENTITY")

            insert_batch = []
            for row in rows:
                total += 1
                header_line = row["nearest_header_line"]
                if not header_line:
                    skipped_no_header += 1
                    continue

                mapped = map_row(header_line, row["columns"])
                if not mapped:
                    skipped_no_fields += 1
                    continue

                insert_batch.append(
                    (
                        row["id"],
                        row["raw_part_number"],
                        row["normalized_part_number"],
                        mapped.get("hp_or_watts_raw"),
                        mapped.get("voltage_raw"),
                        mapped.get("rpm_raw"),
                        mapped.get("amps_raw"),
                        mapped.get("rotation_raw"),
                        mapped.get("num_speeds_raw"),
                        mapped.get("shaft_dia_raw"),
                        mapped.get("shaft_length_raw"),
                        mapped.get("capacitor_raw"),
                        mapped.get("weight_raw"),
                        row["section_title"],
                        row["pdf_page"],
                        row["catalog_page"],
                        header_line,
                    )
                )
                inserted += 1

            psycopg2.extras.execute_values(
                write_cur,
                """
                INSERT INTO motor_specs
                    (catalog_part_id, raw_part_number, normalized_part_number,
                     hp_or_watts_raw, voltage_raw, rpm_raw, amps_raw, rotation_raw,
                     num_speeds_raw, shaft_dia_raw, shaft_length_raw, capacitor_raw,
                     weight_raw, section_title, pdf_page, catalog_page, header_line_used)
                VALUES %s
                """,
                insert_batch,
            )
        conn.commit()
    finally:
        conn.close()

    elapsed = time.perf_counter() - start
    print(f"Motors and Accessories rows seen: {total}")
    print(f"  -> inserted into motor_specs : {inserted}")
    print(f"  -> skipped (no header found) : {skipped_no_header}")
    print(f"  -> skipped (no fields mapped): {skipped_no_fields}")
    print(f"Done in {elapsed:.2f}s")


if __name__ == "__main__":
    main()
