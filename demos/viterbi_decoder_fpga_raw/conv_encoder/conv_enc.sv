// programmable rate 1/2 convolutional encoder
// bitwise row of AND gates makes feedback pattern programmable
// N = 1 + constraint length
module conv_enc #(parameter N = 6)(   // N = shift reg. length
  input               clk,
                      data_in,
				      reset,
  input       [  1:0] load_mask, // 1: load mask0 pattern; 2: load mask1 
  input       [N-1:0] mask,      // mask pattern to be loaded; prepend with 1  
  output logic[  1:0] data_out);  // encoded data out

endmodule