"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface GuidedFieldDef {
  key: string;
  label: string;
  tier: string;
}

interface Candidate {
  rawPartNumber: string;
  normalizedPartNumber: string;
  status: "MATCHES_ALL_KNOWN_FIELDS" | "POSSIBLE_INCOMPLETE" | "NOT_SUITABLE";
  fields: Record<string, string | null>;
  extra: Record<string, string | null>;
  sectionTitle: string | null;
  pdfPage: number;
  catalogPage: number | null;
}

interface NextQuestion {
  field: string;
  label: string;
  tier: string;
  distinctValueCount: number;
  sampleValues: string[];
  why: string;
}

interface QueryResponse {
  knownFacts: Record<string, string>;
  candidateCount: number;
  candidates: Candidate[];
  nextQuestion: NextQuestion | null;
  elapsedMs: number;
}

const statusColor: Record<string, string> = {
  MATCHES_ALL_KNOWN_FIELDS: "#3fb950",
  POSSIBLE_INCOMPLETE: "#d29922",
  NOT_SUITABLE: "#f85149",
};

export function GuidedSearchPage(props: {
  title: string;
  description: string;
  apiPath: string;
  fields: GuidedFieldDef[];
  /** extra display-only column key -> label, e.g. { amps_raw: "Amps" } */
  extraLabels?: Record<string, string>;
  /** A prominent, non-dismissable caveat shown above results (e.g. refrigerant not modeled) */
  warningBanner?: string;
}) {
  const { title, description, apiPath, fields, extraLabels = {}, warningBanner } = props;

  const [knownFacts, setKnownFacts] = useState<Record<string, string>>({});
  const [data, setData] = useState<QueryResponse | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [loading, setLoading] = useState(false);

  const fieldLabel = (key: string) => fields.find((f) => f.key === key)?.label ?? key;

  async function runQuery(facts: Record<string, string>) {
    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knownFacts: facts }),
      });
      const json = (await res.json()) as QueryResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runQuery({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  function setField(key: string, value: string) {
    const next = { ...knownFacts, [key]: value };
    setKnownFacts(next);
    setManualValue("");
    runQuery(next);
  }

  function clearField(key: string) {
    const next = { ...knownFacts };
    delete next[key];
    setKnownFacts(next);
    runQuery(next);
  }

  function reset() {
    setKnownFacts({});
    runQuery({});
  }

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px" }}>
      <p style={{ marginBottom: 4 }}>
        <Link href="/" style={{ color: "#58a6ff" }}>
          ← Search
        </Link>
      </p>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{title}</h1>
      <p style={{ color: "#8b96a5", marginTop: 0 }}>{description}</p>

      {warningBanner && (
        <div
          style={{
            border: "1px solid #6e3b12",
            background: "#2b1a08",
            color: "#f0b866",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ⚠ {warningBanner}
        </div>
      )}

      {Object.keys(knownFacts).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {Object.keys(knownFacts).map((k) => (
            <span
              key={k}
              style={{
                display: "inline-block",
                background: "#132030",
                border: "1px solid #2a3546",
                borderRadius: 999,
                padding: "4px 10px",
                marginRight: 6,
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              {fieldLabel(k)}: <strong>{knownFacts[k]}</strong>{" "}
              <button
                onClick={() => clearField(k)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#8b96a5",
                  cursor: "pointer",
                  marginLeft: 4,
                }}
              >
                ✕
              </button>
            </span>
          ))}
          <button
            onClick={reset}
            style={{
              fontSize: 12,
              background: "none",
              border: "1px solid #2a3546",
              borderRadius: 6,
              color: "#8b96a5",
              cursor: "pointer",
              padding: "3px 8px",
            }}
          >
            reset all
          </button>
        </div>
      )}

      {loading && <p style={{ color: "#8b96a5" }}>Thinking…</p>}

      {data && !loading && (
        <>
          <p style={{ color: "#8b96a5", fontSize: 13 }}>
            {data.candidateCount} candidate(s) match what&apos;s known so far —{" "}
            {data.elapsedMs}ms
          </p>

          {data.nextQuestion ? (
            <div
              style={{
                border: "1px solid #3d4a5f",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
                background: "#0e1a29",
              }}
            >
              <div style={{ fontSize: 11, color: "#58a6ff", fontWeight: 700 }}>
                NEXT QUESTION · {data.nextQuestion.tier}
              </div>
              <div style={{ fontSize: 17, margin: "6px 0" }}>
                What&apos;s the {data.nextQuestion.label.toLowerCase()}?
              </div>
              <div style={{ fontSize: 12, color: "#8b96a5", marginBottom: 10 }}>
                {data.nextQuestion.why}
              </div>
              <div>
                {data.nextQuestion.sampleValues.map((v) => (
                  <button
                    key={v}
                    onClick={() => setField(data.nextQuestion!.field, v)}
                    style={{
                      marginRight: 6,
                      marginBottom: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #2a3546",
                      background: "#132030",
                      color: "#e6e9ee",
                      cursor: "pointer",
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <input
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="or type exact value"
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #2a3546",
                    background: "#0e141b",
                    color: "#e6e9ee",
                  }}
                />
                <button
                  onClick={() =>
                    manualValue.trim() && setField(data.nextQuestion!.field, manualValue.trim())
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #2a3546",
                    background: "#132030",
                    color: "#e6e9ee",
                    cursor: "pointer",
                  }}
                >
                  Set
                </button>
              </div>
            </div>
          ) : (
            data.candidateCount > 1 && (
              <p style={{ color: "#8b96a5", fontSize: 13 }}>
                No remaining field discriminates further between the current
                candidates with the data we have.
              </p>
            )
          )}

          {data.candidates.map((c) => (
            <div
              key={c.rawPartNumber + c.pdfPage}
              style={{
                border: "1px solid #263041",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 10,
                background: "#111823",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 16 }}>{c.rawPartNumber}</strong>
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: statusColor[c.status] }}
                >
                  {c.status.replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#8b96a5", margin: "4px 0" }}>
                {c.sectionTitle ?? "—"}
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                {fields.map((f) => {
                  const val = c.fields[f.key];
                  const known = knownFacts[f.key] != null;
                  return (
                    <span key={f.key} style={{ marginRight: 12, color: "#c9d1d9" }}>
                      {known ? "✓" : val ? "·" : "?"} {f.label}:{" "}
                      {val ?? <em style={{ color: "#6b7685" }}>missing</em>}
                    </span>
                  );
                })}
              </div>
              {Object.keys(extraLabels).length > 0 && (
                <div style={{ fontSize: 12, color: "#8b96a5" }}>
                  {Object.entries(extraLabels)
                    .map(([key, label]) => `${label}: ${c.extra[key] ?? "—"}`)
                    .join(" · ")}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#8b96a5", marginTop: 4 }}>
                Evidence: URI-515Catalog — PDF p.{c.pdfPage}
                {c.catalogPage ? ` / Catalog p.${c.catalogPage}` : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
