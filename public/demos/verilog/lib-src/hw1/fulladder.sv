`timescale 1ns/1ns
// Three-styles harness. The provided testbench instantiates a module named `fulladder`;
// this wrapper drives the gate, dataflow and behavioral implementations from the same
// inputs, outputs the gate-level result, and prints AGREE/MISMATCH after every input change.
module fulladder(
  input  logic a, b, cin,
  output logic sum, cout
);
  logic sum_g, cout_g, sum_d, cout_d, sum_b, cout_b;
  fulladder_gate       u_gate (.a(a), .b(b), .cin(cin), .sum(sum_g), .cout(cout_g));
  fulladder_dataflow   u_data (.a(a), .b(b), .cin(cin), .sum(sum_d), .cout(cout_d));
  fulladder_behavioral u_behv (.a(a), .b(b), .cin(cin), .sum(sum_b), .cout(cout_b));
  assign sum  = sum_g;
  assign cout = cout_g;

  always @(a, b, cin) begin
    #5;
    if ({cout_g, sum_g} !== {cout_d, sum_d} || {cout_g, sum_g} !== {cout_b, sum_b})
      $display("MISMATCH a=%b b=%b cin=%b gate=%b%b dataflow=%b%b behavioral=%b%b",
               a, b, cin, cout_g, sum_g, cout_d, sum_d, cout_b, sum_b);
    else
      $display("AGREE    a=%b b=%b cin=%b cout,sum=%b%b", a, b, cin, cout_g, sum_g);
  end
endmodule
