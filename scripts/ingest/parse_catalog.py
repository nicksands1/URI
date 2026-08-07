#!/usr/bin/env python3
"""
Parse the URI-515 catalog (pre-converted Markdown) into structured,
provenance-carrying records.

Input:  data/private/source/URI-515Catalog.md  (gitignored, not in this repo)
Output: data/private/derived/catalog_pages.jsonl   (one record per catalog page)
        data/private/derived/catalog_parts.jsonl   (one record per detected part-number row)
        data/private/derived/catalog_sections.json (top-level section index)

Design notes (see CLAUDE.md 20/13):
  - The raw source text is never rewritten, only sliced. Every output record
    carries source_document/page/section so a human can jump back to the
    original line.
  - Row detection is a conservative heuristic (see PART_TOKEN_RE below), not
    a real table parser. It is a *retrieval index*, not a verified spec
    database - column semantics differ per product table and are NOT
    inferred here. That is a deliberate, smaller first slice.
  - Never silently "fixes" a token (e.g. 0/O). raw_part_number is preserved
    verbatim; normalized_part_number is a derived, clearly-separate field.
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = REPO_ROOT / "data" / "private" / "source" / "URI-515Catalog.md"
DERIVED_DIR = REPO_ROOT / "data" / "private" / "derived"
SOURCE_DOCUMENT_ID = "URI-515Catalog"

PAGE_HEADER_RE = re.compile(
    r"^## PDF Page (?P<pdf_page>\d+)"
    r"(?: / Catalog Page (?P<catalog_page>\d+))?"
    r"(?: - (?P<title>.+))?$"
)
SECTION_INDEX_RE = re.compile(
    r"^- \[(?P<name>[^\]]+)\]\([^)]+\) - PDF (?P<pdf_start>\d+)-(?P<pdf_end>\d+)"
    r"(?:; Catalog (?P<cat_start>\d+)-(?P<cat_end>\d+))?"
)

# A row is treated as starting with a part number if:
#   - it begins (after leading whitespace) with a token of allowed chars,
#   - the token is immediately followed by a run of 2+ spaces (i.e. it's a
#     table cell, not a wrapped sentence),
#   - and it has at least one letter, OR is all-digit with length >= 5
#     (filters out stray numeric specs like "115" / "1550" that wrap onto
#     their own line).
PART_TOKEN_RE = re.compile(
    r"^(?P<part>[A-Za-z0-9][A-Za-z0-9\-\./]{2,23})"
    r"(?P<footnote>\*\d*)?"
    r"(?=[ \t]{2,})"
)
HEADER_LINE_HINT_RE = re.compile(r"part\s*no\.?", re.IGNORECASE)


@dataclass
class CatalogPage:
    source_document: str
    pdf_page: int
    catalog_page: int | None
    section_title: str | None
    category: str | None
    raw_text: str


@dataclass
class CatalogPartRow:
    source_document: str
    pdf_page: int
    catalog_page: int | None
    section_title: str | None
    category: str | None
    raw_part_number: str
    normalized_part_number: str
    normalized_no_separator: str
    raw_line: str
    columns: list[str]
    nearest_header_line: str | None
    extraction_method: str
    review_status: str


def normalize_part_number(raw: str) -> str:
    """Uppercase + trim + collapse whitespace. Does NOT touch separators
    or ambiguous characters (0/O, 1/I, etc.) - see CLAUDE.md 13."""
    s = raw.strip().upper()
    s = re.sub(r"\s+", " ", s)
    return s


def normalize_no_separator(normalized: str) -> str:
    """Search-only representation: strips common separators. Kept distinct
    from normalized_part_number; never used to overwrite it."""
    return re.sub(r"[\-\./\s]", "", normalized)


def parse_section_index(lines: list[str]) -> list[dict]:
    sections = []
    for line in lines:
        m = SECTION_INDEX_RE.match(line.strip())
        if not m:
            continue
        sections.append(
            {
                "name": m.group("name"),
                "pdf_page_start": int(m.group("pdf_start")),
                "pdf_page_end": int(m.group("pdf_end")),
                "catalog_page_start": int(m.group("cat_start")) if m.group("cat_start") else None,
                "catalog_page_end": int(m.group("cat_end")) if m.group("cat_end") else None,
            }
        )
    return sections


def category_for_pdf_page(sections: list[dict], pdf_page: int) -> str | None:
    for s in sections:
        if s["pdf_page_start"] <= pdf_page <= s["pdf_page_end"]:
            return s["name"]
    return None


def split_pages(text: str) -> list[tuple[int, int | None, str | None, str]]:
    """Split the raw file into (pdf_page, catalog_page, title, fenced_body) tuples."""
    lines = text.splitlines()
    pages: list[tuple[int, int | None, str | None, str]] = []

    current: dict | None = None
    in_fence = False
    body_lines: list[str] = []

    for line in lines:
        header_match = PAGE_HEADER_RE.match(line)
        if header_match and not in_fence:
            if current is not None:
                pages.append(
                    (current["pdf_page"], current["catalog_page"], current["title"], "\n".join(body_lines))
                )
            current = {
                "pdf_page": int(header_match.group("pdf_page")),
                "catalog_page": int(header_match.group("catalog_page")) if header_match.group("catalog_page") else None,
                "title": header_match.group("title"),
            }
            body_lines = []
            continue

        if line.strip() == "~~~~text":
            in_fence = True
            continue
        if line.strip() == "~~~~" and in_fence:
            in_fence = False
            continue
        if in_fence and current is not None:
            body_lines.append(line)

    if current is not None:
        pages.append((current["pdf_page"], current["catalog_page"], current["title"], "\n".join(body_lines)))

    return pages


def extract_part_rows(page: CatalogPage) -> list[CatalogPartRow]:
    rows: list[CatalogPartRow] = []
    lines = page.raw_text.splitlines()
    nearest_header: str | None = None

    for line in lines:
        header_match = HEADER_LINE_HINT_RE.search(line)
        # Only accept this as a header line if "Part No." is at (or very
        # near) the start of the line, not buried after unrelated prose.
        # 2-column PDF layouts occasionally glue a trailing sentence from
        # an adjacent column onto the same physical line as a real header
        # (e.g. "...heat pump units.          Part No.   Tons   Inlet..."),
        # which would otherwise be accepted as the header and silently
        # shift every downstream column mapping by one position - found via
        # real data during TXV ingestion (ERSE2C), not assumed.
        if header_match:
            leading_whitespace_len = len(line) - len(line.lstrip())
            position_in_stripped_line = header_match.start() - leading_whitespace_len
            if position_in_stripped_line <= 5:
                nearest_header = line.strip()

        stripped = line.lstrip()
        m = PART_TOKEN_RE.match(stripped)
        if not m:
            continue

        raw_part = m.group("part")
        has_digit = any(c.isdigit() for c in raw_part)
        is_long_digit = raw_part.isdigit() and len(raw_part) >= 5
        # Require a digit unconditionally - filters out plain-English words
        # (e.g. "Features", "construction") that happen to land in a
        # table-like column position. Pure-digit tokens must additionally
        # be long enough to not be a stray spec value (e.g. "115", "1550").
        if not has_digit:
            continue
        if raw_part.isdigit() and not is_long_digit:
            continue

        normalized = normalize_part_number(raw_part)
        columns = [c for c in re.split(r"[ \t]{2,}", stripped.strip()) if c != ""]

        rows.append(
            CatalogPartRow(
                source_document=page.source_document,
                pdf_page=page.pdf_page,
                catalog_page=page.catalog_page,
                section_title=page.section_title,
                category=page.category,
                raw_part_number=raw_part,
                normalized_part_number=normalized,
                normalized_no_separator=normalize_no_separator(normalized),
                raw_line=line.rstrip(),
                columns=columns,
                nearest_header_line=nearest_header,
                extraction_method="regex-fixed-width-row-v1",
                review_status="unreviewed",
            )
        )

    return rows


def main() -> None:
    if not SOURCE_PATH.exists():
        print(f"ERROR: source not found at {SOURCE_PATH}", file=sys.stderr)
        print("Place the converted catalog Markdown there first.", file=sys.stderr)
        sys.exit(1)

    text = SOURCE_PATH.read_text(encoding="utf-8")
    sections = parse_section_index(text.splitlines())

    DERIVED_DIR.mkdir(parents=True, exist_ok=True)
    (DERIVED_DIR / "catalog_sections.json").write_text(
        json.dumps(sections, indent=2), encoding="utf-8"
    )

    pages_out = DERIVED_DIR / "catalog_pages.jsonl"
    parts_out = DERIVED_DIR / "catalog_parts.jsonl"

    page_count = 0
    part_row_count = 0

    with pages_out.open("w", encoding="utf-8") as pf, parts_out.open("w", encoding="utf-8") as rf:
        for pdf_page, catalog_page, title, body in split_pages(text):
            category = category_for_pdf_page(sections, pdf_page)
            page = CatalogPage(
                source_document=SOURCE_DOCUMENT_ID,
                pdf_page=pdf_page,
                catalog_page=catalog_page,
                section_title=title,
                category=category,
                raw_text=body,
            )
            pf.write(json.dumps(asdict(page)) + "\n")
            page_count += 1

            for row in extract_part_rows(page):
                rf.write(json.dumps(asdict(row)) + "\n")
                part_row_count += 1

    print(f"Parsed {page_count} pages -> {pages_out}")
    print(f"Extracted {part_row_count} candidate part rows -> {parts_out}")
    print(f"Section index ({len(sections)} sections) -> {DERIVED_DIR / 'catalog_sections.json'}")


if __name__ == "__main__":
    main()
