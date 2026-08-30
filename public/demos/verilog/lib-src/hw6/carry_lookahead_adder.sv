//`include "fulladder.sv"
module carry_lookahead_adder#(parameter N=32)(
  input       [N-1:0] A, B,
  input               CIN,
  output logic[  N:0] result
);
  logic [N:0] l_carry;
  logic [N-1:0] l_sum;

  // Instantiate Full Adder for 'N' instances 
  genvar i;
  generate
    for (i = 0; i < N; i++) begin : fa_gen
      fulladder fa_inst (.a(A[i]), .b(B[i]), .cin(l_carry[i]), .sum(l_sum[i]), .cout());
    end
  endgenerate
  
  // assign Carry in to first full adder carryin    
  assign l_carry[0] = CIN;      

  // generate carry : G(i)=A(i).B(i)
  // propogate carry : P(i)=A(i)+B(i)
  // Carry out: Cout(i+1)=G(i)+P(i).C(i)
  genvar j;
  generate
    for (j = 0; j < N; j++) begin : cla_gen
      assign l_carry[j+1] = (A[j] & B[j]) | ((A[j] | B[j]) & l_carry[j]);
    end
  endgenerate
   
  // final result of addition and carry 
  assign result = {l_carry[N], l_sum};  
endmodule



/*
// FullAdder gatelevel code
module fulladder(
  input logic a, b, cin, 
  output logic sum, cout
);
  wire w0, w1, w2;
  xor x0(w0, b, a);
  and a0(w1, b, a);   
  and a1(w2, w0, cin);
  or r0(cout, w2, w1);   
  xor x1(sum, w0, cin);
endmodule
*/
// FullAdder behavioral level code
module fulladder(
  input logic a, b, cin, 
  output logic sum, cout
);
  assign {cout, sum} = a + b + cin;
endmodule
