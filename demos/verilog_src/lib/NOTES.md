# ECE 111 module library — working copies for build-time simulation

Working copies of `demos/ece111_rtl_library_raw/`. The raw folder is untouched. Every
change made here is listed below. All 17 benches in `benches.json` compile with
`iverilog -g2012` and pass under Icarus Verilog 11 (checked 2026-08-30 in a scratch dir,
cwd = run dir, stdin closed).

## Runner notes

- `$stop` hangs plain `vvp` on Windows (it opens the interactive prompt and never sees EOF),
  so every testbench's terminating `$stop` was changed to `$finish`. `vvp -n` would also work.
- No bench needs a data file in the run dir: the Johnson testbench's `$readmemb("right.txt")`
  was replaced by the same 49 values embedded in the testbench (the runner copies only the
  listed `.sv` files). `hw3/right.txt` is kept for reference.
- `hw4/8bits_barrel_shifter_testbench.sv` and `hw5/lfsr_testbench.sv` write `shifter_rslt.txt`
  / `rslt.txt` through `$fdisplay(3, ...)` (stdout + file). `hw5/lfsr_autograder_testbench.sv`
  writes `lfsr_rslt3.txt`.
- `cla` and `clkdiv` testbenches print nothing on success (only on error), so their checks are
  `mustNotMatch` only; a compile/run failure must be reported as `error` by the runner.
- The conda-packaged `vvp.exe` / `iverilog.exe` in `C:\Users\david\iverilog-env\Library\bin` link
  against Git's mingw64 runtime (`libstdc++-6.dll`, `libgcc_s_seh-1.dll`, `libwinpthread-1.dll`).
  They run from Git Bash (or any process whose PATH includes `C:\Program Files\Git\mingw64\bin`);
  from plain PowerShell they exit with 0xC0000135 (DLL not found).
- All `check` regexes are plain JS `new RegExp(p)` patterns with no flags. Counted patterns use
  tempered tokens (`(?:TOK(?:(?!TOK)[\s\S])*){n}`) so they cannot backtrack catastrophically;
  `lfsr-autograder` uses a `\1` backreference (`passed N of N`).
- The whole set was also run through a Node script that follows the runner contract exactly
  (compile, `vvp out.vvp` with stdin ignored, stdout + written `.txt` concatenated, checks
  applied): 17/17 pass.

## Per-file changes

