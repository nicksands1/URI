#!/usr/bin/env python3
"""
Second-pass, category-specific parse: typed TXV rows from catalog_parts.

Scope: only rows whose nearest_header_line looks like a genuine TXV table
(contains "thermostatic" or both "tons" and "equalizer") - the VALVES
section also contains solenoid valves, check valves, etc. with different
column sets, and we do not want those misclassified as TXVs.

IMPORTANT GAP, stated not hidden: refrigerant is NOT extracted - see
schema.sql comment on txv_specs. TXV/valve pages in this catalog also have
messier 2-column-layout artifacts than Motor/Compressor pages (confirmed
during inspection - some header lines carry trailing contamination from an
adjacent column of text). Validation is intentionally strict here.
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

TXV_HEADER_HINT_RE = re.compile(r"thermostatic|(?=.*\btons\b)(?=.*equalizer)", re.IGNORECASE)

FIELD_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bton", re.IGNORECASE), "tons_raw"),
    (re.compile(r"inlet", re.IGNORECASE), "inlet_raw"),
    (re.compile(r"outlet", re.IGNORECASE), "outlet_raw"),
    (re.compile(r"thermostatic|charge", re.IGNORECASE), "thermostatic_charge_raw"),
    (re.compile(r"equalizer", re.IGNORECASE), "equalizer_raw"),
]


def _valid(field: str, value: str) -> bool:
    v = value.strip()
    if not v:
        return False
    if field == "tons_raw":
        if len(v) > 8 or re.fullmatch(r"[0-9]+(\s[0-9]+/[0-9]+)?(/[0-9]+)?(\.[0-9]+)?", v) is None:
            return False
        return True  # wide legitimate range (1/5 ton to 20+ tons); shape check is enough
    if field in ("inlet_raw", "outlet_raw"):
        return len(v) <= 8 and re.fullmatch(r"[0-9]+(\s[0-9]+/[0-9]+)?(/[0-9]+)?", v) is not None
    if field == "thermostatic_charge_raw":
        return len(v) <= 8 and re.fullmatch(r"[A-Z0-9/]{1,8}", v) is not None
    if field == "equalizer_raw":
        return v.strip().lower() in ("internal", "external", "int", "int.", "ext", "ext.")
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
    inserted = skipped_not_txv = skipped_no_fields = total = 0
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as read_cur:
            read_cur.execute(
                """
                SELECT id, raw_part_number, normalized_part_number, columns,
                       nearest_header_line, section_title, pdf_page, catalog_page
                FROM catalog_parts
                WHERE category = 'Refrigeration & A/C Accessories' AND section_title = 'VALVES'
                """
            )
            rows = read_cur.fetchall()

        with conn.cursor() as write_cur:
            write_cur.execute("TRUNCATE txv_specs RESTART IDENTITY")
            insert_batch = []
            for row in rows:
                total += 1
                header_line = row["nearest_header_line"]
                if not header_line or not TXV_HEADER_HINT_RE.search(header_line):
                    skipped_not_txv += 1
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
                        mapped.get("tons_raw"),
                        mapped.get("inlet_raw"),
                        mapped.get("outlet_raw"),
                        mapped.get("thermostatic_charge_raw"),
                        mapped.get("equalizer_raw"),
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
                INSERT INTO txv_specs
                    (catalog_part_id, raw_part_number, normalized_part_number,
                     tons_raw, inlet_raw, outlet_raw, thermostatic_charge_raw,
                     equalizer_raw, section_title, pdf_page, catalog_page, header_line_used)
                VALUES %s
                """,
                insert_batch,
            )
        conn.commit()
    finally:
        conn.close()

    elapsed = time.perf_counter() - start
    print(f"VALVES rows seen: {total}")
    print(f"  -> inserted into txv_specs      : {inserted}")
    print(f"  -> skipped (not TXV-shaped header): {skipped_not_txv}")
    print(f"  -> skipped (no fields mapped)    : {skipped_no_fields}")
    print(f"Done in {elapsed:.2f}s")


if __name__ == "__main__":
    main()
