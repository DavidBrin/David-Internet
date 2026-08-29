# ECE111 Final Study Guide

## Part 1: Viterbi Encoder / Decoder First

### What a convolutional encoder does
A convolutional encoder is a sequential circuit that:
- accepts one input bit at a time
- keeps memory of recent past bits in flip-flops or state bits
- outputs multiple coded bits for each input bit

This project uses:
- rate `1/2`: one input bit produces two output bits
- constraint length `3`
- `8` states in the given state table

The decoder must know the exact encoder structure:
- rate
- constraint length
- state transition behavior
- output bits for each branch

If the decoder assumes the wrong trellis, it will decode incorrectly even if there is no noise.

### Why convolutional coding helps
The encoder spreads the information of each input bit across multiple output symbols and multiple clock cycles. That redundancy lets the decoder infer the most likely transmitted data even when some channel bits flip.

### Trellis idea
A trellis is a time-expanded state diagram:
- each column is a time step
- each node is a possible encoder state
- each branch is one possible input bit and the corresponding encoded output

The Viterbi algorithm searches the trellis for the minimum-cost path.

### Branch metric
A branch metric measures how well a received symbol matches one trellis branch.

In this project, the received symbol is a 2-bit pair, so the branch metric is based on Hamming distance:
- metric `0`: exact match
- metric `1`: one bit differs
- metric `2`: both bits differ

Important exam idea:
- in a clean channel, the correct branch should have branch metric `0`

### Path metric
A path metric is the accumulated cost of a path through the trellis:

`new path metric = old path metric + branch metric`

The best survivor into each state is the incoming path with the smaller total path metric.

### Add-Compare-Select
ACS is the core Viterbi operation:

1. Add branch metric to each candidate predecessor path metric.
2. Compare the two path costs.
3. Select the smaller one.

Outputs:
- winning cost
- winning predecessor selection bit
- valid flag

Exam idea:
- if only one predecessor path is valid, choose it automatically
- if neither predecessor is valid, output invalid

### Survivor path
For each state, the decoder stores only the best incoming path instead of all paths. This is what makes the Viterbi algorithm practical.

What gets stored:
- winner selection bits
- sometimes full survivor histories
- sometimes traceback memory

### Traceback
Traceback means:
- start from the best final state
- walk backward through stored decisions
- reconstruct the original data bits

Conceptually:
- the decoder does not guess one bit in isolation
- it finds the most likely state sequence
- that state sequence determines the input bit sequence

### Traceback depth
You usually wait several trellis stages before trusting a decoded bit. This is called traceback depth.

Why it matters:
- too short: output is noisy because the winner is not settled
- longer: more reliable, but more latency

### Viterbi decoder blocks
You should know these blocks cold:

1. Branch Metric Unit, BMU or BMC
2. Add Compare Select, ACS
3. Survivor memory
4. Traceback unit
5. Output pipeline / display memory / decoded bit output

### How the decoder decides what sequence was sent
The decoder:

1. Receives a noisy 2-bit symbol at each time step.
2. Scores every possible branch with a branch metric.
3. Updates path metrics for all states.
4. Keeps only one survivor path per state.
5. Chooses the globally best state after enough depth.
6. Reads out the oldest bit in that survivor path or traces back through stored decisions.

### Why minimum branch metric is zero with no errors
If the received symbol exactly equals the encoder branch label, the Hamming distance is `0`.

So with no channel corruption:
- the correct branch should always be available with branch metric `0`
- the correct path should remain globally favored

### State machine view of the encoder
A convolutional encoder is just a finite state machine:
- present state = register contents
- input bit chooses one outgoing branch
- branch outputs the code bits
- next state is determined by shifting in the input bit

Know how to read:
- state transition tables
- state diagrams
- output tables

### Human convolutional encoding
If asked to do this by hand:

1. Start from the initial state.
2. Apply the input bit.
3. Record the output pair.
4. Move to the next state.
5. Repeat for each bit.

### Human Viterbi decoding
If asked to decode by hand:

1. Draw a trellis for the received sequence.
2. Label each branch with the expected encoder output.
3. Compute branch metrics.
4. Accumulate path metrics.
5. Keep the best path into each state.
6. Trace back from the minimum-metric final state.

### Error correction intuition
The decoder does not directly detect "this bit was wrong." Instead it finds the path whose full encoded output sequence is closest to the received sequence.

This is maximum likelihood sequence detection.

### What can go wrong
Common failure cases:
- too many consecutive channel errors
- wrong encoder assumptions in the decoder
- wrong branch labels
- wrong trellis predecessor mapping
- wrong output alignment / latency
- path metrics overflow without normalization

### Useful Viterbi vocabulary
- code rate
- constraint length
- trellis
- branch
- branch metric
- path metric
- survivor path
- traceback
- Hamming distance
- maximum likelihood

## Part 2: Supporting Concepts for Viterbi

### Hamming distance
For equal-length bit strings, Hamming distance is the number of bit positions that differ.

Examples:
- `00` vs `00` -> `0`
- `00` vs `01` -> `1`
- `10` vs `01` -> `2`

