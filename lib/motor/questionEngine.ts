import { getPool } from "@/lib/db";
import {
  MOTOR_FIELDS,
  type MotorCandidateRow,
  type MotorFieldKey,
  type MotorKnownFacts,
} from "@/lib/domain/motor";
import type { CandidateStatus } from "@/lib/domain/evidence";

// The dynamic question engine (CLAUDE.md 15): given whatever is already
// known, find which still-unknown field would eliminate the most current
// candidates if asked - not a fixed twenty-field questionnaire. Priority
// tier (safety/compatibility first) beats raw information gain; within a
// tier, more distinct values among current candidates = more discriminating
// = asked first.
//
// Matching is exact string match against the raw printed catalog value.
// This is a known, stated limitation (not a silent one): "3/4" won't match
// "0.75" and "115" won't match "115V" unless typed exactly as printed. Unit
// normalization is future work, not something quietly guessed at here.

export interface MotorCandidate {
  rawPartNumber: string;
  normalizedPartNumber: string;
  status: CandidateStatus;
  fields: Record<MotorFieldKey, string | null>;
  ampsRaw: string | null;
  weightRaw: string | null;
  sectionTitle: string | null;
  pdfPage: number;
  catalogPage: number | null;
}

export interface NextQuestion {
  field: MotorFieldKey;
  label: string;
  tier: string;
  distinctValueCount: number;
  sampleValues: string[];
  why: string;
}

export interface MotorQueryResult {
  knownFacts: MotorKnownFacts;
  candidateCount: number;
  candidates: MotorCandidate[];
  nextQuestion: NextQuestion | null;
  elapsedMs: number;
}

function candidateStatus(fields: Record<MotorFieldKey, string | null>): CandidateStatus {
  const criticalUnknown = MOTOR_FIELDS.filter(
    (f) => f.tier === "HARD_CONSTRAINT" || f.tier === "IMPORTANT"
  ).some((f) => fields[f.key] === null);
  return criticalUnknown ? "POSSIBLE_INCOMPLETE" : "MATCHES_ALL_KNOWN_FIELDS";
}

export async function queryMotorCandidates(
  knownFacts: MotorKnownFacts,
  limit = 25
): Promise<MotorQueryResult> {
  const start = performance.now();
  const pool = getPool();

  const whereClauses: string[] = [];
  const params: string[] = [];
  for (const field of MOTOR_FIELDS) {
    const value = knownFacts[field.key];
    if (value && value.trim() !== "") {
      params.push(value.trim());
      whereClauses.push(`${field.key} = $${params.length}`);
    }
  }
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const { rows } = await pool.query<MotorCandidateRow>(
    `SELECT raw_part_number, normalized_part_number, hp_or_watts_raw, voltage_raw,
            rpm_raw, amps_raw, rotation_raw, num_speeds_raw, shaft_dia_raw,
            shaft_length_raw, capacitor_raw, weight_raw, section_title, pdf_page, catalog_page
     FROM motor_specs
     ${whereSql}
     LIMIT 2000`,
    params
  );

  const candidates: MotorCandidate[] = rows.slice(0, limit).map((r) => {
    const fields: Record<MotorFieldKey, string | null> = {
      voltage_raw: r.voltage_raw,
      rotation_raw: r.rotation_raw,
      shaft_dia_raw: r.shaft_dia_raw,
      hp_or_watts_raw: r.hp_or_watts_raw,
      rpm_raw: r.rpm_raw,
      capacitor_raw: r.capacitor_raw,
      num_speeds_raw: r.num_speeds_raw,
      shaft_length_raw: r.shaft_length_raw,
    };
    return {
      rawPartNumber: r.raw_part_number,
      normalizedPartNumber: r.normalized_part_number,
      status: candidateStatus(fields),
      fields,
      ampsRaw: r.amps_raw,
      weightRaw: r.weight_raw,
      sectionTitle: r.section_title,
      pdfPage: r.pdf_page,
      catalogPage: r.catalog_page,
    };
  });

  // Next question: rank unset fields by tier, then by how many distinct
  // non-null values they still take across ALL matching rows (not just the
  // page of candidates we return) - that's the actual information gain.
  const tierRank: Record<string, number> = {
    HARD_CONSTRAINT: 0,
    IMPORTANT: 1,
    PREFERENCE: 2,
    INFORMATIONAL: 3,
  };

  let nextQuestion: NextQuestion | null = null;
  if (rows.length > 1) {
    let best: NextQuestion | null = null;
    for (const field of MOTOR_FIELDS) {
      if (knownFacts[field.key]) continue; // already known
      const values = new Set(
        rows.map((r) => r[field.key]).filter((v): v is string => v !== null)
      );
      if (values.size < 2) continue; // no discriminating power
      const candidate: NextQuestion = {
        field: field.key,
        label: field.label,
        tier: field.tier,
        distinctValueCount: values.size,
        sampleValues: Array.from(values).slice(0, 6),
        why: `${values.size} distinct values among ${rows.length} remaining candidates`,
      };
      if (
        !best ||
        tierRank[candidate.tier]! < tierRank[best.tier]! ||
        (tierRank[candidate.tier] === tierRank[best.tier] &&
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
