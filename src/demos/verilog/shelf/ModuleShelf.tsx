"use client";

import "./shelf.css";
import { useEffect, useState, type ComponentType } from "react";
import { useRtlText } from "./hooks";
import AluWidget from "./widgets/AluWidget";
import BarrelWidget from "./widgets/BarrelWidget";
import ClaWidget from "./widgets/ClaWidget";
import ClkDivWidget from "./widgets/ClkDivWidget";
import ConvEncWidget from "./widgets/ConvEncWidget";
import CounterWidget from "./widgets/CounterWidget";
import GrayWidget from "./widgets/GrayWidget";
import JohnsonWidget from "./widgets/JohnsonWidget";
import LfsrWidget from "./widgets/LfsrWidget";
import ThreeStylesWidget, { type Circuit } from "./widgets/ThreeStylesWidget";
import UartWidget from "./widgets/UartWidget";

// ---------------------------------------------------------------------------------------
// Card registry
// ---------------------------------------------------------------------------------------

interface RtlFile {
  hw: string;
  file: string;
  /** tab label; defaults to the file name */
  label?: string;
  /** optional group (three-styles card switches groups with its circuit selector) */
  group?: string;
}

interface CardDef {
  id: string;
  title: string;
  hw: string;
  blurb: string;
  /** bench ids in benches.json whose results feed the badge */
  benches: string[];
  rtl: RtlFile[];
}

const CARDS: CardDef[] = [
  {
    id: "uart",
    title: "UART",
    hw: "hw8",
    blurb: "Serial transmitter and receiver, 1 start + 8 data + 1 stop bit, mid-bit sampling.",
    benches: ["uart"],
    rtl: [
      { hw: "hw8", file: "uart_tx.sv" },
      { hw: "hw8", file: "uart_rx.sv" },
      { hw: "hw8", file: "uart_top.sv" },
      { hw: "hw8", file: "uart_top_testbench.sv", label: "testbench" },
    ],
  },
  {
    id: "barrel",
    title: "Barrel shifter",
    hw: "hw4",
    blurb: "8-bit shift or rotate, either direction, in log2(N) mux stages.",
    benches: ["barrel", "barrel-mux"],
    rtl: [
      { hw: "hw4", file: "barrel_shifter_mux_stages.sv", label: "mux stages" },
      { hw: "hw4", file: "barrel_shifter.sv", label: "behavioral" },
      { hw: "hw4", file: "8bits_barrel_shifter_testbench.sv", label: "testbench" },
    ],
  },
  {
    id: "lfsr",
    title: "LFSR",
    hw: "hw5",
    blurb: "Parameterized N = 2..8 maximal-length LFSR with loadable seed and tap pattern.",
    benches: ["lfsr", "lfsr-autograder", "lfsr-sweep"],
    rtl: [
      { hw: "hw5", file: "lfsr.sv" },
      { hw: "hw5", file: "lfsr_testbench.sv", label: "testbench" },
      { hw: "hw5", file: "lfsr_sweep_testbench.sv", label: "sweep tb" },
    ],
  },
  {
    id: "cla",
    title: "Carry-lookahead adder",
    hw: "hw6",
    blurb: "Generate/propagate carries versus a ripple chain, raced gate delay by gate delay.",
    benches: ["cla"],
    rtl: [
      { hw: "hw6", file: "carry_lookahead_adder.sv" },
      { hw: "hw6", file: "carry_lookahead_adder_testbench.sv", label: "testbench" },
    ],
  },
  {
    id: "gray",
    title: "Gray → binary",
    hw: "hw6",
    blurb: "Registered XOR chain turning a Gray-coded wheel position into binary.",
    benches: ["gray"],
    rtl: [
      { hw: "hw6", file: "gray_code_to_binary_convertor.sv" },
      { hw: "hw6", file: "gray_code_to_binary_convertor_testbench.sv", label: "testbench" },
    ],
  },
  {
    id: "clkdiv",
    title: "Clock divide-by-N",
    hw: "hw6",
    blurb: "Counts both clock edges to get a 50/50 output for any integer N.",
    benches: ["clkdiv"],
    rtl: [
      { hw: "hw6", file: "clock_div_by_N.sv" },
      { hw: "hw6", file: "clock_divide_by_N_testbench.sv", label: "testbench" },
    ],
  },
  {
    id: "alu",
    title: "ALU",
    hw: "hw2",
    blurb: "16-bit MIPS-style ALU: add, sub, and, or, xor, shifts (arithmetic and logical).",
    benches: ["alu", "alu4"],
    rtl: [
      { hw: "hw2", file: "alu_enum.sv" },
      { hw: "hw2", file: "mips_16_defs.sv" },
      { hw: "hw2", file: "alu_enum_testbench.sv", label: "testbench" },
      { hw: "hw2", file: "alu.sv", label: "4-bit alu.sv" },
    ],
  },
  {
    id: "counter",
    title: "4-bit counter",
    hw: "hw2",
    blurb: "The simplest sequential block: a register plus one adder, with asynchronous clear.",
    benches: ["counter"],
    rtl: [
      { hw: "hw2", file: "counter_4bit.sv" },
      { hw: "hw2", file: "counter_4bit_testbench.sv", label: "testbench" },
    ],
  },
  {
    id: "johnson",
    title: "Johnson counter",
    hw: "hw3",
    blurb: "Twisted-ring counter: n flip-flops, 2n states, one bit flips per clock.",
    benches: ["johnson"],
    rtl: [
      { hw: "hw3", file: "johnson_counter.sv" },
      { hw: "hw3", file: "johnson_counter_testbench.sv", label: "testbench" },
    ],
  },
  {
    id: "threestyles",
    title: "Three styles of one circuit",
    hw: "hw1",
    blurb: "Decoder, full adder and mux each written as gates, dataflow and behavioral code.",
    benches: ["decoder", "fulladder", "mux"],
    rtl: [
      { hw: "hw1", file: "decoder_2to4_gate.sv", label: "gate", group: "decoder" },
      { hw: "hw1", file: "decoder_2to4_dataflow.sv", label: "dataflow", group: "decoder" },
      { hw: "hw1", file: "decoder_2to4_behavioral.sv", label: "behavioral", group: "decoder" },
      { hw: "hw1", file: "decoder_2to4_testbench.sv", label: "testbench", group: "decoder" },
      { hw: "hw1", file: "fulladder_gate.sv", label: "gate", group: "fulladder" },
      { hw: "hw1", file: "fulladder_dataflow.sv", label: "dataflow", group: "fulladder" },
      { hw: "hw1", file: "fulladder_behavioral.sv", label: "behavioral", group: "fulladder" },
      { hw: "hw1", file: "fulladder_testbench.sv", label: "testbench", group: "fulladder" },
      { hw: "hw1", file: "mux_2x1_gate.sv", label: "gate", group: "mux" },
      { hw: "hw1", file: "mux_2x1_dataflow.sv", label: "dataflow", group: "mux" },
      { hw: "hw1", file: "mux_2x1_behavioral.sv", label: "behavioral", group: "mux" },
      { hw: "hw1", file: "mux_2x1_testbench.sv", label: "testbench", group: "mux" },
    ],
  },
  {
    id: "convenc",
    title: "Convolutional encoder",
    hw: "hw7",
    blurb: "Rate-1/2 encoder with two loadable masks — the front end of the Viterbi link above.",
    benches: ["convenc"],
    rtl: [
      { hw: "hw7", file: "conv_enc.sv" },
      { hw: "hw7", file: "conv_enc_tb.sv", label: "testbench" },
    ],
  },
];

