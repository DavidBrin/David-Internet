# LFSR (Linear Feedback Shift Register) — RTL and Report Notes

## Overview

This directory contains a parameterized N-bit maximal-length LFSR in SystemVerilog and its testbench. The design supports N = 2 through 8, uses XOR feedback, and matches the ports and behavior required.

## Files

- **lfsr_starter.sv** — Parameterized LFSR module (implementation in the same file).
- **lfsr_testbench.sv** — Testbench with built-in checker; set `parameter N` to 2–8.
- **lfsr_experiment.sv** — Part 2: sweeps seeds and tap patterns to show maximal-length behavior.
- **rslt.txt** — Simulation log produced by the testbench (e.g. `$fdisplay(3,...)`).

## Module Interface

- **clk** — Clock (posedge used).
- **reset** — Synchronous, active-low. Resets state to all 1s and tap pattern to the default primitive polynomial for the current N.
- **load[1:0]** — Synchronous, active-high.  
  - **load[1]** — Load **seed**: `lfsr_data` and internal `seed_data` are set to `seed_mask`.  
  - **load[0]** — Load **tap pattern**: internal `tap_ptrn` is set to `seed_mask`.
- **seed_mask[N-1:0]** — Input used as either initial LFSR value (when load[1]) or tap pattern (when load[0]).
- **lfsr_data[N-1:0]** — Output: current N-bit state of the shift register.
- **lfsr_done** — High for one cycle when `lfsr_data == seed_data` (i.e., when the sequence has returned to the stored seed).

## Behavior

1. **Reset (reset = 0)**  
   - `lfsr_data` and `seed_data` are set to all 1s.  
   - `tap_ptrn` is set to the default tap mask for the chosen N (see below).

2. **Load seed (load[1] = 1)**  
   - `lfsr_data` and `seed_data` are set to `seed_mask`.  
   - This is the value that `lfsr_done` will compare against when the sequence returns.

3. **Load tap pattern (load[0] = 1)**  
   - `tap_ptrn` is set to `seed_mask`.  
   - A 1 in bit i of `tap_ptrn` means bit i of `lfsr_data` is used in the XOR feedback.

4. **Normal step (no load)**  
   - Feedback bit = XOR of all bits where `tap_ptrn` is 1: `feedback = ^(lfsr_data & tap_ptrn)`.  
   - Register shifts left and the vacated LSB is filled with `feedback`:  
     `lfsr_data <= {lfsr_data[N-2:0], feedback}`.

5. **lfsr_done**  
   - Combinational: `lfsr_done = (lfsr_data == seed_data)`.  
   - So it goes high for one cycle each time the LFSR state equals the last loaded seed.

## Default Tap Patterns (Primitive Polynomials)

Default tap masks (used after reset) are one primitive polynomial per N for maximal length 2^N − 1:

| N | Polynomial (1-based tap positions) | Tap mask (MSB..LSB) |
|---|------------------------------------|----------------------|
| 2 | x² + x + 1                         | 2'b11                |
| 3 | x³ + x² + 1                        | 3'b110               |
| 4 | x⁴ + x³ + 1                        | 4'b1100              |
| 5 | x⁵ + x³ + 1                        | 5'b10100             |
| 6 | x⁶ + x⁵ + 1                        | 6'b110000            |
| 7 | x⁷ + x⁶ + 1                        | 7'b1100000           |
| 8 | x⁸ + x⁶ + x⁵ + x⁴ + 1             | 8'b10111000          |

Bit index 0 is LSB; a 1 in position i means that `lfsr_data[i]` is included in the XOR feedback.

## Testbench and Checking

- Set **parameter N** in `lfsr_testbench.sv` to 2–8.  
- The checker prints **SUCCESS!!!** when, after the LFSR runs, it returns to the seed value exactly **2^N − 1** cycles after the relevant start (e.g. after reset or after the last load).  
- For N=5 and N=6 the testbench uses custom `seed_mask` values (e.g. 8'h12, 8'h21) for both seed and tap loads; the design supports any legal seed and tap pattern.  
- Run simulation for all N = 2..8 to satisfy “test all 7 scenarios.”

## Notes for Your Report

### 1. Brief project description

