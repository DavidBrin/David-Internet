`timescale 1ns/1ns
//Barrel Shifter Testbench Code
module barrel_shifter_testbench;
  parameter n=8;
  bit                select, direction;
  bit[$clog2(n)-1:0] shift_value;
  bit[n-1:0]         din;
  wire[n-1:0]        dout;

// Instantiate design under test
barrel_shifter #(.n(n)) design_instance(
 .select(select),
 .direction(direction),
 .shift_value(shift_value),
 .din(din),
 .dout(dout)
);

initial begin

// Right Shift by 1 
#100ns shift_value = 1; // Shift by 1 bit position
       din         = 8'h80;

// Right Shift by 2 
#100ns shift_value = 2; // Shift by 2 bit positions

// Right Shift by 3 
#100ns shift_value = 3; // Shift by 2 bit positions

// Re-initialize all inputs 
#100ns  select      = 1;  // Rotate operation
        shift_value = 0;
        din         = 8'h00;

// Rotate Right by 1 (ROR#1)
#100ns  shift_value = 1; // Shift by 1 bit position
        din         = 8'b10111001;

// Rotate Right by 2 (ROR#2)
#100ns  shift_value = 2; // Shift by 2 bit positions

// Rotate Right by 3 (ROR#3)
#100ns  shift_value = 3; // Shift by 3 bit positions

// Re-initialize all inputs
#100ns  select = 0;
        direction = 1;
        shift_value = 0;
        din = 8'h00;

// Left Shift by 1
#100ns  shift_value = 1; // Shift by 1 bit position
        din         = 8'h01;

// Left Shift by 2
#100ns  shift_value = 2; // Shift by 2 bit positions

// Left Shift by 3
#100ns  shift_value = 3; // Shift by 1 bit positions

// Re-initialize inputs
#100ns  select = 1;
        direction = 1;
        shift_value = 0;
        din = 8'h00;

// Left Rotate by 1 (ROL#1)
#100ns  shift_value = 1; // Shift by 1 bit position
        din         = 8'b10111001;

// Left Rotate by 2 (ROL#2)
#100ns shift_value = 2; // Shift by 2 bit positions

// Left Rotate by 3 (ROL#3)
#100ns shift_value = 3; // Shift by 3 bit positions

// Wait for 100ns and end simulation
#100ns $stop;
end

// Print input and output signals
initial begin
 $monitor(" time=%0t,  select=%b  shift_value=%b  din=%b dout=%b", $time, select, shift_value, din, dout);
end

endmodule