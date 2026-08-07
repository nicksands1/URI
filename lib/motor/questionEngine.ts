import { MOTOR_FIELDS, type MotorKnownFacts } from "@/lib/domain/motor";
import { queryTypedCandidates } from "@/lib/domain/questionEngine";

// Motor-specific instantiation of the shared question engine (see
// lib/domain/questionEngine.ts). Matching is exact string match against the
// raw printed catalog value - a known, stated limitation: "3/4" won't match
// "0.75" and "115" won't match "115V" unless typed exactly as printed.

export function queryMotorCandidates(knownFacts: MotorKnownFacts, limit = 25) {
  return queryTypedCandidates({
    table: "motor_specs",
    fields: MOTOR_FIELDS,
    extraColumns: ["amps_raw", "weight_raw"],
    knownFacts,
    limit,
  });
}
