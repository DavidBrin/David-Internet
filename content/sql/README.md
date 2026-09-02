# SQL Playground — demo notes

Live demo: `/demos/sql` · manifest: `content/sql/site.ts` · stage: `src/demos/sql/`

## What's on the page

- **#schemas** — schema browser: six databases (University, Family, Cinema,
  Takeaway, Bus Service, Bike Shop) with live table/FK graphs drawn from
  `schemas.json`, DDL hover-linking, and the surviving design artifacts —
  David's hand-drawn meeting-room and news-broadcast ER designs plus the
  bike-shop data sheet.
- **#queries** — the query runner: 34 weekly answer queries as presets, each
  running live in sql.js (SQLite in WebAssembly, no server), editable, with
  the involved tables and touched rows highlighted. Adapted presets show the
  MariaDB original beside the SQLite version.
- **#modify** — the bike-shop INSERT/UPDATE/DELETE script (10 steps) with
  before/after diffs and undo (re-seed), a foreign-key enforcement toggle,
  and the week-13 trigger (SIGNAL -> RAISE) plus the insert that trips it.

## Honesty notes

- **MariaDB -> SQLite**: all five course scripts were MariaDB; the build
  translates them (ENUM->TEXT, YEAR->INTEGER, `INSERT t VALUES`->`INSERT INTO`,
  database statements stripped) and executes with Python's sqlite3. Presets
  using MariaDB-only features are adapted and labeled, originals shown:
  session variables (@aveinc) -> CTE; stored functions -> correlated
  subqueries; `>= ALL` / `<= ALL` -> max()/min() subqueries; SIGNAL triggers
  -> RAISE(ABORT).
- **The bike-shop schema is reconstructed** (2026-09-01): only the Data Sheet
  and Data Modification script survive — the group's DDL was never archived.
  Schema + seed rows rebuilt from those two files; parts/repairs invented to
  satisfy the script. Labeled in the schema browser and the story rail.
- The vendored answer files have the student ID scrubbed (`s******`).
- Every preset is fixture-tested: build-time Python sqlite3 results vs the
  page's sql.js path (`tests/sql-core.test.ts`).
- The ER drawings are design exercises (meeting room, news items) — they do
  not correspond to the shipped schemas, and the page says so.
- Built 2026-09-01 with AI coding tools, disclosed in the story rail.

## Building

`pnpm sync-demos sql` — needs `py -3.12` with Pillow (sqlite3 is stdlib) and
`node_modules/sql.js` (the wrapper copies `sql-wasm.wasm` into the assets).
Regenerates the .sqlite files, presets/schemas JSON, WebP images, vendored
sources and the preset fixture.

## Attribution

DTU Databases, fall 2025. `UniversityDB.sql` is the course's version of the
Silberschatz/Korth/Sudarshan textbook database. Takeaway + Bus Service
schemas are instructor-provided; exercise prompts are course material.
`cinema.sql`, `FamilyDB.sql`, the answer files, the ER drawings and the
bike-shop design are David's. Engine: sql.js.
