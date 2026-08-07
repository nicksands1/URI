"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOTOR_FIELDS, type MotorFieldKey, type MotorKnownFacts } from "@/lib/domain/motor";

interface MotorCandidate {
  rawPartNumber: string;
  normalizedPartNumber: string;
  status: "MATCHES_ALL_KNOWN_FIELDS" | "POSSIBLE_INCOMPLETE" | "NOT_SUITABLE";
  fields: Record<MotorFieldKey, string | null>;
  ampsRaw: string | null;
  weightRaw: string | null;
  sectionTitle: string | null;
  pdfPage: number;
  catalogPage: number | null;
}

interface NextQuestion {
  field: MotorFieldKey;
  label: string;
  tier: string;
  distinctValueCount: number;
  sampleValues: string[];
  why: string;
}

interface MotorQueryResponse {
  knownFacts: MotorKnownFacts;
  candidateCount: number;
  candidates: MotorCandidate[];
  nextQuestion: NextQuestion | null;
  elapsedMs: number;
}

const fieldLabel = (key: MotorFieldKey) =>
  MOTOR_FIELDS.find((f) => f.key === key)?.label ?? key;

const statusColor: Record<string, string> = {
  MATCHES_ALL_KNOWN_FIELDS: "#3fb950",
  POSSIBLE_INCOMPLETE: "#d29922",
  NOT_SUITABLE: "#f85149",
};

export default function MotorPage() {
  const [knownFacts, setKnownFacts] = useState<MotorKnownFacts>({});
  const [data, setData] = useState<MotorQueryResponse | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function runQuery(facts: MotorKnownFacts) {
    setLoading(true);
    try {
      const res = await fetch("/api/motor/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knownFacts: facts }),
      });
      const json = (await res.json()) as MotorQueryResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runQuery({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(key: MotorFieldKey, value: string) {
    const next = { ...knownFacts, [key]: value };
    setKnownFacts(next);
    setManualValue("");
    runQuery(next);
  }

  function clearField(key: MotorFieldKey) {
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
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Guided Motor Search</h1>
      <p style={{ color: "#8b96a5", marginTop: 0 }}>
        Answers the field that eliminates the most candidates first — not a
        fixed checklist. HP + RPM alone is never enough (CLAUDE.md §7).
      </p>

      {/* Known facts so far */}
      {Object.keys(knownFacts).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {(Object.keys(knownFacts) as MotorFieldKey[]).map((k) => (
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

          {/* Next question */}
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
                    manualValue.trim() &&
                    setField(data.nextQuestion!.field, manualValue.trim())
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

          {/* Candidates */}
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
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: statusColor[c.status],
                  }}
                >
                  {c.status.replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#8b96a5", margin: "4px 0" }}>
                {c.sectionTitle ?? "—"}
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                {MOTOR_FIELDS.map((f) => {
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
              <div style={{ fontSize: 12, color: "#8b96a5" }}>
                Amps: {c.ampsRaw ?? "—"} · Weight: {c.weightRaw ?? "—"} lbs
              </div>
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
