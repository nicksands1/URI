"use client";

import type { CitedValue } from "@/lib/domain/visualization/types";
import {
  COMPANION_PARTS,
  ILLUSTRATIVE_OPERATING_CONDITIONS,
  TQZA020L8HS2DE,
  SUFFIX_DECODE_STATUS,
} from "@/lib/domain/visualization/condensingUnitData";

const label: React.CSSProperties = { color: "#8b96a5", fontSize: 12 };
const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "5px 0",
  borderBottom: "1px solid #1c2532",
  fontSize: 13,
};

function Row(props: { label: string; cited: CitedValue<string | number> }) {
  const { citation } = props.cited;
  const badgeColor = citation.scope === "ROW" ? "#3fb950" : "#d29922";
  const badgeText = citation.scope === "ROW" ? "CATALOG · this row" : "CATALOG · family note";
  return (
    <div style={row} title={`${citation.sourceDocument} — p.${citation.pdfPage} — ${citation.sectionTitle}`}>
      <span style={label}>{props.label}</span>
      <span>
        {props.cited.value}{" "}
        <span style={{ fontSize: 9, color: badgeColor, fontWeight: 700, marginLeft: 4 }}>{badgeText}</span>
      </span>
    </div>
  );
}

export function SpecPanel(props: { isolated: string | null }) {
  const s = TQZA020L8HS2DE;
  const oc = ILLUSTRATIVE_OPERATING_CONDITIONS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontSize: 13 }}>
      <div>
        <div style={{ fontSize: 11, color: "#58a6ff", fontWeight: 700 }}>
          {s.category.toUpperCase()}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{s.partNumber}</div>
        <div style={{ color: "#8b96a5" }}>{s.manufacturer}</div>
      </div>

      <div>
        <Row label="HP" cited={s.hp} />
        <Row label="Voltage" cited={s.voltage} />
        <Row label="Phase" cited={s.phase} />
        <Row label="Hertz" cited={s.hertz} />
        <Row label="Motor FLA" cited={{ ...s.motorFla, value: `${s.motorFla.value} A` }} />
        <Row label="MCA" cited={{ ...s.mcaAmps, value: `${s.mcaAmps.value} A` }} />
        <Row label="Fans" cited={s.numberOfFans} />
        <Row label="Receiver capacity" cited={{ ...s.receiverCapacityLbs, value: `${s.receiverCapacityLbs.value} lbs` }} />
        <Row label="Suction connection" cited={{ ...s.suctionConnectionIn, value: `${s.suctionConnectionIn.value} in` }} />
        <Row label="Liquid connection" cited={{ ...s.liquidConnectionIn, value: `${s.liquidConnectionIn.value} in` }} />
        <Row
          label="Dimensions (L×W×H)"
          cited={{
            value: `${s.dimensionsIn.l} × ${s.dimensionsIn.w} × ${s.dimensionsIn.h} in`,
            evidence: "CONFIRMED",
            citation: s.dimensionsCitation,
          }}
        />
        <Row label="Ship weight" cited={{ ...s.shipWeightLbs, value: `${s.shipWeightLbs.value} lbs` }} />
        <Row
          label="Refrigerants"
          cited={{ value: s.refrigerants.value.join(", "), evidence: s.refrigerants.evidence, citation: s.refrigerants.citation }}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, color: "#8b96a5", fontWeight: 700, marginBottom: 4 }}>COMPRESSOR</div>
        <div style={{ fontSize: 13, color: "#c9d1d9" }}>{s.compressorType.value}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "#8b96a5", fontWeight: 700, marginBottom: 4 }}>
          FAMILY-LEVEL FEATURE NOTES{" "}
          <span style={{ color: "#d29922" }}>(printed on this page, not confirmed per-SKU)</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#c9d1d9" }}>
          {s.familyFeatureNotes.map((n, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {n.value}
            </li>
          ))}
        </ul>
        <div style={{ fontSize: 11, color: "#6b7685", marginTop: 4 }}>
          AF/AG suffix decode for this exact part number: {SUFFIX_DECODE_STATUS}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "#8b96a5", fontWeight: 700, marginBottom: 4 }}>
          COMPANION / INSTALLATION PARTS
        </div>
        {COMPANION_PARTS.map((c) => (
          <div key={c.partNumber} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{c.partNumber}</div>
            <div style={{ color: "#8b96a5", fontSize: 12 }}>{c.description}</div>
            <div style={{ color: "#c9d1d9", fontSize: 12 }}>{c.spec.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: "1px solid #6e3b12",
          background: "#2b1a08",
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        <div style={{ fontSize: 11, color: "#f0b866", fontWeight: 700, marginBottom: 6 }}>
          ILLUSTRATIVE OPERATING CONDITIONS — NOT A NAMEPLATE OR TEST READING
        </div>
        <div style={{ fontSize: 12, color: "#f0b866", marginBottom: 6 }}>{oc.note}</div>
        <div style={{ fontSize: 12, color: "#e6c98a" }}>
          Discharge {oc.value.dischargePressurePsig[0]}–{oc.value.dischargePressurePsig[1]} psig ·{" "}
          Suction {oc.value.suctionPressurePsig[0]}–{oc.value.suctionPressurePsig[1]} psig
          <br />
          Discharge line {oc.value.dischargeLineTempF[0]}–{oc.value.dischargeLineTempF[1]}°F · Liquid line{" "}
          {oc.value.liquidLineTempF[0]}–{oc.value.liquidLineTempF[1]}°F · Suction line{" "}
          {oc.value.suctionLineTempF[0]}–{oc.value.suctionLineTempF[1]}°F
          <br />
          Approx. superheat {oc.value.approxSuperheatF[0]}–{oc.value.approxSuperheatF[1]}°F · Approx.
          subcooling {oc.value.approxSubcoolingF[0]}–{oc.value.approxSubcoolingF[1]}°F
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#6b7685" }}>
        A condensing unit performs compression + condensation only. Expansion
        (TXV) and evaporation happen at a remote, field-installed evaporator
        coil — shown here as dashed lines leaving the cabinet, not part of
        this catalog part number.
      </div>
    </div>
  );
}
