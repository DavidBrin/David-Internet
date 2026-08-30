# 06 — Verilog (ECE 111 RTL, 2025) — Viterbi decoder headline + module library

Slug: `verilog` · Fake domain: `verilog.davids.net` · Archetype: **A** (interactive) + Story rail
Status: spec agreed 2026-08-29; **not built**.

Page is called **"Verilog"** (not ECE111). Course/starter-code citation appears once, in the
Source drawer footer; nothing else on the page cites.

## Summary

One page: the Viterbi decoder is the headline — encoder, noisy channel, and an animated
trellis with ACS units competing per state and a glowing traceback — with the real
SystemVerilog beside it, module by module, highlighted as its stage runs. A logic-analyzer
panel shows waveforms **from an actual simulation of the RTL run at build time**. Below it,
a module library shelf (UART, barrel shifter, LFSR, CLA, Johnson counter, Gray→binary,
clock divider, ALU, the three-styles-of-one-circuit set) where each card is a small live
widget driven by a TS model of that module, with its RTL alongside.

**Verification is part of the demo.** The Viterbi RTL completion was done with AI tools and
never simulated (`Implementation-Info.md`: "I did not run the project in this pass"). The
build step simulates the provided testbench (`viterbi_tx_rx_tb.sv`) with Icarus Verilog,
the RTL gets fixed until the scoreboard passes for the assignment's error patterns, and
the resulting VCD becomes the waveform panel. Story rail states this plainly in one line.

## Source material

`demos/viterbi_decoder_fpga_raw/`:

| File | Role |
|---|---|
| `rtl/encoder.sv` (8-state, rate-1/2 table), `rtl/bmc0.sv` (`bmc` w/ `INVERT_RX1` param), `rtl/ACS.sv`, `rtl/tbu.sv`, `rtl/mem_8x1024.sv`, `rtl/decoder.sv`, `rtl/viterbi_tx_rx_2a1.sv` (encoder → error injector → decoder, params `PERIOD/BURST/ERR_BIT0/ERR_BIT1/USE_RAND`) | The design; shown module-by-module; simulated at build |
| `rtl/viterbi_tx_rx_tb.sv` (scoreboard `good/bad`, 2048-bit history), `rtl/encoder_tb.sv`, `conv_encoder/*_tb.sv` | Build-time simulation; the 2.a.1–2.a.8 error-pattern presets become the channel presets |
| `Implementation-Info.md` | Design rationale for the Story rail; also the honesty note |
| `E111-Final-Viterbi.pdf`, `Study-Guide.md` | Drawer link / not shipped |

`demos/ece111_rtl_library_raw/` (module shelf):

| Folder | Module(s) | Widget |
|---|---|---|
| `hw8_uart` | `uart_tx`, `uart_rx`, `uart_top` | Type a character → start bit, 8 data bits, stop bit clock out on a scope; RX reassembles it; baud slider |
| `hw4_barrel_shifter` | `barrel_shifter` (8-bit + general N) | Bits physically slide through the mux stages (log2 N layers) as you change shift amount/direction |
| `hw5_lfsr` (has README) | parameterized N=2–8 maximal-length LFSR with loadable taps/seed | Shift register animates; sequence plotted around a circle; "done" flashes when it returns to seed; tap editor shows non-maximal cycles |
| `hw6_gray_cla_clkdiv` | Gray→binary, carry-lookahead adder, divide-by-N clock | Gray code wheel; CLA carries propagate vs ripple side-by-side race; clock divider scope |
| `hw2_alu_counter` | 16-bit MIPS-style ALU (`alu_enum.sv`), 4-bit counter | Op selector + two operands → result/flags; counter ticks |
| `hw3_johnson_counter` | Johnson counter | Ring of flip-flops lighting in Johnson sequence |
| `hw1_decoder_adder_mux_three_styles` | 2-to-4 decoder, full adder, 2×1 mux — each in gate / dataflow / behavioral style | Tri-column code view; toggle inputs → all three implementations light identically |
| `hw7_conv_encoder` | `conv_enc` | Reused as the Viterbi encoder stage |

## Stage

### 1. Viterbi — encoder → channel → trellis → traceback (headline)
- **Encoder:** type or stream input bits; the 3-bit state register animates through the
  `encoder.sv` table (row highlights), emitting a 2-bit symbol per input bit.
- **Channel:** presets matching the testbench comments — 2.a.1 … 2.a.8 (`PERIOD`, `BURST`,
  `ERR_BIT0/1`) and a random mode — plus a free noise slider; flipped bits shown in red on
  the symbol stream.
