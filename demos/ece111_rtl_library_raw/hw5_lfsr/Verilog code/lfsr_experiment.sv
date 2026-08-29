`timescale 1ns/1ns

module lfsr_experiment;
  parameter N = 4;
  logic         clock;
  logic         reset;
  logic [1:0]   load;
  logic [N-1:0] seed_mask;
  wire [N-1:0] lfsr_data;
  wire         lfsr_done;

  lfsr #(.N(N)) dut (
    .clk       (clock),
    .reset     (reset),
    .load      (load),
    .seed_mask (seed_mask),
    .lfsr_data (lfsr_data),
    .lfsr_done (lfsr_done)
  );

  logic [31:0] period;
  int          seed_pass, seed_fail, tap_maximal, tap_total;
  logic [N-1:0] tap_val;

  initial begin
    clock = 0;
    reset = 0;
    load  = 0;
    seed_mask = '1;
    #20ns;
    reset = 1;
    #10ns;

    $display("--- Part 1: Different nonzero starting values (default tap) ---");
    seed_pass = 0;
    seed_fail = 0;
    for (int s = 1; s < (1 << N); s++) begin
      seed_mask = s[N-1:0];
      load      = 2'b10;
      @(posedge clock);
      load      = 2'b00;
      period    = 0;
      repeat (1 << N) begin
        @(posedge clock);
        period = period + 1;
        if (lfsr_done) break;
      end
      if (period == (1 << N) - 1) begin
        seed_pass++;
        $display("  seed %0d (%b): period = %0d (maximal) PASS", s, s[N-1:0], period);
      end else begin
        seed_fail++;
        $display("  seed %0d (%b): period = %0d (expected %0d) FAIL", s, s[N-1:0], period, (1 << N) - 1);
      end
    end
    $display("  Summary: %0d passed, %0d failed (all nonzero seeds should pass with default tap).", seed_pass, seed_fail);
    $display("");

    $display("--- Part 2: Different feedback polynomials (seed = all 1s) ---");
    tap_maximal = 0;
    tap_total   = (1 << N) - 1;
    for (int t = 1; t <= (1 << N) - 1; t++) begin
      tap_val   = t[N-1:0];
      reset     = 0;
      @(posedge clock);
      reset     = 1;
      @(posedge clock);
      seed_mask = '1;
      load      = 2'b10;
      @(posedge clock);
      seed_mask = tap_val;
      load      = 2'b01;
      @(posedge clock);
      load      = 2'b00;
      period    = 0;
      repeat (1 << N) begin
        @(posedge clock);
        period = period + 1;
        if (lfsr_done) break;
      end
      if (period == (1 << N) - 1) begin
        tap_maximal++;
        $display("  tap %b (%0d): period = %0d -> maximal length", tap_val, t, period);
      end
    end
    $display("  Summary: %0d out of %0d nonzero tap patterns yield maximal length (2^N-1 = %0d).", tap_maximal, tap_total, (1 << N) - 1);
    $display("");

    $stop;
  end

  always #5ns clock = ~clock;
endmodule
