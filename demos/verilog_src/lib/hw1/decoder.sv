`timescale 1ns/1ns
// Three-styles harness. The provided testbench instantiates a module named `decoder`;
// this wrapper drives the gate, dataflow and behavioral implementations from the same
// inputs, outputs the gate-level result, and prints AGREE/MISMATCH after every input change.
module decoder(
  input  logic[1:0] sel,
  output logic[3:0] out
);
  logic [3:0] out_g, out_d, out_b;
  decoder_2to4_gate       u_gate (.sel(sel), .out(out_g));
  decoder_2to4_dataflow   u_data (.sel(sel), .out(out_d));
  decoder_2to4_behavioral u_behv (.sel(sel), .out(out_b));
  assign out = out_g;

  always @(sel) begin
    #5;  // let gate delays settle
    if (out_g !== out_d || out_g !== out_b)
      $display("MISMATCH sel=%b gate=%b dataflow=%b behavioral=%b", sel, out_g, out_d, out_b);
    else
      $display("AGREE    sel=%b gate=%b dataflow=%b behavioral=%b", sel, out_g, out_d, out_b);
  end
endmodule
