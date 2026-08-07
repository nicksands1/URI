# Counter Intelligence

HVAC/R counter-sales intelligence tool. See `CLAUDE.md` for the full product
constitution and `docs/DECISIONS.md` for the running decision log.

## Status: V0.1 - Motor, Compressor, TXV vertical slices (local)

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
