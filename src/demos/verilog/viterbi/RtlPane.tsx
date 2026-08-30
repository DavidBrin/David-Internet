"use client";

import { useEffect, useMemo, useState } from "react";
import type { Phase } from "./ViterbiPanel";

const FILES = ["encoder.sv", "viterbi_tx_rx_2a1.sv", "bmc0.sv", "ACS.sv", "decoder.sv"] as const;
type File = (typeof FILES)[number];

/** Which file + which lines light up for each stage of the animation. */
const PHASE_MAP: Record<Phase, { file: File; from: RegExp; to: RegExp }> = {
  encoder: { file: "encoder.sv", from: /case \(cstate\)/, to: /endcase/ },
  channel: { file: "viterbi_tx_rx_2a1.sv", from: /Determine whether to inject/, to: /encoder_o_reg <= encoder_o;\s*$/ },
  bmc: { file: "bmc0.sv", from: /wire tmp00/, to: /assign path_1_bmc/ },
  acs: { file: "ACS.sv", from: /assign path_cost_0/, to: /endcase/ },
  survivor: { file: "decoder.sv", from: /wire \[TRACEBACK_DEPTH-1:0\] sh_n0/, to: /sh_n7 =/ },
  output: { file: "decoder.sv", from: /wire \[7:0\]  cm0/, to: /survivor_hist\[best_state\]\[TRACEBACK_DEPTH-1\]/ },
};

const NOTES: Record<File, string> = {
  "encoder.sv": "The starter left this case table empty; it was completed from the assignment's state/output table.",
  "viterbi_tx_rx_2a1.sv": "Encoder → error injector → decoder. PERIOD/BURST/ERR_BIT0/ERR_BIT1 are the channel presets.",
  "bmc0.sv": "One parameterised branch-metric block stands in for the eight the assignment lists (INVERT_RX1 for states 1, 2, 5, 6).",
  "ACS.sv": "Add-compare-select: the whole Viterbi update step, once per state.",
  "decoder.sv": "8 BMCs, 8 ACSs, per-state survivor registers, best-state pick, and the output pipe.",
};

interface Props {
  phase: Phase;
}

export default function RtlPane({ phase }: Props) {
  const [sources, setSources] = useState<Partial<Record<File, string>>>({});
  const [pinned, setPinned] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      FILES.map((f) =>
        fetch(`/demos/verilog/viterbi-src/${f}`)
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${f}: ${r.status}`))))
          .then((text) => [f, text] as const),
      ),
    )
      .then((pairs) => {
        if (!cancelled) setSources(Object.fromEntries(pairs));
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const target = PHASE_MAP[phase];
  const file = pinned ?? target.file;
  const text = sources[file];

  const { lines, hiFrom, hiTo } = useMemo(() => {
    const ls = (text ?? "").replace(/\r\n/g, "\n").split("\n");
    let from = -1;
    let to = -1;
    if (file === target.file) {
      from = ls.findIndex((l) => target.from.test(l));
      if (from >= 0) {
        to = ls.findIndex((l, i) => i > from && target.to.test(l));
        if (to < 0) to = from;
      }
    }
    return { lines: ls, hiFrom: from, hiTo: to };
  }, [text, file, target]);

  // Keep the highlighted block in view.
  useEffect(() => {
    if (hiFrom < 0) return;
    const el = document.getElementById(`rtl-line-${file}-${hiFrom}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [hiFrom, file]);

  return (
    <div className="rtlPane">
      <div className="rtlTabs" role="tablist">
        {FILES.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={f === file}
            className={`rtlTab ${f === file ? "isActive" : ""} ${f === target.file && !pinned ? "isLive" : ""}`}
            onClick={() => setPinned(pinned === f ? null : f)}
            title={pinned === f ? "unpin (follow the animation)" : "pin this file"}
          >
            {f}
            {pinned === f ? " 📌" : ""}
          </button>
        ))}
      </div>
      <p className="demoNote rtlNote">{NOTES[file]}</p>
      <div className="rtlCode demoMono">
        {error ? (
          <div className="rtlLine">RTL not available: {error}</div>
        ) : !text ? (
          <div className="rtlLine">loading…</div>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              id={`rtl-line-${file}-${i}`}
              className={`rtlLine ${i >= hiFrom && i <= hiTo && hiFrom >= 0 ? "isHi" : ""}`}
            >
              <span className="rtlNo">{i + 1}</span>
              <span className="rtlText">{l || " "}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
