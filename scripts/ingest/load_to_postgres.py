#!/usr/bin/env python3
"""
Bulk-load the parsed catalog JSONL (scripts/ingest/parse_catalog.py output)
into Postgres. Idempotent: truncates and reloads catalog_pages/catalog_parts
each run so re-ingesting a re-converted catalog is safe.

Env vars: DATABASE_URL (Supabase/Vercel-style connection string), or
discrete CI_DB_HOST/PORT/NAME/USER/PASSWORD for local dev. See db.py.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import psycopg2.extras

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_conn  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED_DIR = REPO_ROOT / "data" / "private" / "derived"


def load_pages(cur, path: Path) -> int:
    rows = [json.loads(line) for line in path.open(encoding="utf-8")]
    cur.execute("TRUNCATE catalog_pages RESTART IDENTITY CASCADE")
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO catalog_pages
            (source_document, pdf_page, catalog_page, section_title, category, raw_text)
        VALUES %s
        """,
        [
            (
                r["source_document"],
                r["pdf_page"],
                r["catalog_page"],
                r["section_title"],
                r["category"],
                r["raw_text"],
            )
            for r in rows
        ],
    )
    return len(rows)


def load_parts(cur, path: Path) -> int:
    rows = [json.loads(line) for line in path.open(encoding="utf-8")]
    cur.execute("TRUNCATE catalog_parts RESTART IDENTITY CASCADE")
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO catalog_parts
            (source_document, pdf_page, catalog_page, section_title, category,
             raw_part_number, normalized_part_number, normalized_no_separator,
             raw_line, columns, nearest_header_line, extraction_method, review_status)
        VALUES %s
        """,
        [
            (
                r["source_document"],
                r["pdf_page"],
                r["catalog_page"],
                r["section_title"],
                r["category"],
                r["raw_part_number"],
                r["normalized_part_number"],
                r["normalized_no_separator"],
                r["raw_line"],
                json.dumps(r["columns"]),
                r["nearest_header_line"],
                r["extraction_method"],
                r["review_status"],
            )
            for r in rows
        ],
        template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)",
    )
    return len(rows)


def main() -> None:
    pages_path = DERIVED_DIR / "catalog_pages.jsonl"
    parts_path = DERIVED_DIR / "catalog_parts.jsonl"
    for p in (pages_path, parts_path):
        if not p.exists():
            print(f"ERROR: {p} not found. Run parse_catalog.py first.", file=sys.stderr)
            sys.exit(1)

    start = time.perf_counter()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            n_pages = load_pages(cur, pages_path)
            n_parts = load_parts(cur, parts_path)
        conn.commit()
    finally:
        conn.close()
    elapsed = time.perf_counter() - start

    print(f"Loaded {n_pages} pages, {n_parts} part rows in {elapsed:.2f}s")


if __name__ == "__main__":
    main()
