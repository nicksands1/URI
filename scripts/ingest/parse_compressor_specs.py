#!/usr/bin/env python3
"""
Second-pass, category-specific parse: turn generic catalog_parts rows in the
"Compressors" category into typed compressor_specs rows. Same technique as
parse_motor_specs.py - positionally zip the row's `columns` against its
`nearest_header_line`, re-split the same way, classify labels by keyword.

Does NOT extract refrigerant or application (low/med/high temp) - see
schema.sql comment on compressor_specs for why: those are prose tied to a
model family/series in a 2-column layout that doesn't reliably linearize to
one row, and guessing the association would be exactly the failure mode
CLAUDE.md 10 exists to prevent. The app-level UI must warn about this
explicitly rather than silently omit it.
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

FIELD_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"ship\s*wgt|weight", re.IGNORECASE), "weight_raw"),
    (re.compile(r"btuh|capacity", re.IGNORECASE), "capacity_btuh_raw"),
    (re.compile(r"^hp\b", re.IGNORECASE), "hp_raw"),
    (re.compile(r"volt", re.IGNORECASE), "voltage_raw"),
    (re.compile(r"phase", re.IGNORECASE), "phase_raw"),
    (re.compile(r"\brla\b", re.IGNORECASE), "rla_raw"),
    (re.compile(r"mount", re.IGNORECASE), "mount_raw"),
    (re.compile(r"suction", re.IGNORECASE), "suction_raw"),
    (re.compile(r"discharge", re.IGNORECASE), "discharge_raw"),
    (re.compile(r"^h$", re.IGNORECASE), "dim_h_raw"),
    (re.compile(r"^w$", re.IGNORECASE), "dim_w_raw"),
    (re.compile(r"^l$", re.IGNORECASE), "dim_l_raw"),
]


def _segments_in_range(v: str, lo: float, hi: float) -> bool:
    parts = re.split(r"[/‑\-x]", v)
    try:
        nums = [float(p) for p in parts if p.strip() != ""]
    except ValueError:
        return False
    return len(nums) > 0 and all(lo <= n <= hi for n in nums)


def _parse_mixed_number(v: str) -> float | None:
    """Parses "7 1/2", "1/4", or "12" -> float. Used for range-checking
    fields (like HP) that use mixed-fraction notation, which the simpler
    slash-splitting _segments_in_range can't handle correctly."""
    m = re.fullmatch(r"(\d+)\s+(\d+)/(\d+)", v)
    if m:
        whole, num, den = (int(x) for x in m.groups())
        return whole + num / den if den else None
    m = re.fullmatch(r"(\d+)/(\d+)", v)
    if m:
        num, den = (int(x) for x in m.groups())
        return num / den if den else None
    try:
        return float(v)
    except ValueError:
        return None


