import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "earlycode",
  kind: "demo",
  displayName: "Early Code",
  fakeDomain: "earlycode.davids.net",
  liveUrl: "/demos/earlycode",
  tagline: "The bottom layer of the stack, running: the first C++ final, hand-parsed URLs, a planted JUnit bug, and Aho-Corasick built from scratch.",
  description:
    "A timeline of David's earliest programs (2021-2024), each with a live widget: the 2021 C++ final re-running over its actual numbers files in a fake terminal (quirks preserved and documented); CSE 12's MyArrayList animated through its inserts, shifts and capacity doubling, plus rock-paper-scissors against the original winner logic; the CSE 15L chat and doc-search URL handlers replayed request by request on a mini browser (the course-provided 'wavelet' server credited as such); the JUnit lab's planted merge() bug failing by timeout and then fixed; and the centerpiece - an Aho-Corasick automaton implemented from scratch for the page, growing its trie and failure links live and matching the CSE 100 notebook's Fast & Furious titles with the same 106 nodes the pyahocorasick library reported. Ends at CardClassifier.ipynb, the PyTorch tutorial that bridges to the deep-learning pages (referenced, not re-run - its dataset isn't archived).",
  accentColor: "#64748B",
  favicon: "\u{1F9F1}",
  techStack: ["C++", "Java", "JUnit", "Python", "TypeScript"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#cpp",
      title: "The C++ final, in a terminal",
      snippet:
        "Pick a shipped numbers file, set the max, and the 2021 final's TS port tallies line by line into a growing histogram - header-swallowing quirk, out-of-range reads and all.",
      keywords: ["c++", "file reading", "histogram", "first program", "terminal"],
    },
    {
      path: "#cse12",
      title: "MyArrayList + RPS",
      snippet:
        "David's CSE 12 ArrayList animated: append, insert-with-shift, remove, capacity doubling - and rock-paper-scissors against his (loser+1) mod moves winner logic, extra moves included.",
      keywords: ["arraylist", "data structures", "rock paper scissors", "java", "cse 12"],
    },
    {
      path: "#servers",
      title: "URL handlers + the JUnit lab",
      snippet:
        "Type /add-message?s=hello&user=david into a mini browser and watch the handler branch highlight and respond; then run the lab's planted merge() bug to a red timeout and apply the one-line fix.",
      keywords: ["http server", "url parsing", "junit", "timeout", "chat server", "doc search"],
    },
    {
      path: "#aho",
      title: "Aho-Corasick, from scratch",
      snippet:
        "The trie grows node by node, failure links attach in BFS order, and a cursor walks your text emitting (end, pattern) tuples - 106 nodes, same as the notebook's library call reported.",
      keywords: ["aho-corasick", "string matching", "automaton", "trie", "failure links", "cse 100"],
    },
  ],
  images: [],
  videos: [],
  keywords: ["c++", "java", "http server", "junit", "aho-corasick", "string matching", "arraylist", "early projects"],
  knowledgePanel: {
    type: "Origins demo",
    facts: {
      Era: "2021-2024, first courses",
      Languages: "C++, Java, Python",
      "Live widgets": "5 (all disclosed TS ports)",
      Centerpiece: "from-scratch Aho-Corasick - 106 nodes, matching the notebook's library count",
      "On this page": "fixture-tested against Python references; course-provided code credited",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
