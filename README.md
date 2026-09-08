# Counter Intelligence

HVAC/R counter-sales intelligence tool. See `CLAUDE.md` for the full product
constitution and `docs/DECISIONS.md` for the running decision log.

## Status: V0.1 - Motor, Compressor, TXV vertical slices (local), plus a
## first 3D equipment visualization

### 3D visualization: `/visualize/condensing-unit`

A separate, newer feature area: an interactive Three.js visualization of a
real catalog unit (Trenton TQZA020L8HS2DE, p.152), with orbit/zoom/pan, a
cutaway toggle, click-to-isolate components, an animated color-coded
refrigerant flow (high-pressure vapor / high-pressure liquid / low-pressure
vapor), and a spec panel that distinguishes catalog-cited values from
illustrative/generic ones. See `docs/DECISIONS.md`'s 2026-09-08 entries for
how it was scoped and sourced, and
`lib/domain/visualization/condensingUnitData.ts` for the cited data itself.
Internal 3D geometry (compressor shape, coil layout, etc.) is schematic,
not a manufacturer drawing - the catalog doesn't contain CAD data - see
that file's header comment for what is/isn't cited.

### Search / guided-question engine

A Next.js/TypeScript app backed by Postgres, plus the Python ingestion
scripts that feed it:

```
scripts/ingest/parse_catalog.py           # parses URI-515Catalog.md into
                                           # provenance-carrying JSONL
scripts/ingest/schema.sql                 # Postgres schema
scripts/ingest/load_to_postgres.py        # loads the JSONL into Postgres
scripts/ingest/parse_motor_specs.py       # typed Motor spec table
scripts/ingest/parse_compressor_specs.py  # typed Compressor spec table
scripts/ingest/parse_txv_specs.py         # typed TXV spec table
scripts/search/search_catalog.py          # standalone CLI search (no DB needed)

app/                                       # Next.js app (search UI + 3 guided UIs)
lib/                                       # search, question engine, domain types
components/GuidedSearch.tsx                # shared guided-search UI, one per category
```

### Setup

1. **Catalog source** (private, gitignored, not in this repo): place the
   converted catalog Markdown at `data/private/source/URI-515Catalog.md`.
2. **Postgres**: a local server with a `counter_intelligence` database and
   `ci_app` role (see `.env.example`). Apply the schema:
   ```
   psql -d counter_intelligence -f scripts/ingest/schema.sql
   ```
3. **Ingest**:
   ```
   python3 scripts/ingest/parse_catalog.py
   python3 scripts/ingest/load_to_postgres.py
   python3 scripts/ingest/parse_motor_specs.py
   python3 scripts/ingest/parse_compressor_specs.py
   python3 scripts/ingest/parse_txv_specs.py
   ```
4. **Run the app**:
   ```
   npm install
   npm run dev
   ```
   Search: `/` · Guided flows: `/motor` · `/compressor` · `/txv`

### Standalone CLI search (no Postgres/Next.js needed)

```
python3 scripts/search/search_catalog.py "U0150AB"
```

### Evidence model

Every search/candidate result carries its source document, PDF page,
catalog page, and section - see `CLAUDE.md` §9 (evidence) and §10
(anti-hallucination). A catalog search hit only ever means "listed in the
catalog text" - never a stock/availability claim. The Motor guided flow's
`MATCHES_ALL_KNOWN_FIELDS` status means "matches everything you told me" -
not a verified OEM replacement (see `docs/DECISIONS.md` D-026); every
known fact came from you, not a nameplate, so it's REPORTED evidence, not
CONFIRMED.

### Known limitations

- No unit normalization yet (`"3/4"` won't match `"0.75"`); type values as
  printed in the catalog.
- Motor fields cover HP, voltage, RPM, amps, rotation, speeds, shaft
  dia/length, capacitor, weight - not phase, frequency, mounting/frame, or
  enclosure (not reliably separate columns in this catalog's tables).
- **Compressor and TXV do not model refrigerant or application (low/med/
  high temp)** - the single most important selection driver for both,
  per CLAUDE.md. It's printed as prose tied to a model family/series in the
  catalog, not a per-row column, and this app will not guess the
  association. Both guided pages show a mandatory warning; refrigerant
  compatibility must be confirmed manually.
- Local Postgres only - not yet deployed.
