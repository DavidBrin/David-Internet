// 1-bit ALU behavioral code
`timescale 1ns/1ps
module alu // Module start declaration
#(parameter N=1) // Parameter declaration
(
  input [N-1:0] operand1, operand2,
  input [1:0] operation,
  output logic[N-1:0] out
);
  always_comb begin
    out = 'bx;        
    case(operation)
      2'b00: out = operand1 + operand2; 
      2'b01: out = operand1 - operand2; 
      2'b10: out = operand1 & operand2;
      2'b11: out = operand1 | operand2; 
    endcase
  end
endmodule: alu
