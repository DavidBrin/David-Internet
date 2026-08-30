// Rate-1/2, 8-state (constraint length 3) systematic recursive convolutional encoder.
// The starter file left the case table empty ("fill in the guts"); completed 2026-08-30.
module encoder
(  input             clk,
   input             rst,
   input             enable_i,
   input             d_in,
   output logic      valid_o,
   output      [1:0] d_out);
   
   logic         [2:0] cstate;
   logic         [2:0] nstate;
   
   logic         [1:0] d_out_reg;

   assign   d_out    =  (enable_i)? d_out_reg:2'b00;

   always_comb begin
      valid_o  =   enable_i;
      // Completed from the assignment's state/output table (Implementation-Info.md):
      // next = {d_in ^ cstate[0] ^ cstate[1], cstate[2:1]}   (recursive shift register)
      // out  = {d_in ^ cstate[2] ^ cstate[1], d_in}          (systematic bit + parity)
      case (cstate)
         3'd0: begin nstate = d_in ? 3'd4 : 3'd0; d_out_reg = d_in ? 2'b11 : 2'b00; end
         3'd1: begin nstate = d_in ? 3'd0 : 3'd4; d_out_reg = d_in ? 2'b11 : 2'b00; end
         3'd2: begin nstate = d_in ? 3'd1 : 3'd5; d_out_reg = d_in ? 2'b01 : 2'b10; end
         3'd3: begin nstate = d_in ? 3'd5 : 3'd1; d_out_reg = d_in ? 2'b01 : 2'b10; end
         3'd4: begin nstate = d_in ? 3'd6 : 3'd2; d_out_reg = d_in ? 2'b01 : 2'b10; end
         3'd5: begin nstate = d_in ? 3'd2 : 3'd6; d_out_reg = d_in ? 2'b01 : 2'b10; end
         3'd6: begin nstate = d_in ? 3'd3 : 3'd7; d_out_reg = d_in ? 2'b11 : 2'b00; end
         default: begin nstate = d_in ? 3'd7 : 3'd3; d_out_reg = d_in ? 2'b11 : 2'b00; end
      endcase
   end								   

   always @ (posedge clk,negedge rst)   begin
//      $display("data in=%d state=%b%b%b data out=%b%b",d_in,reg_1,reg_2,reg_3,d_out_reg[1],d_out_reg[0]);
      if(!rst)
         cstate   <= 3'b000;
      else if(!enable_i)
         cstate   <= 3'b000;
      else
         cstate   <= nstate;
   end

endmodule
