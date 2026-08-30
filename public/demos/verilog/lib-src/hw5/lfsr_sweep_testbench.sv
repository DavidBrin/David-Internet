`timescale 1ns/1ns
// Sweeps the parameterized LFSR over N = 2..8 with the default tap pattern and measures the
// period from the reset state (all ones) back to itself. A maximal-length LFSR must return
// after exactly 2^N - 1 clocks.
module lfsr_period_check #(parameter N = 4)(input logic clk);
  logic         reset = 0;
  logic  [1:0]  load  = 0;
  logic [N-1:0] seed_mask = '0;
  wire  [N-1:0] lfsr_data;
  wire          lfsr_done;
  int steps;

  lfsr #(.N(N)) dut(.clk(clk), .reset(reset), .load(load), .seed_mask(seed_mask),
                    .lfsr_data(lfsr_data), .lfsr_done(lfsr_done));

  initial begin
    repeat (2) @(posedge clk);
    #1 reset = 1;
    steps = 0;
    do begin
      @(posedge clk); #1 steps++;
    end while (!lfsr_done && steps < 2**N + 2);
    if (steps == 2**N - 1)
      $display("N=%0d period=%0d MAXIMAL", N, steps);
    else
      $display("N=%0d period=%0d SHORT (expected %0d)", N, steps, 2**N - 1);
  end
endmodule

module lfsr_sweep_testbench;
  logic clk = 0;
  always #5 clk = ~clk;

  lfsr_period_check #(.N(2)) c2(.clk(clk));
  lfsr_period_check #(.N(3)) c3(.clk(clk));
  lfsr_period_check #(.N(4)) c4(.clk(clk));
  lfsr_period_check #(.N(5)) c5(.clk(clk));
  lfsr_period_check #(.N(6)) c6(.clk(clk));
  lfsr_period_check #(.N(7)) c7(.clk(clk));
  lfsr_period_check #(.N(8)) c8(.clk(clk));

  initial begin
    repeat (300) @(posedge clk);
    $finish;
  end
endmodule
