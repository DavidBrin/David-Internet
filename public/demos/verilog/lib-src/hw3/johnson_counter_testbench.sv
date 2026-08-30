`timescale 1ns/1ns  // added for Icarus: without it #5ns rounds to 0 under the default 1s timescale
//Johnson Counter Testbench Code
module johnson_counter_testbench;
  parameter n = 4;
  bit          clock, reset, preset=1;
  bit  [n-1:0] load_cnt;
  wire [n-1:0] count;

// Instantiate design under test
johnson_counter #(.n(n)) design_instance(
  .clk(clock),
  .clear(reset),
  .preset(preset),
  .load_cnt(load_cnt),
  .count(count)
);
 
logic[n-1:0] count0[49];
// contents of right.txt, index 0 first
localparam logic [49*4-1:0] RIGHT = {4'b0000, 4'b1000, 4'b1100, 4'b1110, 4'b1111, 4'b0111, 4'b0011, 4'b0001, 4'b0000, 4'b1000, 4'b1100, 4'b1110, 4'b1111, 4'b0111, 4'b0011, 4'b0001, 4'b0000, 4'b1000, 4'b1100, 4'b1110, 4'b1111, 4'b0111, 4'b0011, 4'b0001, 4'b0000, 4'b1000, 4'b1100, 4'b1110, 4'b1111, 4'b0111, 4'b0011, 4'b0001, 4'b0000, 4'b1000, 4'b1100, 4'b0000, 4'b0000, 4'b1000, 4'b1000, 4'b1100, 4'b1110, 4'b1111, 4'b0111, 4'b0011, 4'b0001, 4'b0000, 4'b1000, 4'b1100, 4'b1110};
int ct;

initial begin
// $readmemb("right.txt",count0);  -- golden values embedded so the bench needs no data file in the run dir
for (int i = 0; i < 49; i++) count0[i] = RIGHT[(48-i)*4 +: 4];

// Wait 10 ns for global reset to finish and start counter
#10ns  reset = 1;

// Wait for 200ns and reset counter
#340ns reset = 0;

// Wait for 20ns and start counter again
#20ns  reset=1;

#10ns  preset = 0;
       load_cnt = 4'b1000;

#10ns  preset = 1;

#100ns 	$finish; 

end

// Clock generator logic
always begin
  #5ns clock = 1;
  #2ns if(count0[ct]==count) $write("Y  "); else $write("NOPE");
       $displayb(count);
	   ct++;
  #3ns clock = 0; 
end

// Print input and output signals
//initial begin
// $monitor(" time=%0t,  clear=%b  clk=%b  count=%d",$time, reset, clock, count);
//end

endmodule