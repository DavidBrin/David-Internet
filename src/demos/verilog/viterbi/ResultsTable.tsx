"use client";

import type { SimJson } from "./simTypes";

/** Pass/fail per error pattern from the build-time simulation, plus the burst sweep. */
export default function ResultsTable({ sim }: { sim: SimJson | null }) {
  if (!sim) return null;
  const named = sim.presets.filter((p) => !p.id.startsWith("sweep"));
  const sweeps = [
    { key: "sweep0", label: "bit[0] only (2.c)" },
    { key: "sweep1", label: "bit[1] only (2.d)" },
    { key: "sweep2", label: "both bits (2.e)" },
  ].map((s) => ({
    ...s,
    runs: sim.presets.filter((p) => p.id.startsWith(s.key + "-")).sort((a, b) => a.params.BURST - b.params.BURST),
  }));

  return (
    <div className="vitResults">
      <table className="vitTable">
        <thead>
          <tr>
            <th>error pattern</th>
            <th>corrupted symbols</th>
            <th>decoded correctly</th>
            <th>result</th>
          </tr>
        </thead>
        <tbody>
          {named.map((p) => (
            <tr key={p.id}>
              <td>{p.label}</td>
              <td className="demoMono">{p.corrupted}</td>
              <td className="demoMono">
                {p.good}/{p.good + p.bad}
              </td>
              <td>
                <span className={`vitBadge is-${p.status}`}>{p.status === "pass" ? "yaa!" : p.status === "fail" ? `boo! ×${p.bad}` : "error"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="demoNote">
        2.b (random) corrupts far more than its name suggests: the injector tests <code>$random % PERIOD &lt; BURST</code>,
        and <code>$random</code> is signed, so half of all symbols pass the test — it is kept here as the testbench wrote it.
      </p>
      {sweeps.some((s) => s.runs.length) ? (
        <div className="vitSweep">
          <p className="demoNote">
            &ldquo;Keep doubling until boo! appears&rdquo; — a single burst of consecutive bad symbols once per 256:
          </p>
          {sweeps.map((s) => {
            const firstFail = s.runs.find((r) => r.status !== "pass");
            return (
              <div key={s.key} className="vitSweepRow">
                <span className="vitSweepLabel">{s.label}</span>
                {s.runs.map((r) => (
                  <span
                    key={r.id}
                    className={`vitSweepCell is-${r.status}`}
                    title={`burst ${r.params.BURST}: ${r.good}/${r.good + r.bad} correct`}
                  >
                    {r.params.BURST}
                  </span>
                ))}
                <span className="vitSweepNote">
                  {firstFail ? `first failure at a burst of ${firstFail.params.BURST}` : "no failure in this range"}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
