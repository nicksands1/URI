import { TXV_FIELDS, type TxvKnownFacts } from "@/lib/domain/txv";
import { queryTypedCandidates } from "@/lib/domain/questionEngine";

// TXV-specific instantiation of the shared question engine.
// IMPORTANT: refrigerant is NOT modeled - see scripts/ingest/parse_txv_specs.py
// and schema.sql. The API/UI layer is responsible for surfacing that gap
// prominently; this is the single most important TXV selection driver per
// CLAUDE.md's TXV section.
export function queryTxvCandidates(knownFacts: TxvKnownFacts, limit = 25) {
  return queryTypedCandidates({
    table: "txv_specs",
    fields: TXV_FIELDS,
    knownFacts,
    limit,
  });
}