### Registers and sequential logic
The encoder and decoder both rely on flip-flops:
- encoder state register
- decoder path metric registers
- survivor memory registers
- output delay pipeline

### Combinational vs sequential logic
Combinational logic:
- output depends only on current input
- examples: ACS compare logic, branch metric logic

Sequential logic:
- output/state depends on past clocks
- examples: encoder state, stored survivor paths

### Synchronous design
Most digital systems in this class are clocked systems:
- state updates happen on clock edges
- combinational logic computes next-state and outputs between edges

### Reset behavior
Know both:
- synchronous reset
- asynchronous reset

In this project, many modules use active-low asynchronous reset with sensitivity list:

`always @(posedge clk, negedge rst)`

Meaning:
- if `rst = 0`, reset immediately
- otherwise update on `posedge clk`

## Part 3: Given Final Topics

The following sections cover the topics listed in `Gemini-instructions.md`.

## Given An Algorithm Or Problem Statement, Write Verilog Code To Execute It

### General process
When converting an algorithm to Verilog:

1. Decide whether it is combinational, sequential, or a state machine.
2. Identify inputs, outputs, and internal state.
3. Split logic into:
   - next-state / combinational logic
   - state registers / sequential logic
4. Write clear reset behavior.
5. Think about bit widths.

### Common mistakes
- forgetting default assignments in combinational blocks
- mixing blocking and nonblocking assignments badly
- not handling all branches in a `case`
- using too few bits in counters or sums

## Hamming Code: Generating Parity Bits, Decoding Possibly Corrupted Encoded Sequences

### Basic idea
Hamming codes add parity bits so that:
- single-bit errors can be corrected
- some multiple-bit errors can be detected

### Parity generation
Each parity bit covers a certain subset of data bits. The parity is usually XOR of those covered bits.

### Syndrome
At the receiver:
- recompute expected parity
- compare with received parity bits
- the mismatch pattern is the syndrome

The syndrome points to the bit position in error.

### What to know
- where parity bits are placed
- how to compute syndrome bits
- how to flip the indicated bit
- difference between detection and correction

## Johnson, Ring, LFSR Counters

### Ring counter
A ring counter is a shift register with one bit recirculated.

Example:
- `0001 -> 0010 -> 0100 -> 1000 -> 0001`

Properties:
- one-hot sequence
- simple decoding

### Johnson counter
A Johnson counter feeds back the inverted last bit.

Example for 4 bits:
- `0000 -> 1000 -> 1100 -> 1110 -> 1111 -> 0111 -> 0011 -> 0001 -> 0000`

Properties:
- `2N` states for an `N`-bit register
- easy pattern generation

### LFSR
Linear Feedback Shift Register:
- shift register with XOR feedback taps
- used for pseudo-random sequences, CRC-like behavior, test patterns

Know:
- tap positions
- maximal-length sequence concept
- lock-up state issue for some forms

## Format Conversions Including Gray / Binary

### Binary to Gray
Formula:
- MSB stays the same
- each lower Gray bit is XOR of adjacent binary bits

`gray = binary ^ (binary >> 1)`

### Gray to binary
Recover binary from MSB downward:
- binary MSB = gray MSB
- each next binary bit = previous binary bit XOR current gray bit

### Why Gray code matters
Only one bit changes between adjacent values, which is useful in:
- counters
- position encoders
- clock-domain crossing situations

## Ripple, Carry Lookahead, And Carry Select Adders

### Ripple carry adder
Each bit waits for the carry from the previous bit.

Pros:
- simple

Cons:
- slow for large widths

### Carry lookahead adder
Uses generate and propagate logic to compute carries faster.

Definitions:
- generate `G = A & B`
- propagate `P = A ^ B` or sometimes `A | B`, depending on convention

Advantage:
- lower carry delay

### Carry select adder
Computes results for carry-in `0` and `1` in parallel, then selects the right one.

Advantage:
- faster than ripple

Cost:
- more hardware

### What to compare on exams
- delay
- area
- design complexity

## Correct My Verilog Code

### Typical debugging checklist
- are all signals declared with correct widths?
- are inputs and outputs the right type?
- are combinational blocks fully assigned?
- is reset handled?
- are `<=` and `=` used correctly?
- are there latch inferences?
- are `x` or `z` values appearing unexpectedly?
- are there race conditions in testbenches?

## Tell What My Verilog Code Does

### How to explain code systematically
When reading code:

1. Identify module inputs and outputs.
2. Find state registers.
3. Find combinational next-state logic.
4. Determine whether the module is:
   - datapath
   - controller
   - memory
   - counter
   - FSM
5. Trace one example input through the module.

## Case, If Else, Ternary, Priority Constructs

### `if ... else`
Good for:
- priority decisions
- range checks
- reset logic

### `case`
Good for:
- state machines
- exact value matching

### Ternary operator
Form:
- `assign y = sel ? a : b;`

Good for:
- short mux logic

### Priority
`if ... else if ... else` implies priority.

