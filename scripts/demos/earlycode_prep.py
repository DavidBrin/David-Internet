# -*- coding: ascii -*-
"""Early Code demo prep (run via scripts/demos/earlycode.ts -> py -3.12).

argv: rawRoot (demos/), outDir (public/demos/earlycode), repoRoot.

  1. ships the C++ final's numbers files (numbers-large.txt truncated to its
     first 300 lines, disclosed) and writes the cpp-final fixture by running a
     Python replica of main.cpp's logic (quirks preserved),
  2. writes the Aho-Corasick fixture from a pure-Python reference
     implementation (trie + BFS failure links + dict-suffix emits, matching
     pyahocorasick's iterator semantics) over the notebook's Fast & Furious
     patterns - also records the node count to compare with the notebook's 106,
  3. synthesizes the 30-document stand-in corpus for the doc-search server
     (the OANC technical/ corpus is not shipped),
  4. gathers David's CSE 12 Java (RPS, MyArrayList, week-1 discussion) from
     OneDrive into demos/java_servers_raw/cse12/ (resolved 2026-08-30), with
     PID/email scrubbed,
  5. vendors drawer sources into demos/earlycode_src/ (cpp final, java
     servers, junit lab, notebook extracts) and writes hw one-liners +
     aho defaults JSON.

Console is cp1252: ASCII-only prints.
"""
import json
import os
import re
import sys
from collections import deque

RAW = sys.argv[1]
OUT = sys.argv[2]
REPO = sys.argv[3]
CPP = os.path.join(RAW, "cpp_2021_raw")
JAVA = os.path.join(RAW, "java_servers_raw")
MISC = os.path.join(RAW, "misc_snippets_raw")
CSE12_SRC = r"C:\Users\david\OneDrive\Documents\UCSD classes\CSE 12"
CSE12_DST = os.path.join(JAVA, "cse12")
SRC_DIR = os.path.join(REPO, "demos", "earlycode_src")
FIX_DIR = os.path.join(REPO, "tests", "fixtures")

SCRUB = [("A17749909", "A1*******"), ("dabrin@ucsd.edu", "d*****@ucsd.edu")]


