//Clock divide by N testbench
`timescale 1ns/1ns
module clock_divide_by_N_testbench;
parameter N=4;
bit clock, reset=1;
wire out;
logic outE;
bit[N:0] count;

// Instantiate design under test
clock_div_by_N #(.N(N)) design_instance(
 .clkin (clock),
 .reset (reset),
 .clkout(out)
);

initial begin

// Wait 40 ns for global reset to finish and start counter
  #40ns reset = 0;

// Wait for some time and terminate
  #340ns $stop;
end

always @(posedge clock)
  if(!reset) if(count==2*N-1) count = 0;
             else count++;

assign
  outE = (count>N-2) && (count<2*N-1);

always @(posedge clock) begin
  #1;
  if(outE != out) $display("error at time %t",$time);
end

// Clock generator logic
always begin
  #10ns clock = 1;
  #10ns clock = 0;
end
endmodule