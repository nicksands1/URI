#!/usr/bin/env python3
"""
Exact / normalized / fuzzy part-number search over the parsed URI-515
catalog, per the search order in CLAUDE.md 12 (deterministic before fuzzy;
no semantic/AI step here at all - this script is pure retrieval).

Every result carries source provenance (document, PDF page, catalog page,
section, the raw catalog line) so a human decides, per CLAUDE.md 9/10.
This script never claims a "verified replacement" - a hit only means the
part number is LISTED IN THE CATALOG (CLAUDE.md 22: IN_URI_CATALOG=true),
nothing about stock, and nothing about compatibility with any other part.

Usage:
    python3 scripts/search/search_catalog.py "U0150AB"
    python3 scripts/search/search_catalog.py "u0150ab" --json
    python3 scripts/search/search_catalog.py "AJB7465AXD" --limit 5
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PARTS_PATH = REPO_ROOT / "data" / "private" / "derived" / "catalog_parts.jsonl"

# Keep in sync with scripts/ingest/parse_catalog.py normalization rules.
def normalize_part_number(raw: str) -> str:
    s = raw.strip().upper()
    s = re.sub(r"\s+", " ", s)
    return s


def normalize_no_separator(normalized: str) -> str:
    return re.sub(r"[\-\./\s]", "", normalized)


@dataclass
class SearchResult:
    match_type: str  # EXACT | NORMALIZED | SUBSTRING | FUZZY
    raw_part_number: str
    normalized_part_number: str
    distributor_status: str
    source_document: str
    pdf_page: int
    catalog_page: int | None
    section_title: str | None
    category: str | None
    raw_line: str
    nearest_header_line: str | None


class CatalogIndex:
    def __init__(self, rows: list[dict]):
        self.rows = rows
        self.by_normalized: dict[str, list[dict]] = defaultdict(list)
        self.by_no_separator: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            self.by_normalized[r["normalized_part_number"]].append(r)
            self.by_no_separator[r["normalized_no_separator"]].append(r)

    @classmethod
    def load(cls, path: Path = PARTS_PATH) -> "CatalogIndex":
        if not path.exists():
            print(
                f"ERROR: {path} not found. Run scripts/ingest/parse_catalog.py first.",
                file=sys.stderr,
            )
            sys.exit(1)
        rows = [json.loads(line) for line in path.open(encoding="utf-8")]
        return cls(rows)

    def _to_result(self, row: dict, match_type: str) -> SearchResult:
        return SearchResult(
            match_type=match_type,
            raw_part_number=row["raw_part_number"],
            normalized_part_number=row["normalized_part_number"],
            distributor_status="listed in catalog",
            source_document=row["source_document"],
            pdf_page=row["pdf_page"],
            catalog_page=row["catalog_page"],
            section_title=row["section_title"],
            category=row["category"],
            raw_line=row["raw_line"],
            nearest_header_line=row["nearest_header_line"],
        )

    def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        normalized_query = normalize_part_number(query)
        no_sep_query = normalize_no_separator(normalized_query)

        results: list[SearchResult] = []
        seen_row_ids: set[int] = set()

        def add(rows: list[dict], match_type: str):
            for row in rows:
                rid = id(row)
                if rid in seen_row_ids:
                    continue
                seen_row_ids.add(rid)
                results.append(self._to_result(row, match_type))

        # 1. Exact (raw normalization only - case/whitespace insensitive)
        add(self.by_normalized.get(normalized_query, []), "EXACT")

        # 2. Normalized (separator-insensitive: e.g. "U-0150-AB" -> "U0150AB")
        add(self.by_no_separator.get(no_sep_query, []), "NORMALIZED")

        # A deterministic (exact/normalized) hit is a fast, confident path -
        # per CLAUDE.md 12 stop here rather than burying it under fuzzy
        # "did you mean" noise for the common case of a counterperson typing
        # a number they already have correctly.
        if results:
            return results[:limit]

        # 3. Substring (customer gave a partial number)
        if len(no_sep_query) >= 4:
            for key, rows in self.by_no_separator.items():
                if no_sep_query in key and key != no_sep_query:
                    add(rows, "SUBSTRING")
                if len(results) >= limit * 3:
                    break

        # 4. Fuzzy (typo / possible 0-O, 1-I style confusion) - only reached
        # when nothing deterministic matched. Never silently rewrites the
        # query; each fuzzy hit shows its own distinct part number for the
        # human to compare against what the customer actually said.
        if len(results) < limit and len(no_sep_query) >= 4:
            import difflib

            close = difflib.get_close_matches(
                no_sep_query, self.by_no_separator.keys(), n=limit, cutoff=0.72
            )
            for key in close:
                add(self.by_no_separator[key], "FUZZY")

        return results[:limit]


def format_text(query: str, results: list[SearchResult], elapsed_ms: float) -> str:
    if not results:
        return (
            f'No catalog matches for "{query}".\n'
            f"(Not found != doesn't exist - only means not located in the ingested "
            f"catalog text. See CLAUDE.md 10: do not treat this as proof the part "
            f"doesn't exist.)\n"
            f"[{elapsed_ms:.0f}ms]"
        )

    lines = [f'Query: "{query}"  ({len(results)} result(s), {elapsed_ms:.0f}ms)', ""]
    for i, r in enumerate(results, 1):
        page_cite = f"PDF p.{r.pdf_page}"
        if r.catalog_page:
            page_cite += f" / Catalog p.{r.catalog_page}"
        lines.append(f"{i}. [{r.match_type}] {r.raw_part_number}")
        lines.append(f"   Distributor status : {r.distributor_status}")
        lines.append(f"   Section            : {r.section_title or '(none)'}  [{r.category or 'uncategorized'}]")
        lines.append(f"   Evidence           : {r.source_document} - {page_cite}")
        lines.append(f"   Raw catalog line   : {r.raw_line.strip()}")
        if r.nearest_header_line:
            lines.append(f"   Column header      : {r.nearest_header_line.strip()}")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="Search the URI-515 catalog index")
    ap.add_argument("query", help="Part number or partial part number")
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--json", action="store_true", help="Output JSON instead of text")
    args = ap.parse_args()

    index = CatalogIndex.load()

    start = time.perf_counter()
    results = index.search(args.query, limit=args.limit)
    elapsed_ms = (time.perf_counter() - start) * 1000

    if args.json:
        print(json.dumps([r.__dict__ for r in results], indent=2))
    else:
        print(format_text(args.query, results, elapsed_ms))


if __name__ == "__main__":
    main()