def _valid(field: str, value: str) -> bool:
    v = value.strip()
    if not v:
        return False
    if field == "capacity_btuh_raw":
        return (
            len(v) <= 8
            and re.fullmatch(r"[0-9]+(\.[0-9]+)?", v) is not None
            and _segments_in_range(v, 500, 600000)
        )
    if field == "hp_raw":
        if len(v) > 10 or re.fullmatch(r"[0-9]+(\s[0-9]+/[0-9]+)?(/[0-9]+)?", v) is None:
            return False
        num = _parse_mixed_number(v)
        # Bounded (0.03-200 HP) specifically to catch column-shift bugs
        # where an unrelated large number (e.g. a BTUH value) lands in the
        # HP slot and would otherwise pass the shape check alone - found
        # via real data during ingestion (ZR250KCETE5965), not assumed.
        return num is not None and 0.03 <= num <= 200
    if field == "voltage_raw":
        # Compressor line voltages in this catalog start at 115V; a lower
        # bound of 100 (vs. 12 for Motor, which includes small control
        # voltages) specifically rejects small numbers that are actually a
        # misassigned HP/RLA value from a column-shifted row.
        return (
            len(v) <= 14
            and re.fullmatch(r"[0-9]+(?:[/‑\-][0-9]+)*", v) is not None
            and _segments_in_range(v, 100, 600)
        )
    if field == "phase_raw":
        return v in ("1", "3")
    if field == "rla_raw":
        return len(v) <= 10 and re.fullmatch(r"[0-9]+(\.[0-9]+)?", v) is not None and _segments_in_range(v, 0.1, 200)
    if field in ("dim_h_raw", "dim_w_raw", "dim_l_raw"):
        return len(v) <= 8 and re.fullmatch(r"[0-9]+(\.[0-9]+)?", v) is not None and _segments_in_range(v, 0.5, 60)
    if field == "mount_raw":
        return len(v) <= 16 and re.fullmatch(r"[0-9./‑\- x]+", v) is not None
    if field in ("suction_raw", "discharge_raw"):
        return len(v) <= 16 and re.fullmatch(r"[0-9A-Za-z./‑\- ]+", v) is not None and any(c.isdigit() for c in v)
    if field == "weight_raw":
        return len(v) <= 8 and re.fullmatch(r"[0-9]+(\.[0-9]+)?", v) is not None and _segments_in_range(v, 1, 1200)
    return True


def classify_header(header_line: str) -> list[str | None]:
    labels = SPLIT_RE.split(header_line.strip())
    result: list[str | None] = []
    for label in labels:
        field = None
        for pattern, name in FIELD_RULES:
            if pattern.search(label):
                field = name
                break
        result.append(field)
    return result


def map_row(header_line: str, columns: list[str]) -> dict[str, str]:
    field_names = classify_header(header_line)
    mapped: dict[str, str] = {}
    for i, value in enumerate(columns[1:], start=1):
        if i >= len(field_names):
            break
        field = field_names[i]
        if field and field not in mapped and _valid(field, value):
            mapped[field] = value
    return mapped



def main() -> None:
    start = time.perf_counter()
    conn = get_conn()
    inserted = skipped_no_header = skipped_no_fields = total = 0
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as read_cur:
            read_cur.execute(
                """
                SELECT id, raw_part_number, normalized_part_number, columns,
                       nearest_header_line, section_title, pdf_page, catalog_page
                FROM catalog_parts
                WHERE category = 'Compressors'
                """
            )
            rows = read_cur.fetchall()

        with conn.cursor() as write_cur:
            write_cur.execute("TRUNCATE compressor_specs RESTART IDENTITY")
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
                        mapped.get("capacity_btuh_raw"),
                        mapped.get("hp_raw"),
                        mapped.get("voltage_raw"),
                        mapped.get("phase_raw"),
                        mapped.get("rla_raw"),
                        mapped.get("mount_raw"),
                        mapped.get("dim_h_raw"),
                        mapped.get("dim_w_raw"),
                        mapped.get("dim_l_raw"),
                        mapped.get("suction_raw"),
                        mapped.get("discharge_raw"),
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
                INSERT INTO compressor_specs
                    (catalog_part_id, raw_part_number, normalized_part_number,
                     capacity_btuh_raw, hp_raw, voltage_raw, phase_raw, rla_raw,
                     mount_raw, dim_h_raw, dim_w_raw, dim_l_raw, suction_raw,
                     discharge_raw, weight_raw, section_title, pdf_page,
                     catalog_page, header_line_used)
                VALUES %s
                """,
                insert_batch,
            )
        conn.commit()
    finally:
        conn.close()

    elapsed = time.perf_counter() - start
    print(f"Compressors rows seen: {total}")
    print(f"  -> inserted into compressor_specs : {inserted}")
    print(f"  -> skipped (no header found)       : {skipped_no_header}")
    print(f"  -> skipped (no fields mapped)      : {skipped_no_fields}")
    print(f"Done in {elapsed:.2f}s")


if __name__ == "__main__":
    main()
