import { NextRequest, NextResponse } from "next/server";
import { queryCompressorCandidates } from "@/lib/compressor/questionEngine";
import type { CompressorKnownFacts } from "@/lib/domain/compressor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { knownFacts?: CompressorKnownFacts };
  const knownFacts = body.knownFacts ?? {};

  const result = await queryCompressorCandidates(knownFacts);

  return NextResponse.json({
    ...result,
    elapsedMs: Math.round(result.elapsedMs * 100) / 100,
  });
}
