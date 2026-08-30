# 15 — Early Code (C++ 2021 · Java servers · Aho-Corasick · card classifier)

Slug: `earlycode` · Fake domain: `earlycode.davids.net` · Archetype: **A** (small live widgets) + timeline
Status: spec agreed 2026-08-30; **not built**.

Kept as its own page (see `14_early_3d_modeling.md` for why it wasn't merged).

## Summary

A timeline page of the first programs, each with one live widget: an **Aho-Corasick**
automaton built and animated from scratch (the CSE 100 notebook used `pyahocorasick`;
the page implements the algorithm to show what the library does), the **Java URL
handlers** (chat + document search) replayed as browser ⇄ server exchanges over the
course's tiny `Server.java`, the **C++ file-statistics final** running in TS over the
shipped `numbers-*.txt`, and a **card-classifier** reel. Visual style: terminal-era
(monospace, cursor blink) that gradually modernizes down the page.

## Source material

| Folder / file | Year | Widget | Notes |
|---|---|---|---|
| `cpp_2021_raw/final/main.cpp` (+ `numbers-*.txt`, `FinalA.txt`), `hw1–hw10/main.cpp`, `hello world`, Doxygen configs | 2021 | C++ final: read a numbers file, tally occurrences up to a user max, print counts, most/least frequent, total | First course; hw set shown as a strip of "what each hw did" |
| `java_servers_raw/wavelet_chat_server/ChatServer.java` (+ README) | ~2023 (CSE 15L era) | `Handler implements URLHandler`: `/` shows messages, `/add-message?s=…&user=…` appends | **`Server.java` is course-provided** ("wavelet", by the course staff); the README references it. David wrote the handler. The missing `Server.java` in that folder is in `doc_search_server/` |
| `java_servers_raw/doc_search_server/{DocSearchServer.java, Server.java, README.md}` | ~2023 | `/search?q=…` over the OANC `technical/` corpus | Corpus not shipped; a 30-document synthetic corpus stands in |
| `java_servers_raw/junit_lab/{ListExamples.java, ListExamplesTests.java}` | ~2023 | "Run tests" badge only | JUnit lab |
| `misc_snippets_raw/aho_corasick_string_matching.ipynb` (CSE 100) | 2024 | Aho-Corasick: the notebook's *Fast & Furious* title list as patterns | Library-based in the notebook → from-scratch TS here, stated |
| `misc_snippets_raw/CardClassifier.ipynb` | 2024 | Playing-card image classifier (PyTorch tutorial follow-along) | Precomputed predictions on ~20 sample cards; labeled as a tutorial |
| `OneDrive/Documents/UCSD classes/CSE 12/` (ArrayList PA, RPS, Java discussion) | 2024 | MyArrayList visualizer + RPS game | Gather into `java_servers_raw/cse12/` at build (decided 2026-08-30) |

## Stage (timeline order)

### 1. C++ 2021 — the number-file final
- A fake terminal: pick one of the shipped `numbers-*.txt`, type the max, and the TS
  port of `main.cpp` runs — tallies animate into a histogram as the file is "read" line
  by line; most/least frequent highlighted; the `numbers-none` cases show the error
  paths. The original C++ scrolls in sync (function highlights:
  `readNumbersAndTallyOccurrences` → `printCounts` → `findMostAndLeastOccurrence`).
- Strip of hw1–hw10 one-liners (from a quick read of each `main.cpp` at build; David
  can edit).

### 2. Java servers — request/response replay
- Split view: a mini browser (URL bar) and the server log. Type
  `/add-message?s=hello&user=david` → the request travels to the server box, the
  handler code highlights the branch it takes (`getPath()` / `getQuery().split("[=&]")`),
  the response renders in the mini browser; the message list grows. Same for
  `/search?q=…` over the stand-in corpus (results with the matching line).
- Caption: "`Server.java` (the HTTP plumbing) was provided by the course; the handlers
  are mine." A "run JUnit" button flips the `ListExamplesTests` badge to green (results
  computed at build by actually running the tests).

### 3. Aho-Corasick — the star
- Patterns list (defaults: the notebook's Fast & Furious titles; editable). **Build:**
  the trie grows node by node; then failure links are computed BFS-order and drawn as
  dashed arcs (animated), output links merge. **Match:** type/paste a text; a cursor
  walks it, the automaton's current node lights, failure jumps animate, and matches
  pop as highlights in the text with (end index, pattern) pairs — the same tuples
  `pyahocorasick` returns in the notebook, shown for comparison.
- Complexity caption: O(n + m + z).

### 4. Card classifier reel
- ~20 sample card images with the model's top-3 predictions (precomputed at build by
  re-running the notebook if the tutorial dataset is on disk; else omitted); a
  confusion mini-matrix. Labeled as a tutorial follow-along.

## Story rail

1. 2021: first language, first files, Doxygen — "programs that read things".
2. Servers: a URL is just a string; parsing it by hand; what a course-provided
   server taught about HTTP.
3. Tests: JUnit as the first habit.
4. Algorithms: CSE 100 and Aho-Corasick — why a library call hides a beautiful automaton.
5. First ML tutorial (cards) — the bridge to the CV/DL pages.

## Assets (`public/demos/earlycode/`)

- `numbers/*.txt` (tiny), `corpus.json` (synthetic 30 docs), `aho/defaults.json`,
  `cards/*.webp` + `cards/preds.json` (if available), `junit.json`.

## Manifest (`content/earlycode/site.ts`)

- displayName "Early Code", favicon "🧱", accent `#64748B`.
- deepLinks: `/demos/earlycode#cpp`, `#servers`, `#aho`, `#cards`.
- techStack: C++, Java, JUnit, Python, TypeScript.
- knowledgePanel facts: Era (2021–2024) · Languages (3) · Live widgets (3).
- keywords: c++, java, http server, junit, aho-corasick, string matching, early projects.

## Attribution

- `Server.java`: course-provided (CSE 15L "wavelet"); OANC corpus not shipped.
- Aho-Corasick notebook used `pyahocorasick`; the page's implementation is new.
- Card classifier: PyTorch tutorial follow-along (say so).

## Out of scope

- Running Java/C++ in the browser (TS ports only), the OANC corpus.

## Resolved questions (2026-08-30)

1. **CSE 12 Java added** (David, 2026-08-30): gather
   `OneDrive/Documents/UCSD classes/CSE 12/` (ArrayList PA, RPS, discussion code) into
   `demos/java_servers_raw/cse12/` at build; widget: a **MyArrayList** visualizer (add /
   insert / remove animate the backing array growing and shifting) and the RPS game
   played against the shipped logic. Timeline slot between C++ 2021 and the servers.
2. Card-classifier dataset: check disk at build; if absent, the reel is omitted and the
   notebook is only referenced.
