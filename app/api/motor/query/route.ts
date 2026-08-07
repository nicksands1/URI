import { NextRequest, NextResponse } from "next/server";
import { queryMotorCandidates } from "@/lib/motor/questionEngine";
import type { MotorKnownFacts } from "@/lib/domain/motor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { knownFacts?: MotorKnownFacts };
  const knownFacts = body.knownFacts ?? {};

  const result = await queryMotorCandidates(knownFacts);

  return NextResponse.json({
    ...result,
    elapsedMs: Math.round(result.elapsedMs * 100) / 100,
  });
}
