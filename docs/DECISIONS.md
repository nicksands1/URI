# Counter Intelligence — Decision Log

Statuses: `DECIDED` `OPEN` `DEFERRED` `ASSUMPTION` `REVISIT`

---

## 2026-08-07 — Project kickoff / repo inspection

### DECIDED

- **D-001** Project name: Counter Intelligence. Persistent constitution lives in `CLAUDE.md` at repo root.
- **D-002** Initial user: exactly one person (the repo owner), private personal workflow tool. No public signup, billing, or multi-tenant admin in v1.
- **D-003** Architecture should avoid unnecessary lock-in to proprietary URI data so a generic engine could later load different source/data packs — but no multi-tenancy implementation work now.
- **D-004** Anti-hallucination invariant: the LLM may never present an invented part number as a real, sellable product. A part number can only be shown as a candidate if it was retrieved from a structured DB, an ingested source document, or an approved live lookup.
- **D-005** Evidence states for facts: `CONFIRMED`, `REPORTED`, `INFERRED`, `MISSING` (optionally `UNREADABLE`, `CONFLICTING`, `NOT_APPLICABLE`). A reported/inferred value never silently becomes confirmed.
- **D-006** Candidate verification status vocabulary: `VERIFIED`, `POSSIBLE_INCOMPLETE`, `NOT_SUITABLE`.
- **D-007** Search order is deterministic-first: exact part number → normalized → aliases → documented supersessions/crosses → structured spec filtering → full text → fuzzy → semantic → external research → LLM synthesis. Do not default to vector/semantic search.
- **D-008** Private source documents must never be committed to git. Recommended location: `data/private/source/` (created this session, gitignored).
- **D-009** Time budget for iteration 1: ~12 hours over 3 days. Do not attempt the full long-term vision in this slice.
- **D-010** `.gitignore` added this session covering `data/private/`, env files, and standard Node/Python build artifacts.

### ASSUMPTION (defaults proposed, pending confirmation)

- **A-001** Dev/build environment for this session has Node 22.22, npm 10.9, Python 3.11, PostgreSQL 16 client, and Docker available. This is the *cloud session* environment, not necessarily where the user will run the app day-to-day at work — needs confirmation (Discovery Round 1).
- **A-002** Candidate stack (Next.js + TypeScript + React + Tailwind + PostgreSQL, Python for ingestion) is directionally reasonable given the above, but not locked in until deployment/device constraints are known.
- **A-003** Initial guided categories should be the highest-frequency, highest-risk-of-bad-substitution categories the user actually handles — proposing compressor, motor, TXV, relay as candidates per CLAUDE.md §38, to be narrowed after Discovery Round 1.

### OPEN

- **O-001** Where/how will the app actually be used at work (device, OS, browser restrictions, internet access, personal phone use)?
- **O-002** Deployment model: local-only vs. small private cloud deploy; auth needs.
- **O-003** Is `nicksands1/URI` a private repository? (Could not determine from available tools — needs user confirmation.)
- **O-004** What should happen to `Refrigeration_1.md`..`Refrigeration_4.md` (see RISK below)?
- **O-005** Exact highest-value first workflow/category to target for the 12-hour build.
- **O-006** AI provider preference / API key availability / cost tolerance.

### DEFERRED

Per CLAUDE.md §39: billing, multi-tenancy, ERP/inventory integration, live pricing, full image recognition, full URL comparison, exhaustive nomenclature/vendor library, autonomous agents, microservices, native mobile.

### RISK

- **R-001 — Copyright/visibility risk on textbook content. CONFIRMED LIVE 2026-08-07.** Verified via unauthenticated fetch that `github.com/nicksands1/URI` is a **public** repository — file listing loads with no sign-in. `Refrigeration_1.md`..`Refrigeration_4.md` (full text of the commercially published *Refrigeration & Air Conditioning Technology, 9th Edition*) are sitting in it, uncommitted-ignore, in git history. Action needed from user (no write access to repo visibility from this session): make the repo private in GitHub Settings → Danger Zone. Purging the textbook from git history is a separate, optional follow-up only relevant if the repo should ever go public again — not urgent once private.
  - **Catalog content is NOT part of this risk** — user confirmed 2026-08-07 the URI-515 catalog is URI's own published marketing/reference material, publicly available online. No confidentiality/copyright concern there; it's kept out of git purely for file-size hygiene, not secrecy.
- **R-002 — No catalog source yet.** ~~`URI-515Catalog.pdf`, the single highest-value source for "is this in my distributor's catalog" lookups, is not present anywhere in the repo or filesystem.~~ **RESOLVED 2026-08-07** — see D-011.

---

## 2026-08-07 (later) — Catalog source received

### DECIDED

