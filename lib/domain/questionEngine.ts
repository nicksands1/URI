import { getPool } from "@/lib/db";
import type { CandidateStatus, ConstraintTier } from "@/lib/domain/evidence";

// Generic engine shared by Motor/Compressor/TXV (CLAUDE.md 15's dynamic
// question engine + CLAUDE.md 40's "avoid duplicated domain logic"). Each
// category supplies its own field list, table name, and tier assignments;
// the ranking/filtering mechanics themselves are identical across
// categories, so they live here once.

export interface FieldDef<K extends string> {
  key: K;
  label: string;
  tier: ConstraintTier;
}

export interface NextQuestion<K extends string> {
  field: K;
  label: string;
  tier: ConstraintTier;
  distinctValueCount: number;
  sampleValues: string[];
  why: string;
}

export interface GenericCandidate<K extends string> {
  rawPartNumber: string;
  normalizedPartNumber: string;
  status: CandidateStatus;
  fields: Record<K, string | null>;
  extra: Record<string, string | null>;
  sectionTitle: string | null;
  pdfPage: number;
  catalogPage: number | null;
}

export interface GenericQueryResult<K extends string> {
  knownFacts: Partial<Record<K, string>>;
  candidateCount: number;
  candidates: GenericCandidate<K>[];
  nextQuestion: NextQuestion<K> | null;
  elapsedMs: number;
}

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function assertSafeIdentifier(name: string): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
}

const TIER_RANK: Record<ConstraintTier, number> = {
  HARD_CONSTRAINT: 0,
  IMPORTANT: 1,
  PREFERENCE: 2,
  INFORMATIONAL: 3,
};

function candidateStatus<K extends string>(
  fields: FieldDef<K>[],
  values: Record<K, string | null>
): CandidateStatus {
  const criticalUnknown = fields
    .filter((f) => f.tier === "HARD_CONSTRAINT" || f.tier === "IMPORTANT")
    .some((f) => values[f.key] === null);
  return criticalUnknown ? "POSSIBLE_INCOMPLETE" : "MATCHES_ALL_KNOWN_FIELDS";
}

export async function queryTypedCandidates<K extends string>(opts: {
  table: string;
  fields: FieldDef<K>[];
  extraColumns?: string[]; // additional columns selected for display only, not filterable
  knownFacts: Partial<Record<K, string>>;
  limit?: number;
}): Promise<GenericQueryResult<K>> {
  const { table, fields, extraColumns = [], knownFacts, limit = 25 } = opts;

  assertSafeIdentifier(table);
  for (const f of fields) assertSafeIdentifier(f.key);
  for (const c of extraColumns) assertSafeIdentifier(c);

  const start = performance.now();
  const pool = getPool();

  const whereClauses: string[] = [];
  const params: string[] = [];
  for (const field of fields) {
    const value = knownFacts[field.key];
    if (value && value.trim() !== "") {
      params.push(value.trim());
      whereClauses.push(`${field.key} = $${params.length}`);
    }
  }
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const selectCols = [
    "raw_part_number",
    "normalized_part_number",
    ...fields.map((f) => f.key),
    ...extraColumns,
    "section_title",
    "pdf_page",
    "catalog_page",
  ].join(", ");

  const { rows } = await pool.query(
    `SELECT ${selectCols} FROM ${table} ${whereSql} LIMIT 2000`,
    params
  );

  const candidates: GenericCandidate<K>[] = rows.slice(0, limit).map((r) => {
    const values = {} as Record<K, string | null>;
    for (const f of fields) values[f.key] = r[f.key] ?? null;
    const extra: Record<string, string | null> = {};
    for (const c of extraColumns) extra[c] = r[c] ?? null;
    return {
      rawPartNumber: r.raw_part_number,
      normalizedPartNumber: r.normalized_part_number,
      status: candidateStatus(fields, values),
      fields: values,
      extra,
      sectionTitle: r.section_title,
      pdfPage: r.pdf_page,
      catalogPage: r.catalog_page,
    };
  });

  let nextQuestion: NextQuestion<K> | null = null;
  if (rows.length > 1) {
    let best: NextQuestion<K> | null = null;
    for (const field of fields) {
      if (knownFacts[field.key]) continue;
      const values = new Set(
        rows.map((r) => r[field.key]).filter((v: unknown): v is string => v !== null)
      );
      if (values.size < 2) continue;
      const candidate: NextQuestion<K> = {
        field: field.key,
        label: field.label,
        tier: field.tier,
        distinctValueCount: values.size,
        sampleValues: Array.from(values).slice(0, 6),
        why: `${values.size} distinct values among ${rows.length} remaining candidates`,
      };
      if (
        !best ||
        TIER_RANK[candidate.tier] < TIER_RANK[best.tier] ||
        (TIER_RANK[candidate.tier] === TIER_RANK[best.tier] &&
          candidate.distinctValueCount > best.distinctValueCount)
      ) {
        best = candidate;
      }
    }
    nextQuestion = best;
  }

  return {
    knownFacts,
    candidateCount: rows.length,
    candidates,
    nextQuestion,
    elapsedMs: performance.now() - start,
  };
}
