module tbu
(
   input       clk,
   input       rst,
   input       enable,
   input       selection,
   input [7:0] d_in_0,
   input [7:0] d_in_1,
   output logic  d_o,
   output logic  wr_en);

   logic         d_o_reg;
   logic         wr_en_reg;
   
   logic   [2:0] pstate;
   logic   [2:0] nstate;

   logic         selection_buf;

   always_comb begin
      logic decision_bit;

      decision_bit = selection ? d_in_1[pstate] : d_in_0[pstate];

      wr_en_reg = selection;
      d_o_reg   = selection ? d_in_1[pstate] : 1'b0;
      nstate    = 3'd0;

      case (pstate)
         3'd0: nstate = decision_bit ? 3'd1 : 3'd0;
         3'd1: nstate = decision_bit ? 3'd2 : 3'd3;
         3'd2: nstate = decision_bit ? 3'd5 : 3'd4;
         3'd3: nstate = decision_bit ? 3'd6 : 3'd7;
         3'd4: nstate = decision_bit ? 3'd0 : 3'd1;
         3'd5: nstate = decision_bit ? 3'd3 : 3'd2;
         3'd6: nstate = decision_bit ? 3'd4 : 3'd5;
         default: nstate = decision_bit ? 3'd7 : 3'd6;
      endcase
   end

   always @(posedge clk)    begin
      selection_buf  <= selection;
      wr_en          <= wr_en_reg;
      d_o            <= d_o_reg;
   end
   always @(posedge clk, negedge rst) begin
      if(!rst)
         pstate <= 3'd0;
      else if(!enable)
         pstate <= 3'd0;
      else
         pstate <= nstate;
   end

endmodule
