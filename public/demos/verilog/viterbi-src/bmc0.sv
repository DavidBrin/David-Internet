/* For our constraint length = 3, there will be 2**3 = 8
of these, but unlike ACS, not all are identical. 
*/
											   
module bmc
#(parameter bit INVERT_RX1 = 1'b0)
(
   input    [1:0] rx_pair,
   output logic [1:0] path_0_bmc,
   output logic [1:0] path_1_bmc);

   // Hamming distance from rx_pair to the two expected symbols of this state's
   // incoming branches: path 0 expects 00 (10 when INVERT_RX1), path 1 expects 11 (01).
   // Written as continuous assigns (the always_comb version re-read its own temporaries,
   // which Icarus Verilog re-triggers on; behaviour is identical). 2026-08-30.
   wire tmp00 = rx_pair[0];
   wire tmp01 = INVERT_RX1 ? ~rx_pair[1] : rx_pair[1];
   wire tmp10 = ~tmp00;
   wire tmp11 = ~tmp01;

   assign path_0_bmc = {tmp00 & tmp01, tmp00 ^ tmp01};
   assign path_1_bmc = {tmp10 & tmp11, tmp10 ^ tmp11};

endmodule
