import { NextRequest, NextResponse } from "next/server";
import { queryTxvCandidates } from "@/lib/txv/questionEngine";
import type { TxvKnownFacts } from "@/lib/domain/txv";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { knownFacts?: TxvKnownFacts };
  const knownFacts = body.knownFacts ?? {};

  const result = await queryTxvCandidates(knownFacts);

  return NextResponse.json({
    ...result,
    elapsedMs: Math.round(result.elapsedMs * 100) / 100,
  });
}
