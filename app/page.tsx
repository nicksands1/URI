"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogSearchResult } from "@/lib/search/catalogSearch";

interface SearchResponse {
  query: string;
  elapsedMs: number;
  count: number;
  results: CatalogSearchResult[];
}

const card: React.CSSProperties = {
  border: "1px solid #263041",
  borderRadius: 8,
  padding: "12px 16px",
  marginBottom: 10,
  background: "#111823",
};

const matchTypeColor: Record<string, string> = {
  EXACT: "#3fb950",
  NORMALIZED: "#58a6ff",
  SUBSTRING: "#d29922",
  FUZZY: "#f0883e",
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as SearchResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Counter Intelligence</h1>
      <p style={{ color: "#8b96a5", marginTop: 0, marginBottom: 20 }}>
        Type a part number.{" "}
        <Link href="/motor" style={{ color: "#58a6ff" }}>
          Or start a guided Motor search →
        </Link>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. U0150AB"
          style={{
            width: "100%",
            fontSize: 18,
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid #2a3546",
            background: "#0e141b",
            color: "#e6e9ee",
            boxSizing: "border-box",
          }}
        />
      </form>

      {loading && <p style={{ color: "#8b96a5" }}>Searching…</p>}

      {data && !loading && (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: "#8b96a5", fontSize: 13 }}>
            {data.count} result(s) for &quot;{data.query}&quot; — {data.elapsedMs}ms
          </p>

          {data.count === 0 && (
            <p style={{ color: "#f0883e" }}>
              Not found in ingested catalog text. This does not mean the part
              doesn&apos;t exist — only that it wasn&apos;t located here.
            </p>
          )}

          {data.results.map((r, i) => (
            <div key={i} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 16 }}>{r.rawPartNumber}</strong>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: matchTypeColor[r.matchType] ?? "#8b96a5",
                  }}
                >
                  {r.matchType}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#8b96a5", margin: "4px 0" }}>
                {r.distributorStatus} · {r.sectionTitle ?? "—"}{" "}
                {r.category ? `[${r.category}]` : ""}
              </div>
              <div style={{ fontSize: 13, color: "#c9d1d9", marginBottom: 4 }}>
                Evidence: {r.sourceDocument} — PDF p.{r.pdfPage}
                {r.catalogPage ? ` / Catalog p.${r.catalogPage}` : ""}
              </div>
              <pre
                style={{
                  fontSize: 12,
                  overflowX: "auto",
                  margin: 0,
                  color: "#8b96a5",
                  whiteSpace: "pre",
                }}
              >
                {r.rawLine.trim()}
              </pre>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
