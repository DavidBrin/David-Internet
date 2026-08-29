// FullAdder behavioral level code
module fulladder_behavioral(
  input logic a, b, cin, 
  output logic sum, cout
);
  assign {cout, sum} = a + b + cin;
endmodule

