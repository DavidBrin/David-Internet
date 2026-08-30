import type { DemoMeta } from "@/lib/demos";

const V = "demos/verilog_src/viterbi";
const L = "demos/verilog_src/lib";

const meta: DemoMeta = {
  slug: "verilog",
  what: "an 8-state Viterbi decoder and the ECE 111 module library, animated and simulated",
  why: "hardware is described, not instructed — this page shows the difference",
  when: "UC San Diego, 2025",
  story: [
    {
      title: "Describing hardware",
      body:
        "ECE 111 was the first course where the code was the circuit. The opening exercise builds the same decoder, adder and mux three ways — gates, dataflow, behavioural — and all three must simulate identically. The module shelf below starts there.",
      anchor: "#threestyles",
    },
    {
      title: "The library, in the order it was built",
      body:
        "ALU and counters, a Johnson counter, a barrel shifter, a maximal-length LFSR with programmable taps, Gray-to-binary, a carry-lookahead adder, a divide-by-N clock, a convolutional encoder, and a UART. Each card on the shelf is a live model of that module with its RTL and testbench verdict beside it.",
      anchor: "#shelf",
    },
    {
      title: "The final: a Viterbi decoder",
      body:
        "A rate-½, 8-state convolutional code and the decoder that undoes it. Each clock, eight add-compare-select units extend eight candidate paths through the trellis by one symbol and keep the cheaper of the two ways into every state; after 64 symbols the oldest bit on the best path is the decoded bit. Burst errors are corrected as long as the true path stays cheapest.",
      anchor: "#viterbi",
    },
    {
      title: "Simulated for this page",
      body:
        "The decoder RTL had been completed with AI coding tools and never simulated. Building this page ran it through Icarus Verilog for the first time: the encoder's empty case table was filled in, the best-state search and survivor update were rewritten as continuous assigns (Icarus re-triggered the original always_comb loops forever at t=0), and the waveforms and pass/fail table are from that run.",
      anchor: "#waves",
    },
    {
      title: "What the burst sweep showed",
      body:
        "Single hits and pairs on one bit (2.a.1–2.a.5) decode cleanly; four in a row on either bit every 32 symbols (2.a.6, 2.a.7) and pairs on both bits (2.a.8) do not. The sweep pins the limits: a burst of five consecutive bad symbols on one bit breaks the decoder, and with both bits wrong a burst of two is already too much — with constraint length 3 the trellis simply has too little memory to outvote a longer burst.",
      anchor: "#waves",
    },
  ],
  sources: [
    { name: "encoder.sv", path: `${V}/encoder.sv`, lang: "sv", note: "Convolutional encoder — case table completed 2026-08-30 (the starter left it empty)." },
    { name: "bmc0.sv", path: `${V}/bmc0.sv`, lang: "sv", note: "Branch-metric block; INVERT_RX1 selects the flavour used by states 1, 2, 5, 6." },
    { name: "ACS.sv", path: `${V}/ACS.sv`, lang: "sv", note: "Add-compare-select unit, one per state." },
    { name: "decoder.sv", path: `${V}/decoder.sv`, lang: "sv", note: "Top of the decoder: 8 BMC + 8 ACS, survivor registers, best-state pick, output pipe." },
    { name: "tbu.sv", path: `${V}/tbu.sv`, lang: "sv", note: "Traceback unit from the starter scaffold — completed but not used by the final decoder." },
    { name: "viterbi_tx_rx_2a1.sv", path: `${V}/viterbi_tx_rx_2a1.sv`, lang: "sv", note: "Encoder → error injector → decoder; PERIOD/BURST/ERR_BIT parameters are the channel presets." },
    { name: "viterbi_tx_rx_tb.sv", path: `${V}/viterbi_tx_rx_tb.sv`, lang: "sv", note: "Course testbench: message generator and yaa!/boo! scoreboard." },
    { name: "model.ts", path: "src/demos/verilog/viterbi/model.ts", lang: "ts", note: "The TypeScript model driving the trellis — tested bit-exact against the Icarus run." },
    { name: "sim script", path: "scripts/demos/verilog.ts", lang: "ts", note: "Build-time runner: presets, VCD → JSON, module benches." },
    { name: "lfsr.sv", path: `${L}/hw5/lfsr.sv`, lang: "sv", note: "Module shelf: parameterised maximal-length LFSR." },
    { name: "uart_tx.sv", path: `${L}/hw8/uart_tx.sv`, lang: "sv", note: "Module shelf: UART transmitter." },
    { name: "uart_rx.sv", path: `${L}/hw8/uart_rx.sv`, lang: "sv", note: "Module shelf: UART receiver." },
    { name: "barrel_shifter.sv", path: `${L}/hw4/barrel_shifter.sv`, lang: "sv", note: "Module shelf: barrel shifter." },
    { name: "carry_lookahead_adder.sv", path: `${L}/hw6/carry_lookahead_adder.sv`, lang: "sv", note: "Module shelf: carry-lookahead adder." },
    { name: "NOTES.md", path: `${L}/NOTES.md`, lang: "text", note: "What was changed in the working copies to simulate under Icarus." },
  ],
  sourceFooter:
    "Starter code and testbenches were provided by the ECE 111 staff (UC San Diego); module implementations are David's. Simulated with Icarus Verilog; results committed with the page.",
};

export default meta;
