module div_by_even #(parameter N=10)(
  input clkin,
        reset_n,
  output logic clkout);

  logic[$clog2(N)-1:0] ct;

  always @(posedge clkin, negedge reset_n)
    if(!reset_n)
	  ct <= 'b0;
	else 
	  ct <= (ct+1)%N;

  assign clkout = ct<(N/2);

endmodule




module div_by_even_tb; 
  parameter N=10;

  bit clkin, reset_n;
  wire clkout;

  div_by_even #(.N(N)) de(
    .clkin   (clkin),
	.reset_n (reset_n),
	.clkout); 

  initial begin
	#20 reset_n = 'b1;
    #200 $stop;
  end

  always begin
    #5 clkin = 1;
	#5 clkin = 0;
  end

endmodule
