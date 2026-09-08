// Data for the first 3D visualization slice: a Trenton TQZA020L8HS2DE
// air-cooled outdoor scroll condensing unit. See docs/DECISIONS.md
// D-035/D-036/D-037 for how this was sourced and what is/isn't cited.
//
// SOURCE_DOCUMENT below is the literal filename this was read from -
// treat it as the citation anchor, same convention as
// lib/domain/motor.ts's catalog-derived tables.

import { cited, generic, type CitedValue, type SourceCitation } from "@/lib/domain/visualization/types";

const PT1: Omit<SourceCitation, "sectionTitle" | "scope"> = {
  sourceDocument: "URI-515Catalog-refrigeration-equipment-pt1-p135-164.pdf",
  pdfPage: 152,
  catalogPage: 152,
};

const PT2: Omit<SourceCitation, "sectionTitle" | "scope"> = {
  sourceDocument: "URI-515Catalog-refrigeration-equipment-pt2-p165-195.pdf",
  pdfPage: 194,
  catalogPage: 194,
};

const ROW_CITATION: SourceCitation = {
  ...PT1,
  sectionTitle:
    "Trenton Refrigeration — Air Cooled Condensing Unit, Outdoor, Scroll — TQZA Line, Low Temperature, Outdoor",
  scope: "ROW",
};

const FAMILY_CITATION: SourceCitation = { ...ROW_CITATION, scope: "FAMILY" };

const COMPRESSOR_FAMILY_CITATION: SourceCitation = {
  sourceDocument: "URI-515Catalog-refrigeration-equipment-pt1-p135-164.pdf",
  pdfPage: 150,
  catalogPage: 150,
  sectionTitle: "Trenton Refrigeration — A2L - TQZA Line, Low Temperature, Outdoor",
  scope: "FAMILY",
};

const ACCESSORY_CITATION: SourceCitation = {
  ...PT2,
  sectionTitle: "Accessories — Barrel Bracket / Rotalock® Adapter",
  scope: "ROW",
};

export interface CondensingUnitSpec {
  manufacturer: string;
  partNumber: string;
  category: string;
  hp: CitedValue<number>;
  voltage: CitedValue<string>;
  phase: CitedValue<number>;
  hertz: CitedValue<number>;
  motorFla: CitedValue<number>;
  mcaAmps: CitedValue<number>;
  numberOfFans: CitedValue<number>;
  receiverCapacityLbs: CitedValue<number>;
  suctionConnectionIn: CitedValue<string>;
  liquidConnectionIn: CitedValue<string>;
  dimensionsIn: { l: number; w: number; h: number };
  dimensionsCitation: SourceCitation;
  shipWeightLbs: CitedValue<number>;
  refrigerants: CitedValue<string[]>;
  compressorType: CitedValue<string>;
  familyFeatureNotes: CitedValue<string>[];
}

export const TQZA020L8HS2DE: CondensingUnitSpec = {
  manufacturer: "Trenton",
  partNumber: "TQZA020L8HS2DE",
  category: "Air Cooled Condensing Unit, Outdoor, Scroll — Low Temperature",
  hp: cited(2, ROW_CITATION),
  voltage: cited("208-230", ROW_CITATION),
  phase: cited(1, ROW_CITATION),
  hertz: cited(60, ROW_CITATION),
  motorFla: cited(1.7, ROW_CITATION),
  mcaAmps: cited(19.1, ROW_CITATION),
  numberOfFans: cited(1, ROW_CITATION),
  receiverCapacityLbs: cited(11, ROW_CITATION),
  suctionConnectionIn: cited("7/8", ROW_CITATION),
  liquidConnectionIn: cited("3/8", ROW_CITATION),
  dimensionsIn: { l: 18.75, w: 48.13, h: 29.25 },
  dimensionsCitation: ROW_CITATION,
  shipWeightLbs: cited(320, ROW_CITATION),
  refrigerants: cited(["R22", "R404A", "R407A", "R407C", "R448A", "R507"], FAMILY_CITATION),
  compressorType: cited(
    "Copeland scroll compressor (family-level bullet on p.150 for the TQZA line; no specific Copeland model tied to this row in the catalog excerpt)",
    COMPRESSOR_FAMILY_CITATION
  ),
  familyFeatureNotes: [
    cited(
      "AF, AG models include sealed liquid line filter drier, sight glass and mechanical time clock",
      FAMILY_CITATION
    ),
    cited(
      "AG models include heated and insulated receiver (required in ambients below 10°F)",
      FAMILY_CITATION
    ),
    cited(
      "Sound ratings at 100% fan speed and without sound insulated cabinet",
      FAMILY_CITATION
    ),
  ],
};

/** Which AF/AG bullet actually applies to this exact SKU is not decoded from
 * the catalog excerpt (the suffix segment isn't documented here) - see
 * D-035. Never resolved to true/false; shown as "not documented" per
 * CLAUDE.md §18. */
export const SUFFIX_DECODE_STATUS = "Not documented in loaded sources";

export interface CompanionPart {
  partNumber: string;
  description: string;
  spec: CitedValue<string>;
}

export const COMPANION_PARTS: CompanionPart[] = [
  {
    partNumber: "BR1",
    description: "Compressor/condenser mounting bracket (Sigma Engineering)",
    spec: cited("Inside dia 6 in · Base L14.0 x W3.0 in · base width 3 in", ACCESSORY_CITATION),
  },
  {
    partNumber: "SERCAP series",
    description: "Rotalock® adapter replacement caps (sizes 1/4 SAE – M36x1.5, see catalog table)",
    spec: cited("Multiple Rotalock sizes/TPI — see p.194 table for exact part per size", ACCESSORY_CITATION),
  },
];

/**
 * Illustrative operating-condition overlay for a low-temperature R404A
 * application. NOT read off any nameplate or test report for this specific
 * unit - there is no such reading in the catalog. Presented as a typical/
 * textbook range for this refrigerant + duty, per CLAUDE.md §3's generic-
 * data fallback. Never render this next to a CitedValue without the label.
 */
export const ILLUSTRATIVE_OPERATING_CONDITIONS = generic(
  {
    refrigerant: "R404A",
    dischargePressurePsig: [250, 320] as [number, number],
    suctionPressurePsig: [8, 18] as [number, number],
    dischargeLineTempF: [140, 180] as [number, number],
    liquidLineTempF: [85, 100] as [number, number],
    suctionLineTempF: [-15, 5] as [number, number],
    approxSuperheatF: [8, 15] as [number, number],
    approxSubcoolingF: [8, 15] as [number, number],
  },
  "Typical/textbook range for R404A low-temperature duty (~-20°F evaporator), not a measured reading for this unit. Actual field readings vary with ambient, load, and charge."
);
