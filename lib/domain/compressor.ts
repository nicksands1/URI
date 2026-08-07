import type { ConstraintTier } from "@/lib/domain/evidence";

// Compressor selection drivers, scoped to what compressor_specs actually
// captures (see scripts/ingest/parse_compressor_specs.py). CLAUDE.md 7 lists
// more (refrigerant, application/temp envelope, oil, OEM configuration,
// connection style, motor/start config) that this catalog's tables do NOT
// expose as columns - refrigerant/application in particular are prose tied
// to a model family, not a per-row cell, and are deliberately NOT modeled
// (see schema.sql). The UI surfaces this as a mandatory manual-check
// warning, not a silently missing field.
export const COMPRESSOR_FIELDS: {
  key: CompressorFieldKey;
  label: string;
  tier: ConstraintTier;
}[] = [
  { key: "voltage_raw", label: "Voltage", tier: "HARD_CONSTRAINT" },
  { key: "phase_raw", label: "Phase", tier: "HARD_CONSTRAINT" },
  { key: "capacity_btuh_raw", label: "Capacity (BTUH)", tier: "IMPORTANT" },
  { key: "hp_raw", label: "HP", tier: "IMPORTANT" },
  { key: "suction_raw", label: "Suction connection", tier: "IMPORTANT" },
  { key: "discharge_raw", label: "Discharge connection", tier: "IMPORTANT" },
  { key: "rla_raw", label: "RLA", tier: "PREFERENCE" },
  { key: "mount_raw", label: "Mount", tier: "PREFERENCE" },
];

export type CompressorFieldKey =
  | "voltage_raw"
  | "phase_raw"
  | "capacity_btuh_raw"
  | "hp_raw"
  | "suction_raw"
  | "discharge_raw"
  | "rla_raw"
  | "mount_raw";

export type CompressorKnownFacts = Partial<Record<CompressorFieldKey, string>>;

export interface CompressorCandidateRow {
  raw_part_number: string;
  normalized_part_number: string;
  capacity_btuh_raw: string | null;
  hp_raw: string | null;
  voltage_raw: string | null;
  phase_raw: string | null;
  rla_raw: string | null;
  mount_raw: string | null;
  dim_h_raw: string | null;
  dim_w_raw: string | null;
  dim_l_raw: string | null;
  suction_raw: string | null;
  discharge_raw: string | null;
  weight_raw: string | null;
  section_title: string | null; // manufacturer
  pdf_page: number;
  catalog_page: number | null;
}
