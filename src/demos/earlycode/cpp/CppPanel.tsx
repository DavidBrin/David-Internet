"use client";

/**
 * #cpp — the 2021 C++ final in a fake terminal. Prefix eC.
 *
 * Runs the real logic from ../core/cppfinal.ts (parseNumbersFile,
 * tallyOccurrences, findMostAndLeastOccurrence, findTotalOccurrenceCount)
 * against the shipped numbers*.txt fixtures, and replays the program's
 * actual prompts/output strings (lifted verbatim from
 * demos/earlycode_src/final_main.cpp). Never scrolls the page: the terminal
 * scrolls only its own overflow container.
 */
import { useEffect, useRef, useState } from "react";
import "./cpp.css";
import {
  findMostAndLeastOccurrence,
  findTotalOccurrenceCount,
  parseNumbersFile,
  tallyOccurrences,
} from "../core/cppfinal";

// ---------------------------------------------------------------- types

interface Hw {
  id: string;
  line: string;
}

interface HwFile {
  hws: Hw[];
}

interface TerminalLine {
  id: string;
  kind: "output" | "prompt" | "table-head" | "error";
  text: string;
}

interface StreamChip {
  key: string;
  value: number;
  outOfRange: boolean;
}

type PhaseKey = "read" | "printCounts" | "findMostLeast" | "findTotal";

const PHASES: ReadonlyArray<{ key: PhaseKey; label: string }> = [
  { key: "read", label: "readNumbersAndTallyOccurrences" },
  { key: "printCounts", label: "printCounts" },
  { key: "findMostLeast", label: "findMostAndLeastOccurrence" },
  { key: "findTotal", label: "findTotalOccurrenceCount" },
];

const NUMBER_FILES: readonly string[] = [
  "numbers1.txt",
  "numbers2.txt",
  "numbers3.txt",
  "numbers-none.txt",
  "numbers-none2.txt",
  "numbers-large-trunc.txt",
];

const AUTO_FILE = "numbers2.txt";
const AUTO_MAX = "100";
const MAX_CEILING = 500;
const FILE_PROMPT = "Enter an existing file name: ";
const MAX_PROMPT = "Enter the highest number to get occurrence count (must be > 1): ";
const MAX_ROWS_INSTANT = 60; // above this, streaming batches grow instead of adding delay

// ---------------------------------------------------------------- helpers

