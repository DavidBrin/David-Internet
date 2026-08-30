// N-bit ALU behavioral code
`timescale 1ns/1ps
module alu_top // Module start declaration
#(parameter N=4) // Parameter declaration
( input  clk, reset,
   input [N-1:0]operand1, operand2,
   input [1:0] operation,
   output logic[N-1:0] result
);

  // Local net declaration
  logic[N-1:0] out; 

  // Instantiation of module alu
  alu #(.N(N)) alu_instance(.*
  );

  // Register alu output	
  always@(posedge clk, posedge reset) 
    if(reset)  result <= 0;
    else 	   result <= out;

endmodule: alu_top // Module alu_top end declaration