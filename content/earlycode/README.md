# Early Code — demo notes

Live demo: `/demos/earlycode` · manifest: `content/earlycode/site.ts` · stage: `src/demos/earlycode/`

## What's on the page

A timeline, one era per panel, styling modernizing down the page:

- **#cpp** — the 2021 C++ final in a fake terminal: pick a shipped numbers
  file, set the max, watch the TS port tally into a histogram with the
  original's quirks preserved (header line swallowed, out-of-range numbers
  read but untallied, "most frequent = 0" when nothing tallies). hw1-hw10
  one-liner strip from `hw.json`.
- **#cse12** — David's MyArrayList animated (append/insert/remove/capacity
  doubling with visible shifts) and RPS played against his actual
  `(loser + 1) mod moves` winner logic.
- **#servers** — the CSE 15L handlers replayed: mini browser + server log,
  the handler branch highlighting per request (chat quirks intact: visiting
  `/` clears the chat), doc search over a 30-doc synthetic corpus; and the
  JUnit lab's planted merge() bug — one green test, one 500 ms timeout, then
  the one-line fix.
- **#aho** — the star: Aho-Corasick implemented from scratch (core/aho.ts):
  trie build animation, BFS failure links, live matching with (end, pattern)
  tuples. 106 nodes — exactly the count the notebook's pyahocorasick call
  reported.

## Honesty notes

- All live widgets are disclosed TypeScript ports; `core/aho.ts` and
  `core/cppfinal.ts` are fixture-tested against pure-Python references run at
  build (`tests/earlycode-core.test.ts`).
- `Server.java` ("wavelet") is course-provided (CSE 15L staff) and credited
  as such; David wrote the handlers.
- The doc-search corpus is synthetic (30 invented technical snippets) — the
  real OANC corpus is not shipped, and the page says so.
- The CSE 100 notebook only *counts nodes* via pyahocorasick (3 cells); the
  page's automaton build/match/animation is new work, stated.
- **Card classifier**: the Kaggle dataset is not on disk → per the resolved
  spec question, no reel ships; CardClassifier.ipynb is referenced in the
  story rail + Source drawer only (a PyTorch tutorial follow-along).
- CSE 12 files are gathered from OneDrive into `demos/java_servers_raw/cse12/`
  at build with the student PID and email scrubbed; `numbers-large.txt` ships
  truncated to 300 lines (disclosed).
- Built 2026-09-01 with AI coding tools, disclosed in the story rail.

## Building

`pnpm sync-demos earlycode` — needs `py -3.12` (stdlib only). Ships numbers
files, synthesizes the corpus, gathers + scrubs CSE 12 Java, extracts the
notebooks, writes `hw.json`, `aho/defaults.json` and the fixtures.

## Attribution

David's coursework 2021-2024 (C++ summer course; UCSD CSE 12, 15L, 100).
Course-provided scaffolds credited in the source footer. CardClassifier
follows a public PyTorch tutorial (says so on the page).
