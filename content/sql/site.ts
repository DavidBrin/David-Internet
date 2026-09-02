import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "sql",
  kind: "demo",
  displayName: "SQL Playground",
  fakeDomain: "sql.davids.net",
  liveUrl: "/demos/sql",
  tagline: "Five course databases live in your browser: ER designs, the weekly answer queries, and a modification script with an undo button.",
  description:
    "Interactive demo of the DTU Databases course (fall 2025): five schemas (the Silberschatz University database, the Family warm-up, the Cinema exam, and the week 12-13 Takeaway and Bus Service sets) translated from MariaDB to SQLite at build and running client-side via sql.js (SQLite in WebAssembly). A schema browser draws every database's tables and foreign keys beside David's hand-drawn ER designs; a query runner fires the weekly answer queries, or your own SQL, with the involved tables and touched rows highlighted; and a modification panel replays the bike-shop project's INSERT/UPDATE/DELETE script with before/after diffs, an FK-enforcement toggle, and the week-13 trigger adapted from SIGNAL to RAISE. MariaDB-only features are adapted and disclosed per preset; every preset is fixture-tested against Python's sqlite3.",
  accentColor: "#0891B2",
  favicon: "\u{1F5C4}",
  techStack: ["SQL (MariaDB)", "SQLite", "sql.js (WASM)", "ER modeling", "TypeScript"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#schemas",
      title: "Schema browser + ER designs",
      snippet:
        "Pick a database, see its tables and foreign-key graph drawn live, hover a table to highlight its DDL, next to the hand-drawn meeting-room and news-broadcast ER designs and the bike-shop data sheet.",
      keywords: ["er diagram", "schema", "foreign keys", "ddl", "database design"],
    },
    {
      path: "#queries",
      title: "The query runner",
      snippet:
        "The weekly answer queries as presets (joins, left joins, group-by-having, correlated subqueries, the cinema exam's nine answers), each running live in sql.js, editable, with touched tables highlighted and MariaDB originals shown where adapted.",
      keywords: ["sql query", "joins", "subqueries", "sql.js", "sqlite", "exam"],
    },
    {
      path: "#modify",
      title: "Data modification + triggers",
      snippet:
        "The bike-shop INSERT/UPDATE/DELETE script with before/after diffs and undo, a foreign-key enforcement toggle that changes the ending, and the Bus Service trigger that aborts same-station trips.",
      keywords: ["insert", "update", "delete", "trigger", "foreign keys", "integrity"],
    },
  ],
  images: [],
  videos: [],
  keywords: ["sql", "database design", "er diagram", "sqlite", "sql.js", "dtu", "joins", "triggers"],
  knowledgePanel: {
    type: "Course project demo",
    facts: {
      Course: "Databases, DTU, fall 2025",
      Schemas: "6 (five course DBs + the reconstructed bike shop)",
      Queries: "44 presets from the weekly answer sheets",
      Engine: "sql.js: SQLite compiled to WebAssembly, no server",
      "On this page": "every preset fixture-tested against Python sqlite3",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
