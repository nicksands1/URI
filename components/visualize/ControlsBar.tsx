"use client";

import { COMPONENT_LIST, type ComponentKey } from "@/components/visualize/CondensingUnitScene";

const btn = (active: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid " + (active ? "#58a6ff" : "#2a3546"),
  background: active ? "#132030" : "transparent",
  color: active ? "#58a6ff" : "#c9d1d9",
  cursor: "pointer",
  fontSize: 12,
});

export function ControlsBar(props: {
  cutaway: boolean;
  setCutaway: (v: boolean) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  isolated: ComponentKey | null;
  setIsolated: (v: ComponentKey | null) => void;
}) {
  const { cutaway, setCutaway, showLabels, setShowLabels, speed, setSpeed, isolated, setIsolated } = props;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        padding: "10px 14px",
        borderBottom: "1px solid #1c2532",
        background: "#0e141b",
      }}
    >
      <button style={btn(cutaway)} onClick={() => setCutaway(!cutaway)}>
        {cutaway ? "✓ Cutaway view" : "Cutaway view"}
      </button>
      <button style={btn(showLabels)} onClick={() => setShowLabels(!showLabels)}>
        {showLabels ? "✓ Labels" : "Labels"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8b96a5" }}>
        Speed
        <input
          type="range"
          min={0}
          max={3}
          step={0.5}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        <span style={{ width: 28 }}>{speed === 0 ? "⏸" : `${speed}×`}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginLeft: "auto" }}>
        <span style={{ fontSize: 11, color: "#6b7685", alignSelf: "center", marginRight: 4 }}>
          Isolate:
        </span>
        <button style={btn(isolated === null)} onClick={() => setIsolated(null)}>
          All
        </button>
        {COMPONENT_LIST.map((c) => (
          <button key={c.key} style={btn(isolated === c.key)} onClick={() => setIsolated(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