`case` may or may not imply priority depending on coding style and exclusivity of conditions.

### Common bug
If you forget an `else` or default assignment in combinational logic, a latch may be inferred.

## State Machines: Coding And Operation

### FSM basics
An FSM has:
- present state
- next-state logic
- outputs

### Moore vs Mealy
Moore:
- outputs depend only on state

Mealy:
- outputs depend on state and inputs

### Typical coding structure
Use:
- one block for state register
- one block for next-state / output combinational logic

### What to know
- state encoding
- reset state
- transition conditions
- output generation

## Data Types, Which Have X And Z, How Can These Be Used?

### `0`, `1`, `x`, `z`
- `0`: logic low
- `1`: logic high
- `x`: unknown
- `z`: high impedance

### Common Verilog data types
- `logic`
- `wire`
- `reg` in older Verilog
- packed vectors like `logic [7:0]`

### Where `x` comes from
- uninitialized registers
- conflicting drivers
- incomplete assignments
- unknown testbench stimulus

### Where `z` comes from
- tri-state buses
- disconnected drivers

### How they are used
- `x` is useful in simulation to reveal bugs
- `z` is useful for tri-state modeling, though internal FPGA logic usually avoids true tri-state nets

## Synchronous Vs Asynchronous Reset, Clear, Etc.

### Synchronous reset
Reset takes effect only on the clock edge.

Pros:
- easier timing integration in many flows

### Asynchronous reset
Reset takes effect immediately, independent of clock.

Pros:
- immediate clearing

Cons:
- reset release must be handled carefully

### Know the sensitivity list
- async reset: `always @(posedge clk or negedge rst)`
- sync reset: `always @(posedge clk)`

## Initialization Of Variables

### In synthesizable code
Usually do initialization through reset logic, not with `initial`, unless your target flow explicitly supports power-up initialization.

### In testbenches
`initial` blocks are common for:
- starting values
- stimulus
- clock startup
- file reading

## Figure Out The Structure A Particular Verilog Construct Generates

### Examples
- ternary operator -> mux
- `case` over state -> decode logic + muxing
- counter increment -> adder + register
- shift register -> chain of flip-flops
- memory array in clocked block -> inferred RAM or register array

### Exam habit
Always ask:
- what hardware is implied?
- combinational or sequential?
- how many flip-flops?
- any muxes, adders, comparators, or decoders?

## Initial Vs Always Vs Forever Blocks; Always_ff, Always_latch, Always_comb Grammar And Behavior

### `initial`
Runs once at time 0 in simulation.

Typical uses:
- testbench stimulus
- initialization

### `always`
Repeats forever.

Behavior depends on sensitivity list.

### `forever`
Usually used inside an `initial` block for endless repetition, often clocks.

Example idea:
- `initial forever #5 clk = ~clk;`

### `always_comb`
Use for combinational logic.

Benefits:
- automatic sensitivity list
- tool checks for combinational style

### `always_ff`
Use for flip-flop style sequential logic.

### `always_latch`
Use only when you intentionally want a latch.

### Common exam distinction
- combinational block: all outputs assigned for all paths
- sequential block: edge-triggered register updates
- latch block: level-sensitive storage when assignment is incomplete

## Human Convolutional Data Encoder

If given a bit stream:

1. Start from reset state.
2. For each input bit:
   - find output bits from the state table
   - update state
3. Record the encoded symbol stream

Be ready to do this from:
- generator polynomials
- shift-register taps
- direct state table

## Human Convolutional (Viterbi) Data Decoder / Error Corrector

If given received symbol pairs:

1. Draw the state columns.
2. Label possible branch outputs.
3. Compute Hamming distances.
4. Accumulate metrics.
5. Keep survivor per state.
6. Trace back.
7. Read out the estimated input bits.

## Quick Exam Checklist

Before the final, make sure you can do each of these without notes:

1. Encode a short input sequence with a convolutional encoder by hand.
2. Decode a short noisy sequence with Viterbi by hand.
3. Explain BMU, ACS, survivor memory, and traceback.
4. Compute Hamming distance and path metrics.
5. Write a small FSM in synthesizable Verilog.
6. Convert binary to Gray and Gray to binary.
7. Explain ring, Johnson, and LFSR counters.
8. Compare ripple, carry lookahead, and carry select adders.
9. Identify whether a block of Verilog is combinational or sequential.
10. Explain the effect of `x`, `z`, reset style, and incomplete assignments.

## Fast Memorization Summary

- Convolutional encoder: finite-state machine that outputs redundant bits.
- Viterbi decoder: minimum-metric trellis path search.
- Branch metric: local mismatch cost.
- Path metric: accumulated mismatch cost.
- ACS: add, compare, select.
- Survivor path: best path entering each state.
- Traceback: reconstruct transmitted bits from stored decisions.
- `always_comb`: combinational.
- `always_ff`: flip-flops.
- `x`: unknown.
- `z`: high impedance.
- Ring counter: recirculating one-hot shift.
- Johnson counter: inverted feedback shift.
- LFSR: XOR feedback pseudo-random sequence.
