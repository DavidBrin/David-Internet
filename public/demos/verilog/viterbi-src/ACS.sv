module ACS		                        // add-compare-select
(  input       path_0_valid,
   input       path_1_valid,
   input [1:0] path_0_bmc,	            // branch metric computation
   input [1:0] path_1_bmc,				
   input [7:0] path_0_pmc,				// path metric computation
   input [7:0] path_1_pmc,

   output logic        selection,
   output logic        valid_o,
   output logic [7:0] path_cost);  

   wire  [7:0] path_cost_0;			   // branch metric + path metric
   wire  [7:0] path_cost_1;

   assign path_cost_0 = path_0_pmc + {{6{1'b0}}, path_0_bmc};
   assign path_cost_1 = path_1_pmc + {{6{1'b0}}, path_1_bmc};

   always_comb begin
      selection = 1'b0;
      valid_o   = 1'b0;
      path_cost = 8'd0;

      case ({path_1_valid, path_0_valid})
         2'b00: begin
            selection = 1'b0;
            valid_o   = 1'b0;
            path_cost = 8'd0;
         end
         2'b01: begin
            selection = 1'b0;
            valid_o   = 1'b1;
            path_cost = path_cost_0;
         end
         2'b10: begin
            selection = 1'b1;
            valid_o   = 1'b1;
            path_cost = path_cost_1;
         end
         default: begin
            selection = (path_cost_0 > path_cost_1);
            valid_o   = 1'b1;
            path_cost = (path_cost_0 > path_cost_1) ? path_cost_1 : path_cost_0;
         end
      endcase
   end

endmodule