| File | What was wrong / missing | What was done |
|---|---|---|
| hw1/decoder.sv, hw1/fulladder.sv, hw1/mux_2x1.sv | The provided testbenches instantiate generic module names (`decoder`, `fulladder`, `mux_2x1`) that none of the three style files define. | Added wrapper modules with those names that instantiate all three styles from the same inputs, output the gate-level result, and print `AGREE`/`MISMATCH` after every input change (5 ns settle because `mux_2x1_gate` has a `#1.5` OR delay). |
| hw2/alu_enum.sv | `cmde = opa'(cmd);` (a waveform-only alias of `cmd`) — enum casts are unsupported by Icarus 11. | Commented that line out; `cmde` stays declared, nothing else changed. |
| hw2/alu_enum_testbench.sv | No testbench existed for the 16-bit `alu_e`. | New self-checking testbench: 12 vectors covering all 8 `opa` commands, including signed vs. logical right shift and wraparound. |
| hw2/alu_top_testbench.sv, hw2/counter_4bit_testbench.sv | `$stop` (see runner notes). | `$stop` -> `$finish`. Outputs verified by script: every registered result equals op(a,b); counter sequence is monotone with wrap and reset. |
| hw3/johnson_counter_testbench.sv | Raw folder has two testbenches. `right.txt` (49 golden values) matches the ` - Copy` version (`load_cnt = 4'b1000`, 100 ns after preset); the other loads `4'b1100` and runs 500 ns, so it mismatches `right.txt` from the load onwards and then reads past the end of the array. No `timescale`, so `#5ns` rounds to 0 under Icarus's default 1 s scale (elaboration error). | Used the ` - Copy` testbench as `johnson_counter_testbench.sv`; added `timescale 1ns/1ns`; `$stop` -> `$finish`; the `$readmemb("right.txt")` line is replaced by a `localparam RIGHT` holding the same 49 values (index 0 first) plus a loop that fills `count0`, so the bench runs from the `.sv` files alone. |
| hw3/right.txt | Trailing stray line `48` (a line count) makes Icarus's `$readmemb` abort with "Invalid input character". | Kept only the 49 4-bit values; the file is reference only now (values are embedded in the testbench). |
| hw4/8bits_barrel_shifter_testbench.sv | Already ends with `$finish()`; unchanged. | Golden output `8bits_rslt.txt` copied as `hw4/rslt_expected.txt`; both the behavioral shifter and the three-stage mux version (`barrel_shifter - Copy.sv` -> `hw4/barrel_shifter_mux_stages.sv`) match it line for line (2048 lines). |
| hw5/lfsr.sv | `function logic [N-1:0] default_tap; input int n;` — the non-ANSI function header is a syntax error in Icarus 11. | Rewritten as `function automatic logic [N-1:0] default_tap(input int n);`. Logic unchanged. |
| hw5/lfsr_testbench.sv | `$stop` -> `$finish` only. Note: the provided bench never asserts `reset` (uninitialised `logic`; the `reset = '0` lines are commented out), so `lfsr_data` is X for the first 2^N cycles, and its checker prints `WRONG!!!` twice during the two load cycles (`ct_start` is set on the same edge). Those are testbench artifacts, not design failures; the meaningful line is `dif = 63 = 2^6-1  SUCCESS!!!` after the loaded seed/tap, which is what the check requires. | Only the `$stop` edit. |
| hw5/lfsr_autograder_testbench.sv | Copy of `autograder_lfsr_testbench3.sv` (N=3, golden-model checker). | Unchanged; passes 17/17. |
| hw5/lfsr_sweep_testbench.sv | Nothing in the raw folder exercises all N = 2..8 in one run. | New testbench: seven `lfsr` instances measure the period from the reset state; all report `2^N-1` (3, 7, 15, 31, 63, 127, 255). |
| hw6/gray_code_to_binary_convertor_testbench.sv | Instantiates `gray_code_to_binary_convertor_starter` (the design is `gray_code_to_binary_convertor`); no `timescale` (see hw3). | Module name fixed; `timescale 1ns/1ns` added; `$stop` -> `$finish`. 16/16 `YAA!`. |
| hw6/carry_lookahead_adder_testbench.sv | Instantiates `carry_lookahead_adder_starter`. | Module name fixed. Silent on success (57 random + directed vectors). |
| hw6/clock_div_by_N.sv | Taken from `testbenches & starter code/clock_divide_by_N.sv` (the only design file; complete despite the folder name — counts on both clock edges to get a 50/50 output). Icarus warns that `always_ff @(clkin or posedge reset)` is not edge-only; simulation is fine. | Copied unchanged. Paired with the top-level `clock_divide_by_N_testbench.sv` (both-edge checker); `$stop` -> `$finish`. |
| hw7/conv_enc.sv | The task brief said the module body was empty; this copy of the raw file already contains the full N-bit shift register, two mask registers loaded via `load_mask`, and `data_out[k] = ^(mask_k & history)`. | Verified as-is against the provided golden-model testbench: 86/86 `YAA!`. Unchanged. |
| hw7/conv_enc_tb.sv | No `timescale`; five `$stop`s, the first four being waveform-inspection pauses that would end a batch run early. | `timescale 1ns/1ns` added; intermediate `$stop`s removed (commented), last one -> `$finish`. |
| hw8/uart_top_testbench.sv | `$stop` -> `$finish` (normal end and the error branch). | 4/4 bytes received correctly (0xA5, 0xA8, 0xAB, 0xAE). |

## RTL bugs found

None in the shipped designs: every module behaves as its testbench expects once the
simulator-compatibility issues above are fixed. The only design edits are the two Icarus
syntax workarounds (`hw2/alu_enum.sv` enum cast, `hw5/lfsr.sv` function header).

## Bench results (Icarus Verilog 11, 2026-08-30)

decoder PASS · fulladder PASS · mux PASS · alu PASS (12/12) · alu4 PASS · counter PASS ·
johnson PASS (49/49) · barrel PASS (2048-line golden) · barrel-mux PASS (2048-line golden) ·
lfsr PASS (dif=63) · lfsr-autograder PASS (17/17) · lfsr-sweep PASS (7/7 maximal) ·
gray PASS (16/16) · cla PASS (silent) · clkdiv PASS (silent) · convenc PASS (86/86) · uart PASS (4/4)
