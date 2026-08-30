//4-bit counder testbench code
`timescale 1ns/1ns
module counter_4bit_testbench;
logic clock, reset;
logic [3:0] count_value;
parameter WID = 4;
// Instantiate design under test
counter_4bit #(.WIDTH(WID)) design_instance(
.clk(clock),
.clear(reset),
.count(count_value)
);

initial begin
// Initialize Inputs
reset = 1;
clock = 0;

// Wait 10 ns for global reset to finish and start counter
#10;
reset = 0;

// Wait for 200ns and reset counter
#340ns;
reset=1;

// Wait for 20ns and start counter again
#20ns;
reset=0;

// Wait for 10ns
#100ns;

// terminate simulation
$finish;
end

// Clock generator logic
always begin
  #5ns clock = 1;
  #5ns clock = 0;
end

// Print input and output signals
initial begin
 $monitor(" time=%0t,  clear=%b  clk=%b  count=%d",$time, reset, clock, count_value);
end
endmodule