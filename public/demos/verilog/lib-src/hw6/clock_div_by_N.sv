// starter code for clock-frequency-divide-by-integer value
// 50/50 clkout duty cycle requires 50/50 clkin duty cycle
module clock_div_by_N #(parameter N=9) (
  input        reset, 		// active high
               clkin,
  output logic clkout);

  logic [$clog2(2*N)-1:0] count;

  always_ff @(clkin or posedge reset)
    if (reset)
      count <= '0;
    else if (count == 2*N - 1)
      count <= '0;
    else
      count <= count + 1;

  assign clkout = (count > N - 2) && (count < 2*N - 1);

endmodule

