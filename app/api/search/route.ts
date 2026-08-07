import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/search/catalogSearch";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");

  if (!q) {
    return NextResponse.json({ error: "missing query param 'q'" }, { status: 400 });
  }

  const { results, elapsedMs } = await searchCatalog(q, limit);

  return NextResponse.json({
    query: q,
    elapsedMs: Math.round(elapsedMs * 100) / 100,
    count: results.length,
    results,
  });
}
