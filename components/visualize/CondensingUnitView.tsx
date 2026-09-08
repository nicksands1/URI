"use client";

import { useState } from "react";
import Link from "next/link";
import { CondensingUnitScene, type ComponentKey } from "@/components/visualize/CondensingUnitScene";
import { ControlsBar } from "@/components/visualize/ControlsBar";
import { SpecPanel } from "@/components/visualize/SpecPanel";

export function CondensingUnitView() {
  const [cutaway, setCutaway] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isolated, setIsolated] = useState<ComponentKey | null>(null);

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1c2532",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <Link href="/" style={{ color: "#58a6ff", fontSize: 13 }}>
          ← Search
        </Link>
        <h1 style={{ fontSize: 16, margin: 0 }}>
          Trenton TQZA020L8HS2DE — Air Cooled Condensing Unit, Outdoor, Scroll
        </h1>
      </div>

      <ControlsBar
        cutaway={cutaway}
        setCutaway={setCutaway}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        speed={speed}
        setSpeed={setSpeed}
        isolated={isolated}
        setIsolated={setIsolated}
      />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <CondensingUnitScene
            cutaway={cutaway}
            showLabels={showLabels}
            speed={speed}
            isolated={isolated}
            onSelectComponent={setIsolated}
          />
          <div
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              fontSize: 11,
              color: "#6b7685",
              background: "rgba(11,15,20,0.7)",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            Drag to orbit · scroll to zoom · right-drag to pan · click a part to isolate it
          </div>
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              fontSize: 10,
              color: "#8b96a5",
              background: "rgba(11,15,20,0.7)",
              padding: "6px 10px",
              borderRadius: 6,
              lineHeight: 1.6,
            }}
          >
            <div>
              <span style={{ color: "#ff4d3d" }}>●</span> high-pressure vapor
            </div>
            <div>
              <span style={{ color: "#ffb020" }}>●</span> high-pressure liquid
            </div>
            <div>
              <span style={{ color: "#4da8ff" }}>●</span> low-pressure vapor
            </div>
          </div>
        </div>

        <div
          style={{
            width: 340,
            overflowY: "auto",
            borderLeft: "1px solid #1c2532",
            padding: "16px 18px",
            background: "#0b0f14",
          }}
        >
          <SpecPanel isolated={isolated} />
        </div>
      </div>
    </main>
  );
}
