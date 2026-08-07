# Counter Intelligence

HVAC/R counter-sales intelligence tool. See `CLAUDE.md` for the full product
constitution and `docs/DECISIONS.md` for the running decision log.

## Status: early V0.1 slice

What exists right now is a deterministic search core, not a web app yet:

```
scripts/ingest/parse_catalog.py   # parses the URI-515 catalog (Markdown) into
                                   # provenance-carrying JSONL records
scripts/search/search_catalog.py  # exact / normalized / substring / fuzzy
                                   # part-number search over that index
```

### Setup

The catalog source is private and gitignored - it is not in this repo. Place
the converted catalog Markdown at `data/private/source/URI-515Catalog.md`,
then:

```
python3 scripts/ingest/parse_catalog.py
```

This writes derived JSONL/JSON files to `data/private/derived/` (also
gitignored).

### Search

```
python3 scripts/search/search_catalog.py "U0150AB"
python3 scripts/search/search_catalog.py "3AJB021" --limit 5
python3 scripts/search/search_catalog.py "U0150AB" --json
```

Every result carries its source document, PDF page, catalog page, section,
and the raw catalog line - see `CLAUDE.md` section 9 (evidence) and 10
(anti-hallucination). A result only ever means "listed in the catalog text";
it is never a claim about stock, availability, or that it's the right
replacement for anything.