- **Trellis:** unrolls left→right (8 states × time). For each step the eight **BMC**
  blocks compute branch metrics (Hamming distance shown as small numbers), each **ACS**
  unit lights both candidate branches, keeps the lower-cost one (loser fades), and writes
  a survivor bit (`tbu`/`mem_8x1024` cell fills). Path metrics displayed per state.
- **Traceback:** after the decode delay, a glowing path walks backwards through the
  survivors and decoded bits pop out at the bottom, compared with the original — "errors
  injected: N · errors corrected: N · residual: M". Push the burst length up "until boo!"
  (the testbench comment) to find the correction limit live.
- Speed control (step / 1× / fast); "match RTL" button loads the exact bitstream from the
  build-time VCD so the trellis and the waveform panel show the same run.

### 2. Logic analyzer (real simulation)
- Waveform viewer (canvas) of the build-time VCD: `clk`, `rst`, `encoder_i`,
  `enable_encoder_i`, encoded pair, error-injector output, path metrics for 8 states,
  `decoder_o`, scoreboard `good/bad`. Zoom/pan, cursor with values, and a link from each
  trellis step to its clock cycle.
- Header shows the pass/fail summary per error pattern (the assignment's 2.a table) as
  produced by the build.

### 3. RTL beside the animation
- The `.sv` source in a split pane; as the trellis runs, the module currently "executing"
  (`bmc` → `ACS` → `tbu` → `decoder` output stage) is highlighted; click any module to pin
  it. `Implementation-Info.md` decisions surface as margin notes.

### 4. Module shelf
- Grid of cards (table above); each opens inline to its widget + RTL + a "run testbench"
  result badge from the build step (pass/fail counts from each `*_testbench.sv`).
- Animation per card is the module's own behavior (shift, propagate, count) — no generic
  "code viewer".

## Build-time simulation (`scripts/sim-verilog.ts`)

- Requires **Icarus Verilog** (`iverilog`/`vvp`) — not currently installed on the build
  machine (checked 2026-08-29); install via OSS CAD Suite or `choco install iverilog`.
  Results (VCD → compact JSON, pass/fail table) are **committed** so CI/Vercel builds don't
  need the toolchain.
- Runs: Viterbi tb for each preset (edit the parameter line programmatically), each ECE111
  module testbench. Compact VCD to `public/demos/verilog/waves/*.json` (value-change lists,
  ≤ 200 KB each).
- Fix loop: the first build will surface whatever is wrong in the never-simulated
  `decoder.sv`/`tbu.sv`; fix in `demos/verilog_src/` (a working copy — `_raw` stays
  untouched) and record what changed in the Story rail.

## Story rail

1. Why Verilog: describing hardware, not instructions; the three-styles exercise as the
   first "aha".
2. The library, in order built: decoder/adder/mux → ALU → counters → shifter → LFSR →
   CLA/clock divider → convolutional encoder → UART.
3. The final: a rate-1/2, 8-state convolutional code and a Viterbi decoder — what ACS and
   traceback do, in two sentences each.
4. One line: the decoder was completed with AI tooling and hadn't been simulated; it was
   simulated for this page, fixed where needed, and the waveforms here are from that run.
5. What the burst-error sweep showed (fill from the build results).

## Source drawer

- Tabs: each RTL file; the TS models (`verilog/viterbi.ts`, `verilog/uart.ts`, …); the
  sim script. Footer (single citation line): course starter code and testbenches provided
  by the ECE 111 staff; module implementations by David.

## Manifest (`content/verilog/site.ts`)

- displayName "Verilog", favicon "🔲", accent `#0EA5E9`.
- deepLinks: `/demos/verilog#viterbi`, `#waves`, `#uart`, `#lfsr`, `#barrel`, `#cla`.
- techStack: SystemVerilog, Icarus Verilog, Quartus, ModelSim (course), TypeScript.
- knowledgePanel facts: Headline (8-state rate-1/2 Viterbi decoder) · Modules (14) ·
  Verified (build-time simulation, pass/fail per error pattern) · Tools.
- keywords: verilog, systemverilog, viterbi, convolutional code, uart, lfsr, barrel
  shifter, fpga, rtl.

## Attribution

- Single footer line (see Source drawer). No per-module citations.
- The AI-assisted completion is stated once in the Story rail (beat 4).

## Out of scope

- Synthesis/FPGA bitstreams, timing analysis, running Verilog in the browser (no WASM
  simulator — everything is pre-simulated or TS-modeled).

## Resolved questions (2026-08-29)

1. Install Icarus Verilog on the build machine for `sim-verilog.ts` (results committed).
2. All ECE111 modules go on the shelf; testbench results set the badges.