def read(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def scrub(text):
    for a, b in SCRUB:
        text = text.replace(a, b)
    return text


# ------------------------------------------------------------- 1. cpp final

def cpp_parse(text):
    lines = text.split("\n", 1)
    rest = lines[1] if len(lines) > 1 else ""
    nums = []
    for tok in rest.split():
        try:
            nums.append(int(tok))
        except ValueError:
            pass
    return nums


def cpp_run(text, input_max):
    nums = cpp_parse(text)
    occ = [0] * input_max
    total = 0
    for n in nums:
        if 1 <= n <= input_max:
            occ[n - 1] += 1
        total += 1
    if total == 0:
        return {"total": 0, "occurrences": occ, "inRange": 0, "highest": 0, "lowest": 0, "empty": True}
    cur1, cur2, hi, lo = 0, 99999999, 0, 0
    for ind, c in enumerate(occ):
        if c > cur1:
            cur1, hi = c, ind + 1
        if c < cur2:
            cur2, lo = c, ind + 1
    return {"total": total, "occurrences": occ, "inRange": sum(occ), "highest": hi, "lowest": lo, "empty": False}


def prep_cpp():
    files = {}
    for name in ["numbers1.txt", "numbers2.txt", "numbers3.txt", "numbers-none.txt", "numbers-none2.txt"]:
        files[name] = read(os.path.join(CPP, "final", name))
    large_lines = read(os.path.join(CPP, "final", "numbers-large.txt")).splitlines()
    files["numbers-large-trunc.txt"] = "\n".join(large_lines[:301]) + "\n"  # header + 300 data lines
    for name, text in files.items():
        write(os.path.join(OUT, "numbers", name), text)
    cases = []
    for name, mx in [("numbers1.txt", 10), ("numbers2.txt", 100), ("numbers2.txt", 5),
                     ("numbers3.txt", 20), ("numbers-none.txt", 5), ("numbers-none2.txt", 5),
                     ("numbers-large-trunc.txt", 50), ("numbers-large-trunc.txt", 10)]:
        r = cpp_run(files[name], mx)
        cases.append({"file": name, "max": mx, **r})
    total_kb = sum(len(t) for t in files.values()) // 1024
    print("numbers files shipped (%d KB, large truncated to 300 lines); %d cpp fixture cases" % (total_kb, len(cases)))
    return cases


# ------------------------------------------------------------- 2. aho

PATTERNS = ["TheFastAndTheFurious", "2Fast2Furious", "TheFastAndTheFuriousTokyoDpift",
            "FastAndFurious", "FastFive", "FastAndFurious6", "Furious7",
            "TheFateOfTheFurious", "FastAndFuriousPresentshobbsAndShaw", "F9", "FastX"]


class Node:
    __slots__ = ("children", "fail", "dict", "word")

    def __init__(self):
        self.children = {}
        self.fail = 0
        self.dict = -1
        self.word = None


def aho_build(patterns):
    nodes = [Node()]
    for pat in patterns:
        cur = 0
        for ch in pat:
            nxt = nodes[cur].children.get(ch)
            if nxt is None:
                nxt = len(nodes)
                nodes.append(Node())
                nodes[cur].children[ch] = nxt
            cur = nxt
        nodes[cur].word = pat
    q = deque()
    for cid in nodes[0].children.values():
        nodes[cid].fail = 0
        q.append(cid)
    while q:
        nid = q.popleft()
        node = nodes[nid]
        for ch, cid in node.children.items():
            f = node.fail
            while f != 0 and ch not in nodes[f].children:
                f = nodes[f].fail
            target = nodes[f].children.get(ch)
            nodes[cid].fail = target if (target is not None and target != cid) else 0
            q.append(cid)
        fn = nodes[node.fail]
        node.dict = node.fail if fn.word is not None else fn.dict
    return nodes


def aho_match(nodes, text):
    out = []
    s = 0
    for i, ch in enumerate(text):
        while s != 0 and ch not in nodes[s].children:
            s = nodes[s].fail
        s = nodes[s].children.get(ch, 0)
        d = s if nodes[s].word is not None else nodes[s].dict
        while d not in (-1, 0):
            if nodes[d].word is not None:
                out.append([i, nodes[d].word])
            d = nodes[d].dict
    return out


def prep_aho():
    nodes = aho_build(PATTERNS)
    n = len(nodes)
    texts = [
        "TheFastAndTheFuriousTokyoDpift",             # nested: contains TheFastAndTheFurious
        "watchFastAndFurious6thenFuriousSeven",        # FastAndFurious inside FastAndFurious6
        "F9FastXF9",                                   # short overlapping hits
        "TheFateOfTheFuriousFastFive2Fast2Furious",    # back to back
        "nothing to see here",                         # no hits
        "FastAndFuriousPresentshobbsAndShaw",          # the long one (contains FastAndFurious)
        "FFastFastAFastAndFastAndFurious",             # near misses then a hit
    ]
    cases = [{"text": t, "matches": aho_match(nodes, t)} for t in texts]
    fx = {"patterns": PATTERNS, "nodeCount": n, "notebookNodeCount": 106, "cases": cases}
    defaults = {"patterns": PATTERNS, "nodeCount": n, "notebookNodeCount": 106,
                "demoText": "TheFastAndTheFuriousTokyoDpift was on, then FastAndFurious6, then F9."}
    write(os.path.join(OUT, "aho", "defaults.json"), json.dumps(defaults))
    print("aho: %d nodes (notebook counted 106); %d fixture cases, %d total matches"
          % (n, len(cases), sum(len(c["matches"]) for c in cases)))
    return fx


# ------------------------------------------------------------- 3. corpus

TOPICS = [
    ("graphics/render-pipeline", "The render pipeline batches draw calls before the GPU consumes them. Vertex buffers are uploaded once and reused across frames."),
    ("graphics/color-spaces", "Linear color blending avoids the darkening artifacts of gamma-space math. Convert to sRGB only at output."),
    ("networking/tcp-handshake", "A TCP connection opens with a three-way handshake: SYN, SYN-ACK, ACK. Retransmission timers guard every step."),
    ("networking/http-caching", "HTTP caching relies on ETag and Cache-Control headers. A conditional GET returns 304 when nothing changed."),
    ("networking/dns-resolution", "DNS resolution walks from root servers to authoritative ones. Resolvers cache records for their TTL."),
    ("databases/btree-indexes", "A B-tree index keeps keys sorted in wide nodes so lookups touch few pages. Range scans walk the leaves."),
    ("databases/transactions", "Transactions guarantee atomicity and isolation. Write-ahead logging makes committed work durable."),
    ("databases/normalization", "Normalization removes update anomalies by splitting tables. Third normal form is the usual resting point."),
    ("os/scheduling", "The scheduler multiplexes cores across runnable threads. Priorities decay so no thread starves."),
    ("os/virtual-memory", "Virtual memory maps pages lazily; a page fault pulls data from disk. The TLB caches recent translations."),
    ("os/file-systems", "Journaling file systems replay their log after a crash. Inodes hold metadata; directories map names to them."),
    ("compilers/lexing", "The lexer turns characters into tokens with a deterministic finite automaton. Longest match wins."),
    ("compilers/parsing", "A recursive-descent parser mirrors the grammar in code. Precedence climbing handles expressions cleanly."),
    ("compilers/register-allocation", "Register allocation colors the interference graph. Spilling moves the coldest values to the stack."),
    ("security/hashing", "Password storage uses slow salted hashes. A rainbow table is useless against unique salts."),
    ("security/tls-certificates", "TLS certificates chain to a trusted root. The server proves possession of its private key during the handshake."),
    ("ml/gradient-descent", "Gradient descent follows the negative gradient in small steps. Learning-rate schedules tame the endgame."),
    ("ml/overfitting", "Overfitting memorizes the training set. Validation curves reveal it; regularization and more data fight it."),
    ("ml/embeddings", "Embeddings place discrete items in a vector space where distance means similarity. Nearest neighbors become search."),
    ("hardware/cache-lines", "CPUs fetch memory in cache lines; strided access wastes most of each line. Structure layout decides bandwidth."),
    ("hardware/pipelining", "Instruction pipelines overlap fetch, decode and execute. Branch mispredictions flush the work in flight."),
    ("hardware/adc-sampling", "An ADC samples above the Nyquist rate or aliases forever. Anti-aliasing filters cut what sampling cannot keep."),
    ("algorithms/dijkstra", "Dijkstra grows a frontier of settled vertices by smallest distance. A binary heap keeps extraction cheap."),
    ("algorithms/dynamic-programming", "Dynamic programming trades memory for repeated work. Order the subproblems and the table fills itself."),
    ("algorithms/string-matching", "Aho-Corasick matches many patterns in one pass by adding failure links to a trie. KMP is the single-pattern case."),
    ("web/event-loop", "The event loop runs callbacks to completion; long tasks freeze the page. Microtasks drain before the next render."),
    ("web/dom-diffing", "Virtual DOM diffing reconciles trees by key. Stable keys turn moves into cheap reorders."),
    ("robotics/pid-control", "A PID controller sums proportional, integral and derivative terms. Integral windup needs clamping."),
    ("robotics/dead-reckoning", "Dead reckoning integrates wheel odometry and drifts without landmarks. Sensors close the loop."),
    ("testing/unit-tests", "A unit test isolates one behavior with a fast, deterministic check. Timeouts catch the infinite loops."),
]


def prep_corpus():
    docs = [{"path": "technical/%s.txt" % slug, "text": text} for slug, text in TOPICS]
    write(os.path.join(OUT, "corpus.json"), json.dumps({
        "note": "Synthetic 30-document stand-in - the real corpus (OANC technical/) is not shipped.",
        "docs": docs,
    }))
    print("corpus.json: %d synthetic docs" % len(docs))


# ------------------------------------------------------------- 4. cse12 gather

CSE12_FILES = [
    ("cse12-wi24-pa1-RPS-starter-main/cse12-wi24-pa1-RPS-starter-main/starter/RPS.java", "RPS.java"),
    ("cse12-wi24-pa1-RPS-starter-main/cse12-wi24-pa1-RPS-starter-main/starter/RPSAbstract.java", "RPSAbstract.java"),
    ("cse12-wi24-pa1-RPS-starter-main/cse12-wi24-pa1-RPS-starter-main/starter/RPSInterface.java", "RPSInterface.java"),
    ("cse12-wi24-pa2-ArrayList-starter-main/cse12-wi24-pa2-ArrayList-starter-main/starter/MyArrayList.java", "MyArrayList.java"),
    ("cse12-wi24-pa2-ArrayList-starter-main/cse12-wi24-pa2-ArrayList-starter-main/starter/MyList.java", "MyList.java"),
    ("cse12-wi24-pa2-ArrayList-starter-main/cse12-wi24-pa2-ArrayList-starter-main/starter/MyArrayListPublicTester.java", "MyArrayListPublicTester.java"),
    ("week1Discussion-main/week1Discussion-main/DemoArray.java", "DemoArray.java"),
    ("week1Discussion-main/week1Discussion-main/DemoArrayImpl.java", "DemoArrayImpl.java"),
]


def prep_cse12():
    copied = 0
    for rel, name in CSE12_FILES:
        src = os.path.join(CSE12_SRC, rel)
        if not os.path.exists(src):
            print("MISSING cse12 file: %s" % rel)
            continue
        write(os.path.join(CSE12_DST, name), scrub(read(src)))
        copied += 1
    print("cse12 gathered: %d files into demos/java_servers_raw/cse12/ (PID/email scrubbed)" % copied)


# ------------------------------------------------------------- 5. sources

def extract_notebook(path, out_name, header):
    nb = json.load(open(path, encoding="utf-8"))
    lines = list(header) + [""]
    for c in nb["cells"]:
        src = "".join(c["source"]).rstrip()
        if c["cell_type"] == "markdown":
            for ln in src.splitlines():
                lines.append(("# " + ln).rstrip())
            lines.append("")
        elif src:
            lines.append(src)
            lines.append("")
    write(os.path.join(SRC_DIR, out_name), "\n".join(lines))


def prep_sources():
    write(os.path.join(SRC_DIR, "final_main.cpp"), read(os.path.join(CPP, "final", "main.cpp")))
    for sub, name in [("wavelet_chat_server", "ChatServer.java"), ("doc_search_server", "DocSearchServer.java"),
                      ("doc_search_server", "Server.java"), ("junit_lab", "ListExamples.java"),
                      ("junit_lab", "ListExamplesTests.java")]:
        write(os.path.join(SRC_DIR, name), read(os.path.join(JAVA, sub, name)))
    for name in ["RPS.java", "MyArrayList.java"]:
        write(os.path.join(SRC_DIR, name), read(os.path.join(CSE12_DST, name)))
    extract_notebook(os.path.join(MISC, "aho_corasick_string_matching.ipynb"), "aho_extract.py",
                     ("# aho_corasick_string_matching.ipynb (CSE 100, 2024) - code cells extracted.",
                      "# The notebook builds its automaton with the pyahocorasick LIBRARY and counts",
                      "# 106 nodes; the page implements the algorithm from scratch to show what the",
                      "# library call hides (src/demos/earlycode/core/aho.ts)."))
    extract_notebook(os.path.join(MISC, "CardClassifier.ipynb"), "cardclassifier_extract.py",
                     ("# CardClassifier.ipynb (2024) - code cells extracted. A PyTorch tutorial",
                      "# follow-along (playing-card classification, EfficientNet-B0 via timm, 53",
                      "# classes). The Kaggle dataset is not on disk, so no predictions ship -",
                      "# the notebook is referenced on the page, not re-run."))
    # hw one-liners for the strip
    hws = [
        {"id": "hw1", "line": "cout, strings and arithmetic - the first program (6/29/2021)"},
        {"id": "hw2", "line": "volume + surface area of a rectangular prism (cin, doubles)"},
        {"id": "hw3", "line": "formatting output with iomanip"},
        {"id": "hw4", "line": "quotient and remainder - integer division"},
        {"id": "hw5", "line": "random numbers"},
        {"id": "hw6", "line": "loops: everything divisible by d, starting from 10"},
        {"id": "hw7", "line": "reading files: smallest, largest, average, above/below counts"},
        {"id": "hw8", "line": "functions with return values (char -> seeded random)"},
        {"id": "hw9", "line": "reference parameters: area + perimeter in one call"},
        {"id": "hw10", "line": "arrays + functions: vowel counting with lookup tables"},
    ]
    write(os.path.join(OUT, "hw.json"), json.dumps({"hws": hws}))
    print("sources vendored + hw.json written")


# ------------------------------------------------------------- fixture

def main():
    cpp_cases = prep_cpp()
    aho_fx = prep_aho()
    prep_corpus()
    prep_cse12()
    prep_sources()
    os.makedirs(FIX_DIR, exist_ok=True)
    write(os.path.join(FIX_DIR, "earlycode-core.json"),
          json.dumps({"cpp": cpp_cases, "aho": aho_fx}))
    print("fixture earlycode-core.json written")
    print("earlycode prep done")


main()
