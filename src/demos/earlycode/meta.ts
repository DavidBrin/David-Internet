import type { DemoMeta } from "@/lib/demos";

const SRC = "demos/earlycode_src";

const meta: DemoMeta = {
  slug: "earlycode",
  theme: { bg: "#f0f1f3", panel: "#e3e5ea" }, // terminal grey, cooling toward slate
  what: "the first programs, each with a live widget - from a 2021 C++ number tally to a from-scratch Aho-Corasick automaton",
  why: "every stack has a bottom layer - this page runs it: the first file ever read, the first URL ever parsed, the first test that failed on purpose",
  when: "2021-2024: C++ summer course, CSE 12/15L Java, CSE 100 algorithms, a first PyTorch tutorial",
  story: [
    {
      title: "2021: programs that read things",
      body:
        "The first course was C++ in summer 2021 - ten homeworks in six weeks, from 'Hello, my name is David Brin' to arrays and file I/O, with Doxygen configs already in hw1. The final read a numbers file and tallied occurrences up to a user-chosen max. The terminal below runs a faithful TypeScript port of that final over the actual shipped numbers files - including its quirks: the header line silently swallowed, out-of-range numbers read but not counted, and the 'most frequent' answer when every count is zero.",
      anchor: "#cpp",
    },
    {
      title: "2024: data structures with a grade attached",
      body:
        "CSE 12 made the containers personal: build MyArrayList yourself - backing array, size-vs-capacity, the shifting that insert and remove really do - and rock-paper-scissors as an exercise in interfaces and modular arithmetic (winner = (loser + 1) mod moves, which generalizes past three moves for free). The visualizer below animates David's MyArrayList doing its shifts and grows, and the RPS game plays against his actual winner logic.",
      anchor: "#cse12",
    },
    {
      title: "A URL is just a string",
      body:
        "CSE 15L handed out a tiny HTTP server - 'wavelet', 53 lines around Java's built-in HttpServer, course-provided - and the assignment was the Handler: parse the path, split the query on [=&], build the response. The replay below runs David's chat and doc-search handlers faithfully in TypeScript, including the chat handler's quirks (visiting / clears the chat and increments a counter). The search corpus is a 30-document synthetic stand-in - the real OANC corpus isn't shipped.",
      anchor: "#servers",
    },
    {
      title: "The bug was the assignment",
      body:
        "The JUnit lab ships a merge() with a planted bug - the second drain loop increments the WRONG index, so one test passes and the other spins until its 500 ms timeout kills it. The comment in the file says exactly how to fix it. The widget below runs both tests against the TS port, red timeout and all, then lets you apply the one-line fix and watch them both go green. First contact with the idea that tests are executable claims.",
      anchor: "#servers",
    },
    {
      title: "CSE 100: what the library call hides",
      body:
        "The algorithms-era notebook is three cells: install pyahocorasick, feed it eleven Fast & Furious titles, print that the automaton has 106 nodes. That's the whole notebook - the library does everything. The widget below is this page's from-scratch implementation of what those cells hide: watch the trie grow node by node, failure links attach in BFS order, and a cursor walk your text emitting (end, pattern) tuples - the exact shape pyahocorasick returns. Same titles, same node count: 106.",
      anchor: "#aho",
    },
    {
      title: "The bridge to the deep-learning pages (built 2026-09-01)",
      body:
        "The last artifact is CardClassifier.ipynb - a PyTorch tutorial follow-along (EfficientNet-B0 via timm, 53 playing-card classes) that leads straight to the CV and cross-teaching pages. Honesty box: the Kaggle dataset isn't on disk, so nothing was re-run and no predictions ship - the notebook is referenced, not demonstrated. Everything live on this page is a disclosed TypeScript port (C++ final, handlers, merge lab, MyArrayList, RPS); the Aho-Corasick automaton and the C++ port are fixture-tested against Python references. Widgets written with AI coding tools.",
      anchor: "#aho",
    },
  ],
  sources: [
    { name: "final main.cpp", path: `${SRC}/final_main.cpp`, lang: "cpp", note: "The 2021 C++ final: readNumbersAndTallyOccurrences, printCounts, findMostAndLeastOccurrence. The terminal runs its TS port, quirks preserved." },
    { name: "ChatServer.java", path: `${SRC}/ChatServer.java`, lang: "java", note: "David's chat Handler on the course's wavelet server: / shows (and quirkily resets) the chat, /add-message parses the query by hand." },
    { name: "DocSearchServer.java", path: `${SRC}/DocSearchServer.java`, lang: "java", note: "David's search Handler: walk ./technical/, substring-match every file against ?q=. The page uses a synthetic 30-doc corpus." },
    { name: "Server.java", path: `${SRC}/Server.java`, lang: "java", note: "The course-provided HTTP plumbing ('wavelet', by the CSE 15L staff) - 53 lines around com.sun.net.httpserver. Not David's code; shown for context." },
    { name: "ListExamples.java + tests", path: `${SRC}/ListExamples.java`, lang: "java", note: "The JUnit lab's merge() with the planted wrong-index bug (the fix is in the comment); the widget replays the pass/timeout/fix cycle." },
    { name: "MyArrayList.java", path: `${SRC}/MyArrayList.java`, lang: "java", note: "David's CSE 12 ArrayList: backing Object[], capacity doubling, the shifting loops the visualizer animates. PID scrubbed." },
    { name: "RPS.java", path: `${SRC}/RPS.java`, lang: "java", note: "David's rock-paper-scissors: winner = (loser + 1) mod moves - the game widget uses this exact determineWinner." },
    { name: "aho notebook", path: `${SRC}/aho_extract.py`, lang: "python", note: "The CSE 100 notebook, all three cells: pyahocorasick does the work and reports 106 nodes. The page's from-scratch aho.ts shows what it hides." },
    { name: "card classifier notebook", path: `${SRC}/cardclassifier_extract.py`, lang: "python", note: "The PyTorch tutorial follow-along (EfficientNet-B0, 53 card classes) - referenced, not re-run: the dataset isn't on disk." },
    { name: "aho.ts", path: "src/demos/earlycode/core/aho.ts", lang: "ts", note: "The from-scratch automaton: trie, BFS failure links, dict-suffix emits - fixture-tested against a pure-Python reference, 106 nodes and all." },
    { name: "cppfinal.ts", path: "src/demos/earlycode/core/cppfinal.ts", lang: "ts", note: "The C++ final's TS port, quirks documented and fixture-tested over the shipped numbers files." },
    { name: "prep script", path: "scripts/demos/earlycode_prep.py", lang: "python", note: "Build-time prep: numbers files (large one truncated), synthetic corpus, CSE 12 gather + scrub, notebook extracts, Python-reference fixtures." },
  ],
  sourceFooter:
    "David's coursework, 2021-2024. Server.java ('wavelet') is course-provided (UCSD CSE 15L staff); the ListExamples JUnit lab and the RPS/MyArrayList scaffolds are course starters with David's implementations; the OANC technical corpus is not shipped (synthetic stand-in, labeled); the Aho-Corasick notebook used pyahocorasick - the page's implementation is new; CardClassifier follows a public PyTorch tutorial. Student PID/email scrubbed from vendored sources.",
};

export default meta;
