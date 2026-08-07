import { getPool } from "@/lib/db";

// Mirrors scripts/search/search_catalog.py's ordering (CLAUDE.md 12):
// exact -> normalized (separator-insensitive) -> substring -> fuzzy, with
// deterministic hits short-circuiting before the fuzzy path ever runs.
// Every result is "listed in catalog" evidence only - never "verified",
// never a stock/availability claim (CLAUDE.md 22).

export type MatchType = "EXACT" | "NORMALIZED" | "SUBSTRING" | "FUZZY";

export interface CatalogSearchResult {
  matchType: MatchType;
  rawPartNumber: string;
  normalizedPartNumber: string;
  distributorStatus: "listed in catalog";
  sourceDocument: string;
  pdfPage: number;
  catalogPage: number | null;
  sectionTitle: string | null;
  category: string | null;
  rawLine: string;
  nearestHeaderLine: string | null;
}

export function normalizePartNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeNoSeparator(normalized: string): string {
  return normalized.replace(/[-./\s]/g, "");
}

interface CatalogPartRow {
  raw_part_number: string;
  normalized_part_number: string;
  source_document: string;
  pdf_page: number;
  catalog_page: number | null;
  section_title: string | null;
  category: string | null;
  raw_line: string;
  nearest_header_line: string | null;
}

function toResult(row: CatalogPartRow, matchType: MatchType): CatalogSearchResult {
  return {
    matchType,
    rawPartNumber: row.raw_part_number,
    normalizedPartNumber: row.normalized_part_number,
    distributorStatus: "listed in catalog",
    sourceDocument: row.source_document,
    pdfPage: row.pdf_page,
    catalogPage: row.catalog_page,
    sectionTitle: row.section_title,
    category: row.category,
    rawLine: row.raw_line,
    nearestHeaderLine: row.nearest_header_line,
  };
}

export async function searchCatalog(
  query: string,
  limit = 10
): Promise<{ results: CatalogSearchResult[]; elapsedMs: number }> {
  const start = performance.now();
  const pool = getPool();

  const normalized = normalizePartNumber(query);
  const noSep = normalizeNoSeparator(normalized);

  // 1 + 2. Exact / normalized in one indexed query.
  const exact = await pool.query<CatalogPartRow>(
    `SELECT raw_part_number, normalized_part_number, source_document, pdf_page,
            catalog_page, section_title, category, raw_line, nearest_header_line
     FROM catalog_parts
     WHERE normalized_part_number = $1 OR normalized_no_separator = $2
     LIMIT $3`,
    [normalized, noSep, limit]
  );

  if (exact.rows.length > 0) {
    const results = exact.rows.map((r) =>
      toResult(r, r.normalized_part_number === normalized ? "EXACT" : "NORMALIZED")
    );
    return { results: results.slice(0, limit), elapsedMs: performance.now() - start };
  }

  if (noSep.length < 4) {
    return { results: [], elapsedMs: performance.now() - start };
  }

  // 3. Substring (trigram-indexed).
  const substring = await pool.query<CatalogPartRow>(
    `SELECT raw_part_number, normalized_part_number, source_document, pdf_page,
            catalog_page, section_title, category, raw_line, nearest_header_line
     FROM catalog_parts
     WHERE normalized_no_separator ILIKE '%' || $1 || '%'
     LIMIT $2`,
    [noSep, limit]
  );
  if (substring.rows.length > 0) {
    return {
      results: substring.rows.map((r) => toResult(r, "SUBSTRING")),
      elapsedMs: performance.now() - start,
    };
  }

  // 4. Fuzzy (trigram similarity) - only reached when nothing deterministic matched.
  const fuzzy = await pool.query<CatalogPartRow>(
    `SELECT raw_part_number, normalized_part_number, source_document, pdf_page,
            catalog_page, section_title, category, raw_line, nearest_header_line
     FROM catalog_parts
     WHERE normalized_no_separator % $1
     ORDER BY similarity(normalized_no_separator, $1) DESC
     LIMIT $2`,
    [noSep, limit]
  );

  return {
    results: fuzzy.rows.map((r) => toResult(r, "FUZZY")),
    elapsedMs: performance.now() - start,
  };
}
