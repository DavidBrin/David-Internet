//1-bit ALU testbench code
`timescale 1ns/1ps
module alu_top_testbench;
parameter N = 4;
bit clock, reset = 1;
bit [N-1:0] operand1, operand2;
wire [N-1:0] result;
bit [1:0] operation;

// Instantiate design under test
alu_top #(.N(N)) design_instance(
 .clk(clock),
 .reset(reset),
 .operand1(operand1), 
 .operand2(operand2), 
 .operation(operation), 
 .result(result)
);

initial begin
// Initialize Inputs -- not needed here because bit self-initializes to 0

// Wait 10 ns for global reset to finish and start counter
#10ns;
reset = 0;

#10ns
operand1  = 0;
operand2  = 1;
operation = 0;

#10ns;
operand1  = 1;
operand2  = 1;
operation = 1;

#10ns;
operand1  = 1;
operand2  = 1;
operation = 2;

// random testing
for(int i=0; i<20; i++)	begin
  #10ns operand1  = $random;
        operand2  = $random;
        operation = $random;
end  

#10ns;
operand1  = 1;
operand2  = 0;
operation = 3;

// terminate simulation
#10ns $stop;    // why #10ns here? 
end

// best clock generator syntax
always begin
  #5ns clock = 1;
  #5ns clock = 0;
end

// Print input and output signals
initial begin
 $monitor(" time=%0t,  clk=%b  reset=%b  operation=%d, operand1=%d, operand2=%d, result=%d",$time, clock, reset, operation, operand1, operand2, result);
 $dumpfile("dump.vcd"); $dumpvars;
end
endmodule