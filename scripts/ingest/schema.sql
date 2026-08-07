-- Counter Intelligence - core catalog schema (V0.1 vertical slice: Motor)
--
-- Design notes (see docs/DECISIONS.md D-013..D-020, CLAUDE.md 21):
--   - catalog_parts is a RETRIEVAL INDEX (raw_line + ordered columns), not a
--     verified spec database. It never claims "verified".
--   - motor_specs is the first typed, category-specific table - deliberately
--     narrow (one category) rather than one giant nullable products table.
--   - Every row keeps provenance back to source_document/pdf_page so a
--     result can always be cited.
--   - pg_trgm indexes make ILIKE/substring and similarity search fast at
--     this scale (~20k rows) without needing an app-level cache.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS catalog_pages (
    id              BIGSERIAL PRIMARY KEY,
    source_document TEXT NOT NULL,
    pdf_page        INTEGER NOT NULL,
    catalog_page    INTEGER,
    section_title   TEXT,
    category        TEXT,
    raw_text        TEXT NOT NULL,
    UNIQUE (source_document, pdf_page)
);

CREATE TABLE IF NOT EXISTS catalog_parts (
    id                      BIGSERIAL PRIMARY KEY,
    source_document         TEXT NOT NULL,
    pdf_page                INTEGER NOT NULL,
    catalog_page            INTEGER,
    section_title           TEXT,
    category                TEXT,
    raw_part_number         TEXT NOT NULL,
    normalized_part_number  TEXT NOT NULL,
    normalized_no_separator TEXT NOT NULL,
    raw_line                TEXT NOT NULL,
    columns                 JSONB NOT NULL DEFAULT '[]',
    nearest_header_line     TEXT,
    extraction_method       TEXT NOT NULL,
    review_status           TEXT NOT NULL DEFAULT 'unreviewed'
);

-- Exact / normalized lookup: instant via btree equality.
CREATE INDEX IF NOT EXISTS idx_catalog_parts_normalized
    ON catalog_parts (normalized_part_number);
CREATE INDEX IF NOT EXISTS idx_catalog_parts_no_sep
    ON catalog_parts (normalized_no_separator);