- State that the design is a **parameterized N-bit maximal-length LFSR** (N = 2..8), with XOR feedback, synchronous active-low reset, and loadable seed and tap pattern.  
- Mention that **lfsr_done** indicates when the state has returned to the loaded seed (one cycle per return).

### 2. Synthesis (N = 4)

- **Resource usage:** Run synthesis for **N = 4** and report:  
  - Number of flip-flops (or “registers”) and other resources (LUTs, etc.), as given by your synthesis tool.  
- **Schematic / RTL netlist:**  
  - From the RTL/netlist viewer, capture the schematic for N = 4.  
  - Briefly describe: N flip-flops for the state, combinational logic for the XOR of tapped bits and the shift, and any logic for load/reset and `lfsr_done`.

### 3. Simulation (N = 4 and N = 7)

- **Waveforms:**  
  - Show a simulation snapshot that includes: **clk**, **reset**, **load**, **seed_mask**, **lfsr_data**, **lfsr_done**.  
  - Include the **end-of-run** portion of the simulation for **N = 4** and **N = 7** as specified.  
- **Explanation:**  
  - Point out one cycle where **lfsr_done** goes high and **lfsr_data** equals the seed.  
  - State that the sequence length is **2^N − 1** (e.g. 15 for N=4, 127 for N=7) and that the checker confirms SUCCESS when the return happens at the right cycle.

### 4. Verification for all N

- Note that the provided testbench checker was used for **N = 2, 3, 4, 5, 6, 7, 8** and that “SUCCESS!!!” was observed for each.  
- State that you submitted the exact testbench and LFSR code used for grading.

### 5. Optional extra for the report

- **Default polynomials:** You can include the table above (or the equivalent from the homework) and state that the default tap pattern after reset is a primitive polynomial so that the period is 2^N − 1 for any non-zero seed.  
- **Custom taps:** Mention that loading a different tap pattern via **load[0]** and **seed_mask** allows other maximal-length polynomials (e.g. the testbench’s N=5 and N=6 cases).

---

## Part 2: Experiment — Feedback Polynomials and Starting Values

### What you are showing

- **Any nonzero starting value (seed) works:** For a **fixed** maximal-length feedback polynomial, every nonzero seed produces the same period 2^N − 1. The LFSR simply visits the same set of 2^N − 1 states in a different cyclic order; only the all-zero state is excluded (and would never be left once entered). So you can change the seed (via `load[1]` and `seed_mask`) and confirm the period is still 2^N − 1.
- **Only a small subset of tap patterns are maximal length:** There are 2^N − 1 possible nonzero N-bit tap patterns, but only a few correspond to **primitive** polynomials. Those are the ones that yield a period of exactly 2^N − 1. All other tap patterns give a shorter period (or degenerate behavior). So when you change the tap pattern (via `load[0]` and `seed_mask`), most choices will **not** walk through all 2^N − 1 nonzero states.

### How to do the experiment

1. **Experiment with starting values**
   - Keep the **tap pattern** fixed to a known maximal-length one (e.g. the default after reset, or one of the primitive polynomials from the table).
   - For several **nonzero** values of `seed_mask`, do: load seed with `load[1]`, then run the LFSR until `lfsr_done` goes high.
   - Measure the number of steps from the cycle after the load until `lfsr_done`. You should get **2^N − 1** for every nonzero seed. (A seed of 0 would be a special case and is not required to “work.”)

2. **Experiment with feedback polynomials**
   - Keep a **fixed nonzero seed** (e.g. all 1s).
   - For many different **tap patterns** (e.g. 1 to 2^N − 1), do: load seed, then load tap with `load[0]`, then run until `lfsr_done`.
   - Measure the period (steps until return to seed). Only tap patterns that are primitive polynomials will give period = 2^N − 1; the rest will give a smaller period. You can count how many tap patterns yield maximal length vs. total tried.

3. **Using the experiment testbench**
   - **lfsr_experiment.sv** automates this: it tries several nonzero seeds (with default tap) and then sweeps all nonzero tap patterns (with seed = all 1s), measures the period each time, and reports which seeds passed and how many tap patterns had period 2^N − 1. Run it for a chosen N and use the log/report in your writeup.
   - For the report you can summarize: “Tried seeds …; all gave period 2^N − 1. Swept 2^N − 1 tap patterns; X gave maximal length,” and optionally list or plot which tap patterns were maximal length.
