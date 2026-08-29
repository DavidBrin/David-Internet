//Barrel Shifter Testbench Code
module barrel_shifter_testbench2;
  parameter n=8;
  bit              select, direction;
  bit [$clog2(n)-1:0] shift_value;
  bit [n-1:0]      din = 8'b10111001;
  wire[n-1:0]      dout;

// Instantiate design under test
barrel_shifter #(.n(n)) design_instance(
 .select     (select),
 .direction  (direction),
 .shift_value(shift_value),
 .din        (din),
 .dout       (dout)
);

initial begin
  for(int i=0; i<(2**(n+2)); i++) begin
	#1ns{select,direction,shift_value} = i;
	#1ns $display("select = %b, direction = %b, shift_value = %d, din=%b, dout=%b", 
	   select,direction,shift_value,din,dout);
  end
  din = 8'b01000011;
  for(int i=0; i<(2**(n+2)); i++) begin
	#1ns{select,direction,shift_value} = i;
	#1ns $display("select = %b, direction = %b, shift_value = %d, din=%b, dout=%b", 
	   select,direction,shift_value,din,dout);
  end
  #100ns $stop;
end

// Print input and output signals
//initial begin
// $monitor(" time=%0t,  select=%b  shift_value=%b  din=%b dout=%b", $time, select, shift_value, din, dout);
//end

endmodule