- **D-011** `URI-515Catalog.md` received from user as a pre-converted Markdown file (user ran their own PDF→Markdown conversion outside this session; original was 93MB PDF / 1,251 pages, too large to attach directly). Placed at `data/private/source/URI-515Catalog.md`, confirmed gitignored via `git check-ignore`. Verified: all 1,251 `## PDF Page N` markers present (none missing/truncated), section index at top maps 21 catalog sections to PDF/catalog page ranges, and sampled tables (motor spec tables: Part No./HP/Voltage/RPM/Amps/Rotation/Shaft Dia./Shaft L/Wgt) retain correct column alignment in fixed-width blocks. Quality is good enough to ingest as-is.
- **D-012** Because the source is already Markdown (not the original PDF), the ingestion pipeline's "extraction" stage becomes parsing this Markdown's page blocks/tables rather than PDF text/table extraction. Provenance (source_document, PDF page, catalog page, section) is still fully derivable from the `<a id="pdf-page-N">` anchors and section headers, so this doesn't compromise the traceability requirement in CLAUDE.md §20 — just changes the input format for the parser. The original PDF is not in our possession, so this Markdown *is* the raw source of record going forward for this document.

### ASSUMPTION

- **A-004** Not yet spot-checked beyond a few sampled pages (front matter, page 10-11 motor tables) — full-file structural QA (e.g. every section's tables parse cleanly, no silent column-shift errors elsewhere in 1,251 pages) is deferred to when the ingestion parser is actually built, since that's where errors would surface anyway.

---

## 2026-08-07 (later still) — First working slice: catalog search core

User said "let's start" rather than continuing the full discovery round.
Proceeded on the judgment that ingestion + deterministic search need none of
the open deployment/device/category questions answered first, and are
themselves the fastest way to produce something real. Full Discovery Round 1
(device/environment, deployment model, AI provider, priority categories)
remains open and will be picked back up.

### DECIDED

- **D-013** Ingestion approach for the catalog: a conservative regex-based
  row detector (`scripts/ingest/parse_catalog.py`), not a real table/column
  parser. A row is captured if its line starts with a token containing at
  least one digit, immediately followed by 2+ spaces (i.e. it reads as a
  table cell). This is deliberately a *retrieval index*, not a verified
  spec database - column meaning is preserved as an ordered list plus the
  nearest "Part No." header line for context, not semantically typed. Typed
  per-category specs (voltage, HP, refrigerant, ...) are deferred to when a
  specific guided category is built and actually needs them.
- **D-014** Output: `data/private/derived/catalog_pages.jsonl` (1,251 page
  records), `catalog_parts.jsonl` (19,749 candidate part rows),
  `catalog_sections.json` (20-section index with PDF/catalog page ranges).
  All gitignored - derived from a private source, never committed.
- **D-015** Search (`scripts/search/search_catalog.py`) follows CLAUDE.md
  12's ordering: exact -> normalized (separator-insensitive) -> substring ->
  fuzzy, and **short-circuits at the first deterministic hit** so a clean
  exact match never gets buried under fuzzy "did you mean" noise. Fuzzy is
  only reached when nothing deterministic matched.
- **D-016** No character substitution ever happens silently. Verified
  concretely: `U0150AB` and `UO150AB` (0 vs letter-O) do **not** match each
  other via exact/normalized search; `UO150AB` correctly falls through to a
  labeled `FUZZY` suggestion pointing at `U0150AB`, matching the exact
  example in CLAUDE.md 13.
- **D-017** A search hit's `distributor_status` is only ever "listed in
  catalog" - never "verified," never a stock/availability claim (CLAUDE.md
  22). A miss is reported as "not found in ingested text," explicitly not
  "doesn't exist."

### Quality notes (not a decision, just measured)

- Spot-checked extraction noise rate: initial heuristic had ~27% false
  positives (English words like "Features" landing in column position);
  requiring the leading token to contain a digit dropped this sharply -
  remaining noise in later random sampling was ~1/20 (e.g. a bare `1/4`
  fraction on a fittings page). Acceptable for a retrieval index where every
  row is labeled `unreviewed` and shows its raw line - never presented as a
  confirmed fact.
- End-to-end CLI timing (interpreter start + loading 19,749-row index +
  query): ~360ms for an exact hit. Within the <2s target in CLAUDE.md 28.
- Confirmed present in the catalog: `U0150AB` (Heatcraft evaporator),
  `3AJB021ACAB` and the wider `xAJBxxxxxxxx` Copeland family. `AJB7465AXD`
  (a CLAUDE.md example query) was not found - correctly reported as "not
  found," not fabricated.

### OPEN (unchanged, still pending)

O-001 (device/environment), O-002 (deployment model), O-005 (highest-value
first category), O-006 (AI provider) - see earlier round. Nothing built this
session depended on these.

---

## 2026-08-07 (later still) — Discovery Round 1 answered

### DECIDED

- **D-018** (closes O-001) Primary usage context: **work PC, browser only.**
  Build as a standard browser-based web app; no assumption of admin
  install rights or a locked-down browser workaround needed unless it
  surfaces later. Mobile/phone use is not a target for the first slice.
- **D-019** (closes O-002) Deployment: **small private cloud deploy**
  (Next.js app + Postgres, e.g. Vercel + Supabase). Chosen over fully-local
  so the tool is reachable without depending on one machine, and so basic
  auth can gate it. This also finalizes the stack direction from CLAUDE.md
  §30 (Next.js/TypeScript/React/Postgres) rather than leaving it open.
