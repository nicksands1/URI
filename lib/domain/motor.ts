import type { ConstraintTier } from "@/lib/domain/evidence";

// Motor selection drivers, scoped to what motor_specs actually captures
// (see scripts/ingest/parse_motor_specs.py). CLAUDE.md 7 lists more
// (phase, frequency, mounting/frame, enclosure) that this catalog's tables
// don't reliably expose as separate columns - that's a known limitation,
// not silently ignored. Tier assignments are a first-pass judgment call,
// not sourced from a manufacturer document - revisit if real counter use
// disagrees with them.
export const MOTOR_FIELDS: {
  key: MotorFieldKey;
  label: string;
  tier: ConstraintTier;
}[] = [
  { key: "voltage_raw", label: "Voltage", tier: "HARD_CONSTRAINT" },
  { key: "rotation_raw", label: "Rotation", tier: "HARD_CONSTRAINT" },
  { key: "shaft_dia_raw", label: "Shaft diameter", tier: "IMPORTANT" },
  { key: "hp_or_watts_raw", label: "HP / Watts", tier: "IMPORTANT" },
  { key: "rpm_raw", label: "RPM", tier: "IMPORTANT" },
  { key: "capacitor_raw", label: "Capacitor", tier: "PREFERENCE" },
  { key: "num_speeds_raw", label: "Number of speeds", tier: "PREFERENCE" },
  { key: "shaft_length_raw", label: "Shaft length", tier: "PREFERENCE" },
];

export type MotorFieldKey =
  | "voltage_raw"
  | "rotation_raw"
  | "shaft_dia_raw"
  | "hp_or_watts_raw"
  | "rpm_raw"
  | "capacitor_raw"
  | "num_speeds_raw"
  | "shaft_length_raw";

export type MotorKnownFacts = Partial<Record<MotorFieldKey, string>>;

export interface MotorCandidateRow {
  raw_part_number: string;
  normalized_part_number: string;
  hp_or_watts_raw: string | null;
  voltage_raw: string | null;
  rpm_raw: string | null;
  amps_raw: string | null;
  rotation_raw: string | null;
  num_speeds_raw: string | null;
  shaft_dia_raw: string | null;
  shaft_length_raw: string | null;
  capacitor_raw: string | null;
  weight_raw: string | null;
  section_title: string | null;
  pdf_page: number;
  catalog_page: number | null;
}
