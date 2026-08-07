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
