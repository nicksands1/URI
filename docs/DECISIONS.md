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

- **R-001 — Copyright/visibility risk on textbook content.** `Refrigeration_1.md` through `Refrigeration_4.md` (full text conversion of the commercially published *Refrigeration & Air Conditioning Technology, 9th Edition*, ~1,700 combined page markers) are already committed to git history at the repo root, **not** gitignored, predating this session. If `nicksands1/URI` is a public repository this is a live copyright exposure; even if private, the full text sitting in an unencrypted repo (and now git history permanently) is worth a deliberate decision rather than default inertia. Not fixed automatically this session — flagged for Discovery Round 1 (O-004).
- **R-002 — No catalog source yet.** `URI-515Catalog.pdf`, the single highest-value source for "is this in my distributor's catalog" lookups, is not present anywhere in the repo or filesystem. Needs to be supplied via `data/private/source/` before catalog-backed lookup can be built.

---

*Log format: append new dated sections per discovery round; do not rewrite prior entries except to change a status (e.g. OPEN → DECIDED) with a short note.*