function setw(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// ---------------------------------------------------------------- component

export default function CppPanel() {
  const [filesCache, setFilesCache] = useState<Record<string, string> | null>(null);
  const [hws, setHws] = useState<Hw[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<string>(AUTO_FILE);
  const [maxRaw, setMaxRaw] = useState<string>("10");
  const [running, setRunning] = useState(false);

  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [streamChips, setStreamChips] = useState<StreamChip[]>([]);
  const [occurrences, setOccurrences] = useState<number[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [activePhase, setActivePhase] = useState<PhaseKey | null>(null);

  const [calloutHeader, setCalloutHeader] = useState(false);
  const [calloutOOR, setCalloutOOR] = useState(false);
  const [calloutZero, setCalloutZero] = useState(false);

  const reducedMotion = useReducedMotion();

  const runIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const autoRanRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);
  const runProgramRef = useRef<(fileId: string, maxRawStr: string) => void>(() => {});

  // Load the six numbers files + hw.json once.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const entries = await Promise.all(
          NUMBER_FILES.map(async (id) => {
            const res = await fetch(`/demos/earlycode/numbers/${id}`);
            if (!res.ok) throw new Error(`${id} ${res.status}`);
            const text = await res.text();
            return [id, text] as const;
          }),
        );
        const hwRes = await fetch("/demos/earlycode/hw.json");
        if (!hwRes.ok) throw new Error(`hw.json ${hwRes.status}`);
        const hwJson = (await hwRes.json()) as HwFile;
        if (cancelled) return;
        setFilesCache(Object.fromEntries(entries));
        setHws(hwJson.hws);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cancel any in-flight run's pending timeout on unmount.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Keep the terminal scrolled to its own bottom only (never the page).
  useEffect(() => {
    const el = termRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, streamChips]);

  async function runProgram(fileId: string, maxRawStr: string): Promise<void> {
    const text = filesCache?.[fileId];
    if (text === undefined) return;

    const myRunId = ++runIdRef.current;
    const rm = reducedMotion;

    function wait(ms: number): Promise<boolean> {
      return new Promise((resolve) => {
        const id = window.setTimeout(() => resolve(runIdRef.current === myRunId), ms);
        timeoutRef.current = id;
      });
    }

    let nextLineId = 0;
    function pushLine(kind: TerminalLine["kind"], lineText: string): string {
      const id = `L${myRunId}-${nextLineId++}`;
      setLines((prev) => [...prev, { id, kind, text: lineText }]);
      return id;
    }
    function updateLine(id: string, lineText: string) {
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text: lineText } : l)));
    }
    async function typeLine(kind: TerminalLine["kind"], prefix: string, typed: string): Promise<boolean> {
      const id = pushLine(kind, prefix);
      if (rm) {
        updateLine(id, prefix + typed);
        return true;
      }
      let acc = "";
      for (const ch of typed) {
        acc += ch;
        updateLine(id, prefix + acc);
        if (!(await wait(26))) return false;
      }
      return true;
    }

    setRunning(true);
    setSelectedFile(fileId);
    setMaxRaw(maxRawStr);
    setLines([]);
    setStreamChips([]);
    setOccurrences([]);
    setWinnerIndex(null);
    setActivePhase(null);
    setCalloutHeader(false);
    setCalloutOOR(false);
    setCalloutZero(false);

    pushLine("output", "This program reads a number file and display the number occurrence statistics.");
    if (!rm && !(await wait(120))) return;

    if (!(await typeLine("prompt", FILE_PROMPT, fileId))) return;
    if (!rm && !(await wait(200))) return;

    const parsed = parseNumbersFile(text);
    const headerNonEmpty = parsed.headerLine.trim().length > 0;

    let requested = Number.parseInt(maxRawStr, 10);
    if (Number.isNaN(requested)) requested = 0;
    let maxUsed = requested;

    if (!(await typeLine("prompt", MAX_PROMPT, maxRawStr))) return;
    if (maxUsed < 1) {
      if (!rm && !(await wait(200))) return;
      pushLine("error", "Number must not be less than 1!");
      if (!rm && !(await wait(160))) return;
      maxUsed = 1;
      if (!(await typeLine("prompt", MAX_PROMPT, String(maxUsed)))) return;
    }
    maxUsed = Math.min(Math.max(maxUsed, 1), MAX_CEILING);
    if (!rm && !(await wait(220))) return;

    // --- read + tally, animated ---
    setActivePhase("read");
    setCalloutHeader(headerNonEmpty);
    setOccurrences(new Array(maxUsed).fill(0));

    const numbers = parsed.numbers;
    const liveOcc = new Array(maxUsed).fill(0);
    let sawOOR = false;

    if (rm) {
      for (const n of numbers) {
        if (n >= 1 && n <= maxUsed) liveOcc[n - 1]++;
        else sawOOR = true;
      }
      setOccurrences(liveOcc.slice());
      if (sawOOR) setCalloutOOR(true);
    } else if (numbers.length > 0) {
      const totalTicks = Math.max(1, Math.min(MAX_ROWS_INSTANT, numbers.length));
      const batchSize = Math.max(1, Math.ceil(numbers.length / totalTicks));
      let i = 0;
      while (i < numbers.length) {
        const batch = numbers.slice(i, i + batchSize);
        const chips: StreamChip[] = batch.map((n, bi) => {
          const oor = !(n >= 1 && n <= maxUsed);
          if (oor) sawOOR = true;
          else liveOcc[n - 1]++;
          return { key: `${myRunId}-${i + bi}`, value: n, outOfRange: oor };
        });
        i += batchSize;
        setStreamChips((prev) => {
          const next = [...prev, ...chips];
          return next.length > 24 ? next.slice(next.length - 24) : next;
        });
        setOccurrences(liveOcc.slice());
        if (sawOOR) setCalloutOOR(true);
        if (!(await wait(36))) return;
      }
    }
    if (runIdRef.current !== myRunId) return;
    setStreamChips([]);

    // Authoritative results from the fixture-tested core, not the local
    // animation copy above (which exists only to drive the live view).
    const tally = tallyOccurrences(numbers, maxUsed);

    if (tally.total === 0) {
      setActivePhase(null);
      pushLine("error", "File does not have any numbers");
      setRunning(false);
      return;
    }

    const { highest, lowest } = findMostAndLeastOccurrence(tally.occurrences);
    const inRange = findTotalOccurrenceCount(tally.occurrences);

    setActivePhase("printCounts");
    if (!rm && !(await wait(160))) return;
    pushLine("table-head", setw("Number", 10) + setw("Occurrences", 20));
    for (let i = 0; i < tally.occurrences.length; i++) {
      pushLine("output", setw(String(i + 1), 10) + setw(String(tally.occurrences[i]), 20));
    }
    if (!rm && !(await wait(160))) return;

    setActivePhase("findMostLeast");
    if (!rm && !(await wait(160))) return;
    pushLine("output", `There are ${tally.total} numbers in the file.`);

    setActivePhase("findTotal");
    if (!rm && !(await wait(140))) return;
    pushLine("output", `The total of occurrence counts for numbers in the range [1, ${maxUsed}] is ${inRange}`);
    pushLine("output", `The number ${highest} has the highest occurrence`);
    pushLine("output", `The number ${lowest} has the lowest occurrence`);

    if (highest === 0) setCalloutZero(true);
    setWinnerIndex(highest > 0 ? highest - 1 : null);
    setActivePhase(null);
    setRunning(false);
  }

  // Keep the ref pointed at the latest closure so the one-time observer
  // below always calls a fresh runProgram (with current filesCache etc).
  runProgramRef.current = (fileId, maxRawStr) => {
    void runProgram(fileId, maxRawStr);
  };

  // Auto-run once on first ~30% visibility, ref-guarded against Strict
  // Mode's double effect invocation.
  useEffect(() => {
    if (autoRanRef.current) return undefined;
    if (!filesCache) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting || entry.intersectionRatio < 0.3) return;
        if (autoRanRef.current) return;
        autoRanRef.current = true;
        io.disconnect();
        runProgramRef.current(AUTO_FILE, AUTO_MAX);
      },
      { threshold: [0, 0.3, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filesCache]);

  function handleRunClick() {
    if (running || !filesCache) return;
    void runProgram(selectedFile, maxRaw);
  }

  const maxCount = occurrences.length > 0 ? Math.max(1, ...occurrences) : 1;

  return (
    <div className="elPanel" ref={stageRef}>
      <span className="elEra">summer 2021</span>
      <h2 className="elH2">2021: programs that read things</h2>
      <p className="eC-intro elIntro">
        Summer 2021, ten homeworks in six weeks. The final read a numbers file and tallied occurrences up to a
        max you choose. This terminal runs a faithful TypeScript port of that final over the real shipped
        files, quirks included: the header line silently swallowed, numbers above your max read but never
        tallied, and a very specific answer when every count comes back zero.
      </p>

      {loadError && <p className="elNote">Could not load fixtures: {loadError}</p>}

      <div className="eC-layout">
        <div className="eC-termCol">
          <div className="eC-term" ref={termRef} role="group" aria-label="Program terminal output">
            {lines.map((l) => (
              <div key={l.id} className="eC-line" data-kind={l.kind}>
                {l.text}
              </div>
            ))}
            {streamChips.length > 0 && (
              <div className="eC-streamRow" aria-hidden="true">
                {streamChips.map((c) => (
                  <span
                    key={c.key}
                    className="eC-numChip"
                    data-oor={c.outOfRange}
                    title={c.outOfRange ? "read, not tallied" : undefined}
                  >
                    {c.value}
                  </span>
                ))}
              </div>
            )}
            <span className="eC-cursor" aria-hidden="true" />
          </div>

          <div className="eC-controls">
            <div className="eC-fileRow elRow">
              <span className="eC-maxLabel">file</span>
              {NUMBER_FILES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="elChip eC-fileChip"
                  data-active={selectedFile === f}
                  disabled={running}
                  onClick={() => setSelectedFile(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="eC-maxRow elRow">
              <label className="eC-maxLabel" htmlFor="eC-max-input">
                max
              </label>
              <input
                id="eC-max-input"
                className="eC-maxInput"
                type="number"
                min={1}
                max={MAX_CEILING}
                step={1}
                value={maxRaw}
                disabled={running}
                onChange={(e) => setMaxRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRunClick();
                }}
              />
              <button
                type="button"
                className="elBtn elBtnPrimary"
                disabled={running || !filesCache}
                onClick={handleRunClick}
              >
                {running ? "Running..." : "Run"}
              </button>
            </div>
          </div>

          <div className="eC-breadcrumb" aria-hidden="true">
            {PHASES.map((p, i) => (
              <span
                key={p.key}
                className="eC-phase"
                data-active={activePhase === p.key}
                data-arrow={i < PHASES.length - 1 ? "→" : undefined}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        <div className="eC-histCol">
          <p className="eC-histTitle">tally (1..{occurrences.length || "?"})</p>
          <div className="eC-histBox">
            {occurrences.length === 0 ? (
              <p className="eC-histEmpty">Run the program to see the tally grow.</p>
            ) : (
              <div className="eC-hist">
                {occurrences.map((count, i) => (
                  <div
                    key={i}
                    className="eC-bar"
                    data-hot={count > 0}
                    data-max={winnerIndex === i}
                    style={{ height: `${Math.max(2, (count / maxCount) * 100)}%` }}
                    title={`${i + 1}: ${count}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="eC-callouts elRow">
        <span className="elChip eC-callout" data-active={calloutHeader}>
          header line swallowed (getline)
        </span>
        <span className="elChip eC-callout" data-active={calloutOOR}>
          out-of-range: read but not tallied
        </span>
        <span className="elChip eC-callout" data-active={calloutZero}>
          most frequent: number 0 (the original's exact behavior)
        </span>
      </div>

      <div className="eC-hwStrip">
        <div className="eC-hwScroll">
          {(hws ?? []).map((hw) => (
            <div key={hw.id} className="eC-hwCard">
              <span className="eC-hwId">{hw.id}</span>
              <span className="eC-hwLine">{hw.line}</span>
            </div>
          ))}
        </div>
        <p className="elNote">ten homeworks in six weeks; Doxygen configs from hw1.</p>
      </div>

      <p className="elNote">
        numbers-large-trunc.txt is the original 8 MB numbers-large.txt truncated to 300 lines for the page.
      </p>
    </div>
  );
}
