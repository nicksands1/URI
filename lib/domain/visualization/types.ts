// Shared types for the 3D equipment visualization feature.
//
// This feature introduces a medium (3D geometry + animation) that CLAUDE.md
// §9's evidence model wasn't originally written for. `CitedValue` is the
// bridge: every catalog-sourced number in a spec panel carries its own
// evidence state and citation, exactly like a search/candidate result does
// elsewhere in this app. Geometry itself has no evidence state - see
// docs/DECISIONS.md D-034/D-037 - it's simply labeled generic/schematic in
// the UI and never wrapped in a CitedValue.

import type { EvidenceState } from "@/lib/domain/evidence";

export interface SourceCitation {
  sourceDocument: string;
  /** PDF page within that source document. */
  pdfPage: number;
  /** Printed catalog page, when it differs from / is clearer than pdfPage. */
  catalogPage: number | null;
  sectionTitle: string;
  /**
   * "ROW" = read directly off this exact model's table row.
   * "FAMILY" = printed on the same page but scoped to the whole product
   * line/table, not confirmed to apply to this specific SKU (e.g. a
   * refrigerant list or a lettered-suffix feature bullet whose suffix
   * mapping isn't decoded from what's in evidence). Never silently
   * promoted to ROW - see CLAUDE.md §18.
   */
  scope: "ROW" | "FAMILY";
}

export interface CitedValue<T> {
  value: T;
  evidence: EvidenceState;
  citation: SourceCitation;
}

export function cited<T>(
  value: T,
  citation: SourceCitation,
  evidence: EvidenceState = "CONFIRMED"
): CitedValue<T> {
  return { value, evidence, citation };
}

/** A value that has no catalog source - industry-standard/generic fallback,
 * permitted per the user's own instruction but must stay visually distinct
 * from CitedValue in every panel that renders it. */
export interface GenericValue<T> {
  value: T;
  note: string;
}

export function generic<T>(value: T, note: string): GenericValue<T> {
  return { value, note };
}