- **D-020** (closes O-005) First guided-question-engine categories, in
  priority order: **Compressor, Motor, TXV.** Relay/Contactor explicitly
  deferred (not dropped) - it's the canonical demo example ("208 relay")
  but judged lower-stakes than a wrong compressor/motor/TXV pick.
- **D-021** (O-006) AI provider decision **explicitly deferred by choice**,
  not just unanswered - the next slice (question-engine logic, category
  selection templates) will be built provider-agnostic per CLAUDE.md §29,
  with an Anthropic key wired in behind that abstraction when actually
  needed (query classification / explanation, not search - search stays
  deterministic with no AI in the loop).

### Implication

This unblocks moving from standalone CLI scripts to an actual web app.
That's a materially larger step (new framework, hosted DB, deployment
account) - proposing a concrete first vertical slice next per CLAUDE.md §31
methodology before implementing it.

---

## 2026-08-07 (later still) — Motor vertical slice built (local)

User approved Motor as the first vertical slice with explicit emphasis on
speed. Full stack, local only (not yet deployed to Vercel/Supabase - D-019
says deploy once it works, this is that "once it works" checkpoint):
Postgres schema + bulk load, typed motor_specs table, Next.js/TS app with
`/api/search` and `/api/motor/query`, guided UI at `/motor`.

### DECIDED

- **D-022** Schema: `catalog_pages` + `catalog_parts` (generic retrieval
  index, mirrors the JSONL from D-013/014) plus a first category-specific
  typed table, `motor_specs`. Indexes: btree on `normalized_part_number` /
  `normalized_no_separator` for exact/normalized (0.3ms measured), GIN
  trigram (`pg_trgm`) on `normalized_no_separator` for substring/fuzzy.
- **D-023** `motor_specs` population: positionally map each row's
  already-split `columns` against its `nearest_header_line` (also split the
  same way), classify header labels by keyword into canonical fields (HP,
  voltage, RPM, amps, rotation, speeds, shaft dia/length, capacitor,
  weight). 653/814 Motors-category rows got at least one field typed; the
  rest stay searchable in `catalog_parts` but aren't in the typed pool.
- **D-024** **Field-shape + plausibility validation added after finding
  real contamination**: initial pass let bullet-point/description text and
  wrong-column numeric values (an RPM value shape-matching as a voltage,
  etc.) into typed fields - e.g. "voltage" candidates included
  "• Walk Ins" and "3/4". Fixed with per-field regex shape checks plus
  numeric plausibility ranges (voltage 12-600, RPM 200-4000, amps
  0.02-150, speeds 1-6). Re-verified: all 23 distinct `voltage_raw` values
  post-fix are genuine motor voltages, all 12 distinct `rotation_raw`
  values are genuine rotation codes. This is logged in detail because it's
  exactly the failure mode CLAUDE.md 10 warns about (data that looks
  plausible but isn't what it claims to be) - caught by testing, not by
  assumption.
- **D-025** Question engine: given known facts, filter `motor_specs`
  candidates by exact match on each known field's raw printed value (no
  unit normalization yet - stated limitation, not silent), then rank
  unset fields by tier (HARD_CONSTRAINT > IMPORTANT > PREFERENCE) and,
  within a tier, by count of distinct values remaining (more discriminating
  asked first). A field is only offered as the next question if it can
  actually discriminate (>=2 distinct values).
- **D-026** `CandidateStatus` deliberately does NOT reuse CLAUDE.md 8's
  VERIFIED label - this flow is spec-driven forward search from
  user-REPORTED facts, not cross-referencing a known original part, so the
  ceiling is `MATCHES_ALL_KNOWN_FIELDS` (all HARD_CONSTRAINT/IMPORTANT
  fields both known and matching), not VERIFIED.

### Quality / performance (measured, not estimated)

- Full 3-question guided scenario (unknown motor -> voltage=115 ->
  +rotation=REV -> +hp=1/3): 653 -> 177 -> 50 -> 12 candidates. Each step's
  full HTTP round trip: 15-30ms. Server-side query computation: 1-4ms.
- Exact catalog part search via `/api/search`: ~15-20ms full round trip
  after connection pool warms up (first request ~65ms, includes pool init).
- Both comfortably inside the CLAUDE.md 28 targets (<2s exact,
  ideally <5s AI-assisted) with large headroom - no caching layer needed
  at this data size (~20k catalog rows, ~650 typed motor rows).

### Known limitations (stated, not hidden)

- No unit normalization: "3/4" won't match "0.75"; typed values must match
  the catalog's exact printed format. Next candidate limitation to close
  if it turns out to matter in real use.
- `motor_specs` covers HP, voltage, RPM, amps, rotation, speeds, shaft
  dia/length, capacitor, weight - NOT phase, frequency, mounting/frame, or
  enclosure (CLAUDE.md 7 lists these too; this catalog's tables don't
  reliably expose them as separate columns for a first-pass parser).
- Runs against local Postgres in this dev session only - not yet deployed
  per D-019's plan to deploy after it works locally.

---

*Log format: append new dated sections per discovery round; do not rewrite prior entries except to change a status (e.g. OPEN → DECIDED) with a short note.*
