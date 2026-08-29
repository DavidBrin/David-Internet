// 2to1 Multiplexor dataflow code
module mux_2x1_dataflow(
  input logic[1:0] in, 
  input logic sel, 
  output logic out
); 
  assign out = (!sel && in[0]) || (sel && in[1]);
endmodule 