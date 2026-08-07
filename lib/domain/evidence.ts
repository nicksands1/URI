// Shared vocabulary from CLAUDE.md 5, 8, 14. Keep these as the single
// source of truth for these enums - do not let UI code invent new labels.

export type EvidenceState = "CONFIRMED" | "REPORTED" | "INFERRED" | "MISSING";

export type ConstraintTier =
  | "HARD_CONSTRAINT"
  | "IMPORTANT"
  | "PREFERENCE"
  | "INFORMATIONAL";

export type MatchResult = "MATCH" | "MISMATCH" | "UNKNOWN" | "NOT_APPLICABLE";

// Deliberately narrower than a full "verified replacement" vocabulary
// (CLAUDE.md 8) because this flow is spec-driven candidate search, not
// cross-referencing a known original part - see docs/DECISIONS.md.
// "VERIFIED" in the strict CLAUDE.md sense (an OEM/manufacturer-documented
// replacement of a specific original part) is intentionally not reachable
// from this flow; every fact here comes from the user, not a nameplate.
export type CandidateStatus =
  | "MATCHES_ALL_KNOWN_FIELDS"
  | "POSSIBLE_INCOMPLETE"
  | "NOT_SUITABLE";

export interface SourceCitation {
  sourceDocument: string;
  pdfPage: number;
  catalogPage: number | null;
  sectionTitle: string | null;
}