-- Substring / fuzzy: trigram GIN index makes ILIKE '%x%' and similarity()
-- fast instead of a sequential scan.
CREATE INDEX IF NOT EXISTS idx_catalog_parts_no_sep_trgm
    ON catalog_parts USING GIN (normalized_no_separator gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_catalog_parts_category
    ON catalog_parts (category);

-- Typed Motor selection-driver table (CLAUDE.md 7: HP+RPM alone is not
-- enough - voltage, phase, rotation, shaft, mounting all matter).
-- One row per catalog_parts row that was successfully typed; nullable
-- columns are MISSING facts, not zeros - never coerce blank to 0.
CREATE TABLE IF NOT EXISTS motor_specs (
    id                  BIGSERIAL PRIMARY KEY,
    catalog_part_id     BIGINT NOT NULL REFERENCES catalog_parts(id) ON DELETE CASCADE,
    raw_part_number     TEXT NOT NULL,
    normalized_part_number TEXT NOT NULL,
    hp_or_watts_raw     TEXT,        -- e.g. "5W", "1/3", "3/4" - kept as printed, unit ambiguous (HP vs Watts) without a units column
    voltage_raw         TEXT,        -- e.g. "115", "208-230"
    rpm_raw             TEXT,
    amps_raw            TEXT,
    rotation_raw        TEXT,        -- e.g. "CWOSE", "CCWOSE"
    num_speeds_raw      TEXT,
    shaft_dia_raw       TEXT,
    shaft_length_raw    TEXT,
    capacitor_raw       TEXT,
    weight_raw          TEXT,
    section_title       TEXT,
    pdf_page            INTEGER NOT NULL,
    catalog_page        INTEGER,
    header_line_used    TEXT,        -- the header line this row was positionally mapped against
    field_mapping_method TEXT NOT NULL DEFAULT 'positional-header-match-v1',
    review_status       TEXT NOT NULL DEFAULT 'unreviewed'
);

CREATE INDEX IF NOT EXISTS idx_motor_specs_normalized
    ON motor_specs (normalized_part_number);
CREATE INDEX IF NOT EXISTS idx_motor_specs_voltage ON motor_specs (voltage_raw);
CREATE INDEX IF NOT EXISTS idx_motor_specs_rotation ON motor_specs (rotation_raw);

-- Typed Compressor selection-driver table (CLAUDE.md 7: HP alone is not
-- enough; capacity without rating condition may not be comparable).
--
-- IMPORTANT GAP, stated not hidden: refrigerant and application
-- (low/med/high temp) are NOT table columns in this catalog - they are
-- printed as prose tied to a model FAMILY/series (e.g. "3 SERIES ...
-- Refrigerant cooled", "Oil charge: AB = Alkylbenzene; POE = Polyolester"),
-- interleaved with other columns in a 2-column PDF layout that does not
-- reliably linearize back to a single row. Rather than guess a
-- refrigerant->part association that could be wrong (exactly the failure
-- mode CLAUDE.md 10 exists to prevent), this table does not model
-- refrigerant/application at all. The app surfaces this as a mandatory
-- manual-check warning, not a silently missing field.
CREATE TABLE IF NOT EXISTS compressor_specs (
    id                  BIGSERIAL PRIMARY KEY,
    catalog_part_id     BIGINT NOT NULL REFERENCES catalog_parts(id) ON DELETE CASCADE,
    raw_part_number     TEXT NOT NULL,
    normalized_part_number TEXT NOT NULL,
    capacity_btuh_raw   TEXT,
    hp_raw              TEXT,
    voltage_raw         TEXT,
    phase_raw           TEXT,
    rla_raw             TEXT,
    mount_raw           TEXT,
    dim_h_raw           TEXT,
    dim_w_raw           TEXT,
    dim_l_raw           TEXT,
    suction_raw         TEXT,
    discharge_raw       TEXT,
    weight_raw          TEXT,
    section_title       TEXT,          -- manufacturer, e.g. "COPELAND", "BITZER"
    pdf_page            INTEGER NOT NULL,
    catalog_page        INTEGER,
    header_line_used    TEXT,
    field_mapping_method TEXT NOT NULL DEFAULT 'positional-header-match-v1',
    review_status       TEXT NOT NULL DEFAULT 'unreviewed'
);

CREATE INDEX IF NOT EXISTS idx_compressor_specs_normalized
    ON compressor_specs (normalized_part_number);
CREATE INDEX IF NOT EXISTS idx_compressor_specs_voltage ON compressor_specs (voltage_raw);
CREATE INDEX IF NOT EXISTS idx_compressor_specs_phase ON compressor_specs (phase_raw);
CREATE INDEX IF NOT EXISTS idx_compressor_specs_manufacturer ON compressor_specs (section_title);

-- Typed TXV selection-driver table (CLAUDE.md 7: line size + refrigerant
-- alone is NOT enough).
--
-- IMPORTANT GAP, stated not hidden: same as compressor_specs - refrigerant
-- is prose tied to a model series, not a per-row column, and TXV/valve
-- pages have messier 2-column layout artifacts than Motor/Compressor
-- pages (verified during ingestion - some nearest_header_line values carry
-- trailing contamination from an adjacent column). Refrigerant is not
-- modeled; the app requires an explicit manual-check acknowledgment before
-- showing candidates, since refrigerant mismatch is the single most
-- dangerous TXV selection error per CLAUDE.md's TXV section.
CREATE TABLE IF NOT EXISTS txv_specs (
    id                  BIGSERIAL PRIMARY KEY,
    catalog_part_id     BIGINT NOT NULL REFERENCES catalog_parts(id) ON DELETE CASCADE,
    raw_part_number     TEXT NOT NULL,
    normalized_part_number TEXT NOT NULL,
    tons_raw            TEXT,          -- nominal capacity, tons
    inlet_raw           TEXT,
    outlet_raw          TEXT,
    thermostatic_charge_raw TEXT,      -- e.g. "C", "Z", "ZP", "ZP40", "A/C"
    equalizer_raw        TEXT,         -- "Internal" | "External"
    section_title       TEXT,
    pdf_page            INTEGER NOT NULL,
    catalog_page        INTEGER,
    header_line_used    TEXT,
    field_mapping_method TEXT NOT NULL DEFAULT 'positional-header-match-v1',
    review_status       TEXT NOT NULL DEFAULT 'unreviewed'
);

CREATE INDEX IF NOT EXISTS idx_txv_specs_normalized
    ON txv_specs (normalized_part_number);
CREATE INDEX IF NOT EXISTS idx_txv_specs_equalizer ON txv_specs (equalizer_raw);
CREATE INDEX IF NOT EXISTS idx_txv_specs_inlet ON txv_specs (inlet_raw);
