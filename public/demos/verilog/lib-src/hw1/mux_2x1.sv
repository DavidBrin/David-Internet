`timescale 1ns/1ns
// Three-styles harness. The provided testbench instantiates a module named `mux_2x1`;
// this wrapper drives the gate, dataflow and behavioral implementations from the same
// inputs, outputs the gate-level result, and prints AGREE/MISMATCH after every input change.
module mux_2x1(
  input  logic[1:0] in,
  input  logic      sel,
  output logic      out
);
  logic out_g, out_d, out_b;
  mux_2x1_gate       u_gate (.in(in), .sel(sel), .out(out_g));
  mux_2x1_dataflow   u_data (.in(in), .sel(sel), .out(out_d));
  mux_2x1_behavioral u_behv (.in(in), .sel(sel), .out(out_b));
  assign out = out_g;

  always @(in, sel) begin
    #5;  // the gate-level OR has a #1.5 delay
    if (out_g !== out_d || out_g !== out_b)
      $display("MISMATCH in=%b sel=%b gate=%b dataflow=%b behavioral=%b", in, sel, out_g, out_d, out_b);
    else
      $display("AGREE    in=%b sel=%b out=%b", in, sel, out_g);
  end
endmodule
