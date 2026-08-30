# Verilog — demo page

Live at [/demos/verilog](/demos/verilog). This page is a demo built inside David's Internet, not a vendored project: the archive it was made from lives in `demos/viterbi_decoder_fpga_raw/` and `demos/ece111_rtl_library_raw/`, the working copies that actually simulate in `demos/verilog_src/`, and the build script in `scripts/demos/verilog.ts`.

## What is on the page

**Viterbi decoder.** A rate-½, 8-state (constraint length 3) systematic recursive convolutional encoder, the assignment's error injector (`PERIOD`, `BURST`, `ERR_BIT0`, `ERR_BIT1`), and the decoder: eight branch-metric blocks, eight add-compare-select units, one survivor register per state, a best-state pick, and a long output pipe that lines the decoded stream up with the testbench's scoreboard. The trellis animation is driven by a TypeScript model of the same RTL that the test suite checks bit-for-bit against the simulator's path metrics every clock cycle. The RTL pane follows the animation: encoder table → injector → `bmc` → `ACS` → survivor update → output.

**Logic analyzer.** Per-cycle waveforms from Icarus Verilog running the course testbench on the RTL for every error pattern in the assignment (2.a.1–2.a.8, a random variant, and the burst-length sweeps of 2.c–2.e). Results are committed to `public/demos/verilog/viterbi.json` so the site builds without a Verilog toolchain.

**Module shelf.** The ECE 111 homework modules, each a live widget: UART transmitter/receiver, barrel shifter, LFSR, Gray-to-binary converter, carry-lookahead adder vs ripple carry, divide-by-N clock, 16-bit ALU, 4-bit counter, Johnson counter, the decoder/full-adder/mux "three styles" set, and the programmable convolutional encoder. Each card shows its RTL and the verdict of its testbench from the same build-time run.

## What was completed or fixed

The decoder had been completed with AI coding tools from the course scaffold and never simulated. Simulating it for this page:

- `encoder.sv` — the starter's case table was empty ("fill in the guts"); it was completed from the assignment's state/output table.
- `decoder.sv` — the best-state search (an accumulator loop inside `always_comb`) and the survivor-history update (an array written and read in the same block) made Icarus Verilog re-trigger forever at t = 0; both were rewritten as continuous assignments with identical behaviour. A flattened `path_cost_flat` wire was added for the VCD dump.
- `bmc0.sv` — the same idiom, rewritten as assigns.
- `viterbi_tx_rx_2a1.sv` — `{ERR_BIT1, ERR_BIT0}` evaluated to `2'b00` under Icarus when the `bit` parameters were overridden with unsized `1` (the parameters stayed 32 bits wide), so every bit[1] preset silently injected nothing and "passed". The TypeScript model's bit-exactness test caught it; the mask is now built from explicit 1-bit values and the runner passes sized literals.
- Module library — see `demos/verilog_src/lib/NOTES.md` for the per-file notes (the hw7 `conv_enc` module body was empty in the archive and was completed).

The output delay (4039-stage pipe + 66 cycles of encoder/ACS/traceback latency = 4105 cycles) matches the testbench's `#410500ns` scoring window exactly; the clean run scores 256/256.

## Building

```
pnpm sync-demos verilog    # needs iverilog/vvp (IVERILOG_BIN=<dir> if not on PATH)
pnpm test                  # includes the bit-exactness tests against viterbi.json
```

## Attribution

Starter code and testbenches were provided by the ECE 111 staff at UC San Diego; module implementations are David's. Simulated with Icarus Verilog 11.
