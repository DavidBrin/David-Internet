# 10 — SQL: ER Diagrams to Running Queries (DTU Databases, fall 2025)

Slug: `sql` · Fake domain: `sql.davids.net` · Archetype: **A** (in-browser database) — small page
Status: spec agreed 2026-08-29; **built 2026-09-01**. Drift, documents won: the two
hand-drawn ER diagrams are DESIGN EXERCISES (meeting room, news items) that do not
correspond to any shipped schema - so the schema panel draws live table/FK graphs from
the DDL instead and shows the drawings as artifacts, labeled. A sixth database was
added: the bike-shop design project (only its Data Sheet.png + Data Modification.sql
survive; schema + seed RECONSTRUCTED, disclosed) - it powers the modification panel,
including the FK-enforcement toggle punchline (with FKs on, the script fails at step 4:
it references part P108 before inserting it). MariaDB-only features (session variables,
stored functions, >= ALL, SIGNAL triggers) run as adapted SQLite presets with originals
shown. The join-lines animation was scoped down to touched-table highlighting + row
animations. Student ID scrubbed from vendored sources. 44 presets fixture-tested
(python sqlite3 vs the page's sql.js).

## Summary

A compact page: pick a schema (University, Family, Cinema, the week-12/13 databases), see
its hand-drawn ER diagram beside the DDL with hover-linking (entity ↔ `CREATE TABLE`),
then run the weekly answer queries — or your own — against a real SQLite database in the
browser (sql.js, WASM, loaded on demand). Animation: rows light up in the tables the
query touched, and joins draw as lines between matched rows.

## Source material

`demos/dtu_databases_raw/`:

| File | Role |
|---|---|
| `UniversityDB.sql`, `FamilyDB.sql`, `cinema.sql`, `w12_part1_database.sql`, `w13_part1_database.sql` | Schemas + seed data (MariaDB dialect → translated to SQLite at build) |
| `answers.sql`, `week3.sql`, `week4.sql`, `w12_part1_answers*.sql`, `w13_part1_answers*.sql`, `Data Modification.sql` | Query presets, grouped by week; `_complete` variants preferred |
| `Meeting room database design.png`, `News Items database design.png`, `Data Sheet.png` | ER diagrams (hand-drawn) — cropped/compressed to WebP; hotspots authored per entity |

## Stage

1. **Schema picker** (tabs). Left: ER diagram with hotspots; right: DDL. Hover an entity
   → its `CREATE TABLE` scrolls into view and highlights; hover a relationship → the
   foreign-key lines glow on both sides.
2. **Query runner:** preset list (weekly answers, with the exercise prompt as its label)
   + a free SQL editor. Run → results table; the **tables panel** below shows each
   involved table with the rows the query touched highlighted, and for joins, animated
   lines connecting matched rows (derived from `EXPLAIN` + a re-run of the join keys).
3. **Data Modification** tab: `INSERT/UPDATE/DELETE` presets with a before/after diff of
   the affected table and an "undo" (re-seed).

## Build

- `scripts/build-sql.ts`: MariaDB → SQLite translation (types, `AUTO_INCREMENT`,
  `ENGINE=`), execute to `.sqlite` files (a few KB each), extract query presets with
  their comments as labels. Diagrams → WebP + `hotspots.json`.
- sql.js (~1 MB wasm) loaded when the page mounts; no server.

## Story rail

1. DTU databases course; ER → relational → SQL in one paragraph.
2. Designing the meeting-room and news-items schemas (the two drawings).
3. Weekly query sets: what got hard (nested subqueries, group-by-having, modification
   integrity).

## Manifest (`content/sql/site.ts`)

- displayName "SQL Playground", favicon "🗄️", accent `#0891B2`.
- deepLinks: `/demos/sql#university`, `#family`, `#cinema`, `#modify`.
- techStack: SQL (MariaDB), SQLite/sql.js, ER modeling.
- knowledgePanel facts: Course · Schemas (5) · Queries (~N presets) · Runs in browser.
- keywords: sql, database design, er diagram, sqlite, dtu.

## Attribution

- Exercise prompts are course material; schemas for the weekly sets may be
  instructor-provided (label per file: David-authored = `UniversityDB`, `FamilyDB`,
  `cinema`, drawings; weekly `_database.sql` = provided).

## Out of scope

- MariaDB-specific features that don't translate; large datasets.

## Open questions

None.