// ---------------------------------------------------------------------------------------
// Bench results
// ---------------------------------------------------------------------------------------

type BenchStatus = "pass" | "fail" | "error";

interface BenchResult {
  id: string;
  title: string;
  hw: string;
  status: BenchStatus;
  summary: string;
}

interface BenchFile {
  generatedAt: string;
  benches: BenchResult[];
}

type Results = { ok: true; generatedAt: string; byId: Record<string, BenchResult> } | { ok: false } | null;

function useBenchResults(): Results {
  const [results, setResults] = useState<Results>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/demos/verilog/benches.json")
      .then((r) => (r.ok ? (r.json() as Promise<BenchFile>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (cancelled) return;
        const byId: Record<string, BenchResult> = {};
        for (const b of data.benches ?? []) byId[b.id] = b;
        setResults({ ok: true, generatedAt: data.generatedAt, byId });
      })
      .catch(() => {
        if (!cancelled) setResults({ ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return results;
}

type Verdict = BenchStatus | "not run" | "loading";

function verdictFor(results: Results, ids: string[]): { verdict: Verdict; rows: BenchResult[] } {
  if (results === null) return { verdict: "loading", rows: [] };
  if (!results.ok) return { verdict: "not run", rows: [] };
  const rows = ids.map((id) => results.byId[id]).filter((r): r is BenchResult => !!r);
  if (rows.length === 0) return { verdict: "not run", rows };
  if (rows.some((r) => r.status === "error")) return { verdict: "error", rows };
  if (rows.some((r) => r.status === "fail")) return { verdict: "fail", rows };
  if (rows.length < ids.length) return { verdict: "not run", rows };
  return { verdict: "pass", rows };
}

function Badge({ verdict, count }: { verdict: Verdict; count?: number }) {
  const text =
    verdict === "pass"
      ? `pass${count && count > 1 ? ` ${count}/${count}` : ""}`
      : verdict === "fail"
        ? "fail"
        : verdict === "error"
          ? "sim error"
          : verdict === "loading"
            ? "…"
            : "not run";
  return (
    <span className={`shelfBadge is-${verdict.replace(" ", "-")}`} title="testbench result from the build-time Icarus run">
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------------------
// RTL pane
// ---------------------------------------------------------------------------------------

function RtlCode({ hw, file }: { hw: string; file: string }) {
  const { text, error } = useRtlText(hw, file);
  if (error) return <p className="demoNote">Source not available ({error}). The build step copies lib sources here.</p>;
  if (text === null) return <p className="demoNote">Loading {file}…</p>;
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  return (
    <div className="demoCode shelfCode">
      <pre>
        <code>
          {lines.map((l, i) => (
            <span key={i} className="line">
              {l}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function RtlPane({ files, group }: { files: RtlFile[]; group?: string }) {
  const visible = group ? files.filter((f) => f.group === group) : files;
  const [active, setActive] = useState(0);
  const idx = Math.min(active, Math.max(0, visible.length - 1));
  const f = visible[idx];
  useEffect(() => setActive(0), [group]);
  if (!f) return null;
  return (
    <div className="shelfRtl">
      <div className="demoDrawerTabs shelfTabs">
        {visible.map((v, i) => (
          <button
            key={v.file}
            type="button"
            className={`demoDrawerTab ${i === idx ? "isActive" : ""}`}
            onClick={() => setActive(i)}
          >
            {v.label ?? v.file}
          </button>
        ))}
      </div>
      <div className="demoDrawerMeta">
        <span className="demoMono">
          {f.hw}/{f.file}
        </span>
        <span>SystemVerilog</span>
      </div>
      <RtlCode hw={f.hw} file={f.file} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------------------

const WIDGETS: Record<string, ComponentType> = {
  uart: UartWidget,
  barrel: BarrelWidget,
  lfsr: LfsrWidget,
  cla: ClaWidget,
  gray: GrayWidget,
  clkdiv: ClkDivWidget,
  alu: AluWidget,
  counter: CounterWidget,
  johnson: JohnsonWidget,
  convenc: ConvEncWidget,
};

function Card({ def, open, onToggle, results }: { def: CardDef; open: boolean; onToggle: () => void; results: Results }) {
  const { verdict, rows } = verdictFor(results, def.benches);
  const [circuit, setCircuit] = useState<Circuit>("decoder");
  const Widget = WIDGETS[def.id];
  const isThree = def.id === "threestyles";
  return (
    <section id={def.id} className={`demoPanel shelfCard ${open ? "isOpen" : ""}`}>
      <button type="button" className="shelfCardHead" onClick={onToggle} aria-expanded={open}>
        <span className="shelfCardTitle">{def.title}</span>
        <span className="shelfCardHw demoMono">{def.hw}</span>
        <Badge verdict={verdict} count={rows.length} />
        <span className="shelfCardChevron" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      <p className="shelfCardBlurb">{def.blurb}</p>
      {open && (
        <div className="shelfOpen">
          <div className="shelfWidgetCol">
            {isThree ? <ThreeStylesWidget circuit={circuit} onCircuit={setCircuit} /> : Widget ? <Widget /> : null}
            <div className="shelfBenchList">
              <div className="shelfSub">run testbench</div>
              {rows.length === 0 && (
                <p className="demoNote">
                  {verdict === "loading" ? "Loading results…" : "No build-time result for this module yet (benches.json not found)."}
                </p>
              )}
              {rows.map((r) => (
                <div key={r.id} className="shelfBenchRow">
                  <Badge verdict={r.status} />
                  <span className="shelfBenchTitle">{r.title}</span>
                  <span className="demoMono shelfBenchSummary">{r.summary}</span>
                </div>
              ))}
            </div>
          </div>
          <RtlPane files={def.rtl} group={isThree ? circuit : undefined} />
        </div>
      )}
    </section>
  );
}

export default function ModuleShelf() {
  const results = useBenchResults();
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (CARDS.some((c) => c.id === id)) setOpen(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const passCount =
    results && results.ok ? CARDS.filter((c) => verdictFor(results, c.benches).verdict === "pass").length : null;

  return (
    <div className="shelf">
      <div className="demoPanelHead shelfHead">
        <h2>Module shelf</h2>
        <p>
          ECE 111 library, one card per module: a live TS model of the RTL, the source beside it, and the testbench
          result from the build-time Icarus Verilog run
          {results && results.ok ? ` (${passCount}/${CARDS.length} modules passing, ${new Date(results.generatedAt).toLocaleDateString()})` : ""}
          .
        </p>
      </div>
      <div className="shelfGrid">
        {CARDS.map((c) => (
          <Card key={c.id} def={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} results={results} />
        ))}
      </div>
    </div>
  );
}
