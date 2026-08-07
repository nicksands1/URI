import type { ConstraintTier } from "@/lib/domain/evidence";

// TXV selection drivers, scoped to what txv_specs actually captures (see
// scripts/ingest/parse_txv_specs.py). CLAUDE.md 7 lists more (refrigerant,
// evaporator temperature, MOP, nozzle, bi-flow/check-valve requirement,
// distributor relationship, body/power-element/cartridge distinction) that
// this catalog's tables don't expose as columns.
//
// REFRIGERANT IS NOT MODELED - it is the #1 selection driver per CLAUDE.md's
// own TXV section and getting it wrong is dangerous. It is prose tied to a
// model series here, not a per-row cell (see schema.sql). This is enforced
// as a mandatory UI warning, not a silently missing field.
export const TXV_FIELDS: { key: TxvFieldKey; label: string; tier: ConstraintTier }[] = [
  { key: "inlet_raw", label: "Inlet connection", tier: "HARD_CONSTRAINT" },
  { key: "outlet_raw", label: "Outlet connection", tier: "HARD_CONSTRAINT" },
  { key: "equalizer_raw", label: "Equalizer (internal/external)", tier: "HARD_CONSTRAINT" },
  { key: "tons_raw", label: "Capacity (tons)", tier: "IMPORTANT" },
  { key: "thermostatic_charge_raw", label: "Thermostatic charge", tier: "PREFERENCE" },
];

export type TxvFieldKey =
  | "inlet_raw"
  | "outlet_raw"
  | "equalizer_raw"
  | "tons_raw"
  | "thermostatic_charge_raw";

export type TxvKnownFacts = Partial<Record<TxvFieldKey, string>>;

export interface TxvCandidateRow {
  raw_part_number: string;
  normalized_part_number: string;
  tons_raw: string | null;
  inlet_raw: string | null;
  outlet_raw: string | null;
  thermostatic_charge_raw: string | null;
  equalizer_raw: string | null;
  section_title: string | null;
  pdf_page: number;
  catalog_page: number | null;
}
