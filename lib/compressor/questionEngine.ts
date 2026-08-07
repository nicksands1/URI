import { COMPRESSOR_FIELDS, type CompressorKnownFacts } from "@/lib/domain/compressor";
import { queryTypedCandidates } from "@/lib/domain/questionEngine";

// Compressor-specific instantiation of the shared question engine.
// IMPORTANT: refrigerant/application are NOT modeled - see
// scripts/ingest/parse_compressor_specs.py and schema.sql. The API/UI
// layer is responsible for surfacing that gap prominently.
export function queryCompressorCandidates(knownFacts: CompressorKnownFacts, limit = 25) {
  return queryTypedCandidates({
    table: "compressor_specs",
    fields: COMPRESSOR_FIELDS,
    extraColumns: ["dim_h_raw", "dim_w_raw", "dim_l_raw", "weight_raw"],
    knownFacts,
    limit,
  });
}
