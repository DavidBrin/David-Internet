"use client";

/**
 * #cse12 — David's CSE 12 MyArrayList visualizer + RPS. Prefix eJ.
 * Renders inside the shared <section id="cse12"> from Stage.tsx - owns no
 * section/id of its own. See myArrayList.ts and rps.ts for the ported
 * logic; this file is presentation + animation plumbing only.
 */
import { useEffect, useRef, useState } from "react";
import {
  type Frame,
  type ListState,
  append,
  createList,
  getAt,
  insert,
  nextValue,
  prepend,
  removeAt,
  setAt,
} from "./myArrayList";
import {
  CPU_WIN_OUTCOME,
  DEFAULT_MOVES,
  FIVE_MOVES,
  JavaRandom,
  PLAYER_WIN_OUTCOME,
  type RpsStats,
  SEED,
  createStats,
  genCPUMove,
  playRPS,
  winPercent,
} from "./rps";
import "./cse12.css";

const STEP_MS = 80;
const MAX_LOG = 40;

const MOVE_ICON: Record<string, string> = {
  rock: "\u{1FAA8}",
  paper: "\u{1F4C4}",
  scissors: "\u{2702}",
  lizard: "\u{1F98E}",
  spock: "\u{1F596}",
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function frameOf(state: ListState, note: string): Frame {
  return { values: state.values.slice(), length: state.length, highlight: [], note };
}

export default function Cse12Panel() {
  const reducedMotion = useReducedMotion();

  // ---- MyArrayList zone ----
  const listRef = useRef<ListState>(createList());
  const seqRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initedRef = useRef(false);

  const [display, setDisplay] = useState<Frame>(() => frameOf(listRef.current, "ready"));
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [insertIndex, setInsertIndex] = useState(0);
  const [opIndex, setOpIndex] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Preload a few elements on mount so the visualizer never opens empty.
  // Strict-mode-safe: initedRef blocks the double-invoke from running twice.
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    const state = listRef.current;
    const frames: Frame[] = [];
    const seedValues = ["A", "B", "C"];
    const lines: string[] = [];
    for (const v of seedValues) {
      lines.push(append(state, v, frames));
    }
    seqRef.current = seedValues.length;
    setDisplay(frameOf(state, "preloaded"));
    setLog(lines.reverse());
  }, []);

  useEffect(() => {
    setInsertIndex((v) => Math.min(v, display.length));
  }, [display.length]);
  useEffect(() => {
    setOpIndex((v) => Math.min(v, Math.max(display.length - 1, 0)));
  }, [display.length]);

  function playFrames(frames: Frame[], onComplete?: () => void): void {
    if (frames.length === 0) {
      onComplete?.();
      return;
    }
    if (reducedMotion) {
      setDisplay(frames[frames.length - 1]);
      onComplete?.();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    let i = 0;
    const step = () => {
      if (!mountedRef.current) return;
      setDisplay(frames[i]);
      i++;
      if (i < frames.length) {
        timerRef.current = setTimeout(step, STEP_MS);
      } else {
        busyRef.current = false;
        timerRef.current = null;
        setBusy(false);
        onComplete?.();
      }
    };
    step();
  }

  function runOp(fn: (state: ListState, frames: Frame[]) => string, onComplete?: () => void): void {
    if (busyRef.current) return;
    const frames: Frame[] = [];
    let logLine: string;
    try {
      logLine = fn(listRef.current, frames);
    } catch (err) {
      setLog((l) => [`error: ${err instanceof Error ? err.message : String(err)}`, ...l].slice(0, MAX_LOG));
      return;
    }
    setLog((l) => [logLine, ...l].slice(0, MAX_LOG));
    playFrames(frames, onComplete);
  }

  function doAppend(): void {
    runOp((state, frames) => append(state, nextValue(seqRef.current++), frames));
  }
  function doPrepend(): void {
    runOp((state, frames) => prepend(state, nextValue(seqRef.current++), frames));
  }
  function doInsert(): void {
    const idx = insertIndex;
    runOp((state, frames) => insert(state, idx, nextValue(seqRef.current++), frames));
  }
  function doRemove(): void {
    if (display.length === 0) return;
    const idx = opIndex;
    runOp((state, frames) => removeAt(state, idx, frames));
  }
  function doGet(): void {
    if (display.length === 0) return;
    const idx = opIndex;
    runOp((state, frames) => getAt(state, idx, frames));
  }
  function doSet(): void {
    if (display.length === 0) return;
    const idx = opIndex;
    runOp((state, frames) => setAt(state, idx, nextValue(seqRef.current++), frames));
  }
  function doForceGrowth(): void {
    if (busyRef.current) return;
    const needed = Math.max(1, listRef.current.values.length - listRef.current.length + 1);
    let remaining = needed;
    const runNext = () => {
      if (remaining <= 0) return;
      remaining--;
      runOp((state, frames) => append(state, nextValue(seqRef.current++), frames), runNext);
    };
    runNext();
  }

  const insertOptions = Array.from({ length: display.length + 1 }, (_, i) => i);
  const opOptions = Array.from({ length: Math.max(display.length, 0) }, (_, i) => i);

  // ---- RPS zone ----
  const [moveSet, setMoveSet] = useState<"three" | "five">("three");
  const rngRef = useRef<JavaRandom>(new JavaRandom(SEED));
  const [stats, setStats] = useState<RpsStats>(createStats());
  const moves = moveSet === "five" ? FIVE_MOVES : DEFAULT_MOVES;

  useEffect(() => {
    rngRef.current = new JavaRandom(SEED);
    setStats(createStats());
  }, [moveSet]);

  function play(move: string): void {
    const cpuMove = genCPUMove(rngRef.current, moves);
    setStats((s) => playRPS(s, move, cpuMove, moves));
  }

  const lastRound = stats.history.length > 0 ? stats.history[stats.history.length - 1] : null;
  const recentHistory = stats.history.slice(-10).reverse();

  return (
    <div className="elPanel">
      <span className="elEra">winter 2024</span>
      <h2 className="elH2">2024: data structures with a grade attached</h2>
      <p className="elIntro">
        CSE 12 made the containers personal: build MyArrayList yourself, then build a game on the
        interfaces it taught. Both widgets run David&apos;s actual logic, ported to TypeScript.
      </p>
      <div className="eJHeaderChip">
        <span className="elChip">arrays with homework: build the container, then build a game on interfaces</span>
      </div>

      <div className="eJGrid">
        <div className="eJZone eJZoneList">
          <h3 className="eJZoneTitle">MyArrayList: capacity vs. length</h3>

          <div className="elRow eJControls">
            <button type="button" className="elBtn" onClick={doAppend} disabled={busy}>
              append(x)
            </button>
            <button type="button" className="elBtn" onClick={doPrepend} disabled={busy}>
              prepend(x)
            </button>
            <button type="button" className="elBtn" onClick={doForceGrowth} disabled={busy}>
              force capacity growth
            </button>
          </div>

          <div className="elRow eJControls">
            <label className="eJLabel">
              insert at
              <select
                className="eJSelect"
                value={insertIndex}
                onChange={(e) => setInsertIndex(Number(e.target.value))}
                disabled={busy}
              >
                {insertOptions.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="elBtn" onClick={doInsert} disabled={busy}>
              insert(i, x)
            </button>
          </div>

          <div className="elRow eJControls">
            <label className="eJLabel">
              index
              <select
                className="eJSelect"
                value={opIndex}
                onChange={(e) => setOpIndex(Number(e.target.value))}
                disabled={busy || display.length === 0}
              >
                {opOptions.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="elBtn" onClick={doGet} disabled={busy || display.length === 0}>
              get(i)
            </button>
            <button type="button" className="elBtn" onClick={doSet} disabled={busy || display.length === 0}>
              set(i, x)
            </button>
            <button type="button" className="elBtn" onClick={doRemove} disabled={busy || display.length === 0}>
              remove(i)
            </button>
          </div>

          <div className="eJSlotsWrap" data-reduced={reducedMotion || undefined}>
            <div className="eJSlots">
              {display.values.map((v, i) => (
                <div
                  key={i}
                  className="eJSlot"
                  data-filled={v !== null || undefined}
                  data-hi={display.highlight.includes(i) || undefined}
                >
                  <span className="eJSlotIdx">{i}</span>
                  <span className="eJSlotVal">{v ?? ""}</span>
                </div>
              ))}
            </div>
            <div className="eJBracketRow">
              <div
                className="eJBracket eJBracketLength"
                style={{ width: `calc(${display.length} * var(--eJ-slot-w))` }}
              >
                length {display.length}
              </div>
            </div>
            <div className="eJBracketRow">
              <div
                className="eJBracket"
                style={{ width: `calc(${display.values.length} * var(--eJ-slot-w))` }}
              >
                capacity {display.values.length}
              </div>
            </div>
          </div>

          <p className="eJFrameNote elMono">{display.note}</p>

          <div className="eJLog">
            {log.map((line, i) => (
              <div key={i} className="eJLogEntry elMono">
                {line}
              </div>
            ))}
          </div>

          <p className="eJCaption">David&apos;s CSE 12 MyArrayList, ported - the shifting is what the O(n) means.</p>
        </div>

        <div className="eJZone eJZoneRps">
          <h3 className="eJZoneTitle">rock paper scissors, against his logic</h3>

          <label className="eJToggle">
            <input
              type="checkbox"
              checked={moveSet === "five"}
              onChange={(e) => setMoveSet(e.target.checked ? "five" : "three")}
            />
            add lizard &amp; spock
          </label>
          {moveSet === "five" && (
            <p className="elNote">
              with 5 moves, each beats exactly one - not the real lizard-spock rules, but exactly what the
              modular rule produces.
            </p>
          )}

          <div className="elRow eJRpsMoves">
            {moves.map((m) => (
              <button key={m} type="button" className="elBtn" onClick={() => play(m)}>
                <span className="eJMoveIcon">{MOVE_ICON[m] ?? ""}</span>
                {m}
              </button>
            ))}
          </div>

          {lastRound && <p className="eJExplain elMono">{lastRound.explanation}</p>}

          <div className="elRow eJScoreboard">
            <span className="eJScoreItem">games {stats.numGames}</span>
            <span className="eJScoreItem">
              you {stats.numPlayerWins} ({winPercent(stats.numPlayerWins, stats.numGames)}%)
            </span>
            <span className="eJScoreItem">
              cpu {stats.numCPUWins} ({winPercent(stats.numCPUWins, stats.numGames)}%)
            </span>
            <span className="eJScoreItem">
              ties {stats.numTies} ({winPercent(stats.numTies, stats.numGames)}%)
            </span>
          </div>

          <ul className="eJHistory">
            {recentHistory.map((r, i) => (
              <li key={stats.history.length - i} className="eJHistoryItem elMono">
                cpu: {r.cpuMove}, you: {r.playerMove} -&gt;{" "}
                {r.outcome === CPU_WIN_OUTCOME ? "cpu wins" : r.outcome === PLAYER_WIN_OUTCOME ? "you win" : "tie"}
              </li>
            ))}
          </ul>

          <p className="eJCaption">
            winner = (loser + 1) mod moves.length - David&apos;s determineWinner, verbatim, with a seeded
            java.util.Random(12) standing in for the CPU.
          </p>
        </div>
      </div>
    </div>
  );
}
