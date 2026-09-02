"use client";

/**
 * Zone 3 of the servers panel: the JUnit lab. Replays ListExamplesTests
 * against the TS port of ListExamples.merge (logic.ts), planted bug and all.
 * testMerge2 "times out" against MERGE_STEP_CAP, a stand-in for the real
 * @Test(timeout = 500) - a synchronous loop can't be preempted by a JVM
 * clock, so the step cap plays that role instead, and the ~1.2s progress bar
 * is a purely cosmetic replay of what that wait looked like.
 */
import { useEffect, useRef, useState } from "react";
import { MERGE_TESTS, filterQuirky, mergeBuggy } from "./logic";

type Status = "idle" | "running" | "pass" | "fail" | "timeout";

const TEST1_DELAY_MS = 260;
const TEST2_PROGRESS_MS = 1200;

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const FILTER_SAMPLE = ["ant", "bee", "cat", "dog"];
const filterSampleResult = filterQuirky(FILTER_SAMPLE, () => true);

interface JUnitLabProps {
  reducedMotion: boolean;
}

export default function JUnitLab({ reducedMotion }: JUnitLabProps) {
  const [fixed, setFixed] = useState(false);
  const [test1Status, setTest1Status] = useState<Status>("idle");
  const [test1Result, setTest1Result] = useState<string[] | null>(null);
  const [test2Status, setTest2Status] = useState<Status>("idle");
  const [test2Progress, setTest2Progress] = useState(0);
  const [test2Result, setTest2Result] = useState<string[] | null>(null);

  const genRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const autoRanRef = useRef(false);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  function clearAllTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => clearAllTimers, []);

  function runTests(useFixed: boolean) {
    genRef.current += 1;
    const gen = genRef.current;
    clearAllTimers();

    setTest1Status("running");
    setTest2Status("running");
    setTest2Progress(0);

    const case1 = MERGE_TESTS[0];
    const case2 = MERGE_TESTS[1];
    const out1 = mergeBuggy(case1.l1, case1.l2, useFixed);
    const out2 = mergeBuggy(case2.l1, case2.l2, useFixed);
    const pass1 = !out1.timedOut && arraysEqual(out1.result, case1.expected);
    const pass2 = !out2.timedOut && arraysEqual(out2.result, case2.expected);

    if (reducedMotionRef.current) {
      setTest1Status(pass1 ? "pass" : "fail");
      setTest1Result(out1.result);
      setTest2Status(out2.timedOut ? "timeout" : pass2 ? "pass" : "fail");
      setTest2Progress(100);
      setTest2Result(out2.result);
      return;
    }

    const t1 = window.setTimeout(() => {
      if (gen !== genRef.current) return;
      setTest1Status(pass1 ? "pass" : "fail");
      setTest1Result(out1.result);
    }, TEST1_DELAY_MS);
    timersRef.current.push(t1);

    const startTs = performance.now();
    const iv = window.setInterval(() => {
      if (gen !== genRef.current) {
        window.clearInterval(iv);
        return;
      }
      const elapsed = performance.now() - startTs;
      const pct = Math.min(100, (elapsed / TEST2_PROGRESS_MS) * 100);
      setTest2Progress(pct);
      if (pct >= 100) window.clearInterval(iv);
    }, 40);
    intervalRef.current = iv;

    const t2 = window.setTimeout(() => {
      if (gen !== genRef.current) return;
      setTest2Progress(100);
      setTest2Status(out2.timedOut ? "timeout" : pass2 ? "pass" : "fail");
      setTest2Result(out2.result);
    }, TEST2_PROGRESS_MS);
    timersRef.current.push(t2);
  }

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (autoRanRef.current) return;
        autoRanRef.current = true;
        runTests(false);
        io.disconnect();
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRun() {
    runTests(fixed);
  }

  function handleApplyFix() {
    setFixed(true);
    runTests(true);
  }

  const case1 = MERGE_TESTS[0];
  const case2 = MERGE_TESTS[1];

  return (
    <div className="eSLab" ref={rootRef}>
      <div className="eSLabHead">
        <h3 className="elH2" style={{ fontSize: "1rem", margin: 0 }}>
          The JUnit lab: ListExamplesTests
        </h3>
        <div className="elRow">
          <button type="button" className="elBtn" onClick={handleRun}>
            run tests
          </button>
          <button type="button" className="elBtn" data-active={fixed || undefined} onClick={handleApplyFix} disabled={fixed}>
            {fixed ? "fix applied" : "apply the one-line fix (index1 -> index2)"}
          </button>
        </div>
      </div>

      <div className="eSTestCard">
        <div className="eSTestTop">
          <span className="eSTestName">testMerge1</span>
          <span className="eSTimeout">@Test(timeout = 500)</span>
          <span className="eSStatus" data-state={test1Status}>
            {test1Status}
          </span>
        </div>
        {test1Status === "pass" && test1Result && (
          <p className="eSAssertion">
            assertArrayEquals([{case1.expected.join(", ")}], merge([{case1.l1.join(", ")}], [{case1.l2.join(", ")}]))
            {"\n"}
            actual: [{test1Result.join(", ")}] -&gt; passed
          </p>
        )}
        {test1Status === "fail" && test1Result && (
          <p className="eSTrace">
            expected: [{case1.expected.join(", ")}]{"\n"}
            actual: [{test1Result.join(", ")}]
          </p>
        )}
      </div>

      <div className="eSTestCard">
        <div className="eSTestTop">
          <span className="eSTestName">testMerge2</span>
          <span className="eSTimeout">@Test(timeout = 500)</span>
          <span className="eSStatus" data-state={test2Status}>
            {test2Status}
          </span>
        </div>
        {test2Status === "running" && (
          <div className="eSProgressTrack">
            <div className="eSProgressFill" style={{ width: `${test2Progress}%` }} />
          </div>
        )}
        {test2Status === "timeout" && (
          <p className="eSTrace">
            java.lang.Exception: test timed out after 500 milliseconds{"\n"}
            {"  "}at ListExamples.merge(ListExamples.java:44){"\n"}
            {"  "}at ListExamplesTests.testMerge2(ListExamplesTests.java:19)
          </p>
        )}
        {test2Status === "pass" && test2Result && (
          <p className="eSAssertion">
            assertArrayEquals([{case2.expected.join(", ")}], merge([{case2.l1.join(", ")}], [{case2.l2.join(", ")}]))
            {"\n"}
            actual: [{test2Result.join(", ")}] -&gt; passed
          </p>
        )}
      </div>

      {fixed && (
        <div className="eSDiff">
          <div className="eSDiffLine eSDiffRemove">- index1 += 1;</div>
          <div className="eSDiffLine eSDiffAdd">+ index2 += 1;</div>
        </div>
      )}

      <p className="eSFilterNote">
        filter() has its own quirk: result.add(0, s) inserts every match at the front, so matches come back
        reversed: filter([{FILTER_SAMPLE.join(", ")}], keepAll) returns [{filterSampleResult.join(", ")}].
      </p>
    </div>
  );
}
