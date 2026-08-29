/*make the data path K bits wide for mem_Kx1024
   K=8 for module mem, K=1 for module mem_disp */ 
module mem					(
   input                  clk,
   input                  wr,	 // write enable
   input         [9:0]    addr,
   input         [7:0]    d_i,		// data
   output logic  [7:0]    d_o);
   logic         [7:0]    mem   [0:1023];

   always @ (posedge clk) 
   begin
      if(wr)
         mem[addr] <= d_i;
      d_o <= mem[addr];
   end      

endmodule

module mem_disp (
   input                  clk,
   input                  wr,
   input         [9:0]    addr,
   input                  d_i,
   output logic           d_o
);

   logic                  mem [0:1023];

   always @(posedge clk) begin
      if(wr)
         mem[addr] <= d_i;
      d_o <= mem[addr];
   end

endmodule
