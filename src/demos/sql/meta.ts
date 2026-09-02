import type { DemoMeta } from "@/lib/demos";

const SRC = "demos/sql_src";

const meta: DemoMeta = {
  slug: "sql",
  theme: { bg: "#edf5f7", panel: "#ddeef2" }, // cool cyan - a database console
  what: "five course databases running live in the browser, with the weekly answer queries ready to fire",
  why: "SQL only clicks when you watch a join actually happen, so every query here runs, highlights, and can be edited",
  when: "DTU Databases, fall 2025: ER designs, weekly query sets, and the cinema exam",
  story: [
    {
      title: "From boxes to tables",
      body:
        "The course runs the classic arc: draw the world as entities and relationships, collapse the drawing into relations, then interrogate them in SQL. Two of David's hand-drawn designs survive, a meeting-room booker and a news-broadcast schema (weak entities, role attributes and all), along with the bike-shop project's data sheet. The schema browser below draws every database's tables and foreign keys the same way.",
      anchor: "#schemas",
    },
    {
      title: "Five databases, one browser",
      body:
        "University is the Silberschatz textbook's script; Family is the two-row warm-up; Cinema is the exam database; Takeaway and Bus Service are the week 12-13 exercise sets. All five were MariaDB scripts; for this page they're translated to SQLite and executed at build, and the resulting files load into sql.js (SQLite compiled to WebAssembly), so every query on this page runs in your tab. No server anywhere.",
      anchor: "#schemas",
    },
    {
      title: "The weekly climb",
      body:
        "The presets trace the semester's difficulty curve: plain SELECTs, then natural joins, LEFT joins that keep the empty categories, GROUP BY with HAVING, NOT IN subqueries, and finally the correlated subquery. Week 3's notebook keeps two wrong attempts above the answer that works. Where the original used MariaDB-only machinery (session variables, stored functions, >= ALL), the preset runs an adapted SQLite version and shows the original beside it, labeled.",
      anchor: "#queries",
    },
    {
      title: "An exam in nine queries",
      body:
        "The cinema answer sheet is the December exam: ticket filters, three-way natural joins, income aggregation, movies beating their genre's average, and a stored function counting reserved seats per room. Every one runs here against the same data, and the empty-seats query still has to remember that a seat only counts as free if the room's projection that day didn't sell it.",
      anchor: "#queries",
    },
    {
      title: "Changing data without breaking it",
      body:
        "The modification panel replays the bike-shop project's INSERT / UPDATE / DELETE script with a before/after diff of every touched table and an undo that re-seeds the database. The punchline is the last step: deleting a part that a repair job still references. With foreign keys enforced SQLite refuses; with them off (MariaDB's posture in the course files) it silently orphans the repair; flip the toggle and watch both. Bus Service adds the week-13 trigger, adapted from MariaDB's SIGNAL to SQLite's RAISE, plus the insert that trips it.",
      anchor: "#modify",
    },
    {
      title: "What was reconstructed (built 2026-09-01)",
      body:
        "Honesty box: the bike-shop DDL was never archived (only the data sheet and the modification script survive), so its schema and seed rows were reconstructed for this page (labeled in the schema browser). MariaDB-to-SQLite adaptations are disclosed per preset with the originals shown. The vendored answer files have the student ID scrubbed. Every preset's results are fixture-tested: the build runs them through Python's sqlite3 and the page's sql.js path must match. TS widgets written with AI coding tools.",
    },
  ],
  sources: [
    { name: "UniversityDB.sql", path: `${SRC}/UniversityDB.sql`, lang: "sql", note: "The textbook script (Silberschatz et al.) the course ships: 11 tables with FK cascade rules, plus seed data." },
    { name: "cinema.sql", path: `${SRC}/cinema.sql`, lang: "sql", note: "The exam database: rooms, seats, movies, projections, tickets." },
    { name: "answers.sql", path: `${SRC}/answers.sql`, lang: "sql", note: "David's cinema exam answers (q1-q9), including the view + session variable and the stored function the page adapts." },
    { name: "week3.sql + week4.sql", path: `${SRC}/week3.sql`, lang: "sql", note: "University exercises, including the wrong attempts left above the working correlated subquery." },
    { name: "w12 answers", path: `${SRC}/w12_part1_answers_complete.sql`, lang: "sql", note: "Takeaway: left joins, groupwise max, NOT IN chains, the total-cost stored function." },
    { name: "w13 answers", path: `${SRC}/w13_part1_answers_complete.sql`, lang: "sql", note: "Bus Service: left joins and the SIGNAL trigger the page adapts to RAISE." },
    { name: "Data Modification.sql", path: `${SRC}/Data_Modification.sql`, lang: "sql", note: "The bike-shop modification script, the reason the schema had to be reconstructed." },
    { name: "prep script", path: "scripts/demos/sql_prep.py", lang: "python", note: "Build-time prep: MariaDB->SQLite translation, .sqlite builds, preset curation with adaptations, ER drawing compression, the preset fixture." },
  ],
  sourceFooter:
    "DTU Databases course, fall 2025. UniversityDB.sql is the course's version of the Database System Concepts (Silberschatz, Korth, Sudarshan) university database; Takeaway and Bus Service schemas are instructor-provided; cinema.sql, FamilyDB.sql, the answer files, the ER drawings and the bike-shop design are David's. Exercise prompts are course material. Runs on sql.js (SQLite in WebAssembly).",
};

export default meta;
