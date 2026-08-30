import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "verilog",
  kind: "demo",
  displayName: "Verilog",
  fakeDomain: "verilog.davids.net",
  liveUrl: "/demos/verilog",
  tagline: "An 8-state Viterbi decoder you can watch think, plus the RTL module library behind it.",
  description:
    "Interactive demo of the ECE 111 SystemVerilog work: a rate-1/2 convolutional encoder, a noisy channel with the assignment's error patterns, and an animated trellis where eight add-compare-select units race and a traceback pulls the message back out. Waveforms come from a real Icarus Verilog simulation of the RTL run at build time, with a pass/fail table per error pattern. Below it, a shelf of the course's modules — UART, barrel shifter, LFSR, carry-lookahead adder, Gray converter, clock divider, ALU, Johnson counter — each as a live widget next to its code and testbench verdict.",
  accentColor: "#0EA5E9",
  favicon: "🔲",
  techStack: ["SystemVerilog", "Icarus Verilog", "Quartus Prime", "ModelSim/Questa", "TypeScript", "Canvas"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#viterbi",
      title: "Viterbi decoder — trellis animation",
      snippet:
        "Type a message, pick a channel error pattern, and watch branch metrics, add-compare-select and the traceback recover the bits. A 'match RTL' mode replays the exact run the simulator saw.",
      keywords: ["viterbi decoder", "trellis", "convolutional code", "add compare select", "traceback"],
    },
    {
      path: "#waves",
      title: "Logic analyzer — Icarus Verilog waveforms",
      snippet:
        "Per-cycle traces of the encoder, error injector, eight path metrics and the decoded output from a build-time simulation, with the scoreboard for every error pattern and the burst-length sweep.",
      keywords: ["waveform", "logic analyzer", "icarus verilog", "vcd", "simulation", "testbench"],
    },
    {
      path: "#uart",
      title: "UART — module shelf",
      snippet: "Start bit, eight data bits, stop bit: a character clocks out of the transmitter and is reassembled by the receiver.",
      keywords: ["uart", "serial", "baud", "uart_tx", "uart_rx"],
    },
    {
      path: "#lfsr",
      title: "LFSR — module shelf",
      snippet: "A parameterised maximal-length linear-feedback shift register with loadable taps and seed; watch it return to its seed after 2^N−1 steps.",
      keywords: ["lfsr", "linear feedback shift register", "pseudo random", "maximal length"],
    },
    {
      path: "#barrel",
      title: "Barrel shifter — module shelf",
      snippet: "Bits slide through log2(N) mux stages as the shift amount changes.",
      keywords: ["barrel shifter", "shifter", "mux stages"],
    },
    {
      path: "#cla",
      title: "Carry-lookahead adder — module shelf",
      snippet: "Generate/propagate carries race a ripple-carry adder side by side.",
      keywords: ["carry lookahead adder", "cla", "ripple carry", "adder"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "verilog",
    "systemverilog",
    "viterbi",
    "viterbi decoder",
    "convolutional code",
    "error correction",
    "fpga",
    "rtl",
    "uart",
    "lfsr",
    "barrel shifter",
    "carry lookahead adder",
    "johnson counter",
    "gray code",
    "clock divider",
    "alu",
    "ece 111",
    "icarus verilog",
    "hardware description",
  ],
  knowledgePanel: {
    type: "Interactive demo",
    facts: {
      Headline: "8-state, rate-½ Viterbi decoder (encoder, channel, trellis, traceback)",
      Modules: "14 on the shelf — UART tx/rx, barrel shifter, LFSR, CLA, Gray→binary, clock divider, ALU, counters, Johnson counter, decoder/adder/mux in three styles, convolutional encoder",
      Verified: "Build-time Icarus Verilog simulation; pass/fail per error pattern and per module testbench",
      "TS model": "Bit-exact with the RTL — path metrics checked every cycle in the test suite",
      Tools: "SystemVerilog, Quartus Prime, ModelSim/Questa (course), Icarus Verilog (this page)",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
