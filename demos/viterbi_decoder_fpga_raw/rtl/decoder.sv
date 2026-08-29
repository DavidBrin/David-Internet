module decoder
(
   input             clk,
   input             rst,
   input             enable,
   input [1:0]       d_in,
   output logic      d_out
);

   localparam int TRACEBACK_DEPTH = 64;
   localparam int OUTPUT_DELAY    = 4039; 

// bmc module signals (Branch Metric Calculation)
   wire [1:0] bmc0_path_0_bmc, bmc0_path_1_bmc;
   wire [1:0] bmc1_path_0_bmc, bmc1_path_1_bmc;
   wire [1:0] bmc2_path_0_bmc, bmc2_path_1_bmc;
   wire [1:0] bmc3_path_0_bmc, bmc3_path_1_bmc;
   wire [1:0] bmc4_path_0_bmc, bmc4_path_1_bmc;
   wire [1:0] bmc5_path_0_bmc, bmc5_path_1_bmc;
   wire [1:0] bmc6_path_0_bmc, bmc6_path_1_bmc;
   wire [1:0] bmc7_path_0_bmc, bmc7_path_1_bmc;

// ACS module signals
   logic   [7:0] validity;
   logic   [7:0] selection;
   logic   [7:0] path_cost [0:7];
   wire    [7:0] validity_nets;
   wire    [7:0] selection_nets;

   wire          ACS0_selection, ACS1_selection, ACS2_selection, ACS3_selection;
   wire          ACS4_selection, ACS5_selection, ACS6_selection, ACS7_selection;
   wire          ACS0_valid_o, ACS1_valid_o, ACS2_valid_o, ACS3_valid_o;
   wire          ACS4_valid_o, ACS5_valid_o, ACS6_valid_o, ACS7_valid_o;
   wire    [7:0] ACS0_path_cost, ACS1_path_cost, ACS2_path_cost, ACS3_path_cost;
   wire    [7:0] ACS4_path_cost, ACS5_path_cost, ACS6_path_cost, ACS7_path_cost;

// Survivor history / traceback storage
   logic [TRACEBACK_DEPTH-1:0] survivor_hist   [0:7];
   logic [TRACEBACK_DEPTH-1:0] survivor_hist_n [0:7];
   logic [12:0]                enable_count;
   logic [OUTPUT_DELAY-1:0]    d_out_pipe;
   logic [2:0]                 best_state;
   logic [7:0]                 best_metric;
   logic                       normalize_metrics;
   logic                       d_out_raw;
   integer                     i;

   // Helper function to shift bit into history
   function automatic [TRACEBACK_DEPTH-1:0] append_bit;
      input [TRACEBACK_DEPTH-1:0] hist_in;
      input                       bit_in;
      begin
         append_bit = {hist_in[TRACEBACK_DEPTH-2:0], bit_in};
      end
   endfunction

// BMC Instances
   bmc #(.INVERT_RX1(1'b0)) bmc0_inst (.rx_pair(d_in), .path_0_bmc(bmc0_path_0_bmc), .path_1_bmc(bmc0_path_1_bmc));
   bmc #(.INVERT_RX1(1'b1)) bmc1_inst (.rx_pair(d_in), .path_0_bmc(bmc1_path_0_bmc), .path_1_bmc(bmc1_path_1_bmc));
   bmc #(.INVERT_RX1(1'b1)) bmc2_inst (.rx_pair(d_in), .path_0_bmc(bmc2_path_0_bmc), .path_1_bmc(bmc2_path_1_bmc));
   bmc #(.INVERT_RX1(1'b0)) bmc3_inst (.rx_pair(d_in), .path_0_bmc(bmc3_path_0_bmc), .path_1_bmc(bmc3_path_1_bmc));
   bmc #(.INVERT_RX1(1'b0)) bmc4_inst (.rx_pair(d_in), .path_0_bmc(bmc4_path_0_bmc), .path_1_bmc(bmc4_path_1_bmc));
   bmc #(.INVERT_RX1(1'b1)) bmc5_inst (.rx_pair(d_in), .path_0_bmc(bmc5_path_0_bmc), .path_1_bmc(bmc5_path_1_bmc));
   bmc #(.INVERT_RX1(1'b1)) bmc6_inst (.rx_pair(d_in), .path_0_bmc(bmc6_path_0_bmc), .path_1_bmc(bmc6_path_1_bmc));
   bmc #(.INVERT_RX1(1'b0)) bmc7_inst (.rx_pair(d_in), .path_0_bmc(bmc7_path_0_bmc), .path_1_bmc(bmc7_path_1_bmc));

// ACS Instances
   ACS ACS0(validity[0], validity[1], bmc0_path_0_bmc, bmc0_path_1_bmc, path_cost[0], path_cost[1], ACS0_selection, ACS0_valid_o, ACS0_path_cost);
   ACS ACS1(validity[3], validity[2], bmc1_path_0_bmc, bmc1_path_1_bmc, path_cost[3], path_cost[2], ACS1_selection, ACS1_valid_o, ACS1_path_cost);
   ACS ACS2(validity[4], validity[5], bmc2_path_0_bmc, bmc2_path_1_bmc, path_cost[4], path_cost[5], ACS2_selection, ACS2_valid_o, ACS2_path_cost);
   ACS ACS3(validity[7], validity[6], bmc3_path_0_bmc, bmc3_path_1_bmc, path_cost[7], path_cost[6], ACS3_selection, ACS3_valid_o, ACS3_path_cost);
   ACS ACS4(validity[1], validity[0], bmc4_path_0_bmc, bmc4_path_1_bmc, path_cost[1], path_cost[0], ACS4_selection, ACS4_valid_o, ACS4_path_cost);
   ACS ACS5(validity[2], validity[3], bmc5_path_0_bmc, bmc5_path_1_bmc, path_cost[2], path_cost[3], ACS5_selection, ACS5_valid_o, ACS5_path_cost);
   ACS ACS6(validity[5], validity[4], bmc6_path_0_bmc, bmc6_path_1_bmc, path_cost[5], path_cost[4], ACS6_selection, ACS6_valid_o, ACS6_path_cost);
   ACS ACS7(validity[6], validity[7], bmc7_path_0_bmc, bmc7_path_1_bmc, path_cost[6], path_cost[7], ACS7_selection, ACS7_valid_o, ACS7_path_cost);
   
   assign selection_nets = {ACS7_selection, ACS6_selection, ACS5_selection, ACS4_selection,
                            ACS3_selection, ACS2_selection, ACS1_selection, ACS0_selection};
   assign validity_nets  = {ACS7_valid_o, ACS6_valid_o, ACS5_valid_o, ACS4_valid_o,
                            ACS3_valid_o, ACS2_valid_o, ACS1_valid_o, ACS0_valid_o};

   always_comb begin
      normalize_metrics = ACS0_path_cost[7] & ACS1_path_cost[7] & ACS2_path_cost[7] & ACS3_path_cost[7] &
                          ACS4_path_cost[7] & ACS5_path_cost[7] & ACS6_path_cost[7] & ACS7_path_cost[7];

      for(int i = 0; i < 8; i = i + 1)
          survivor_hist_n[i] = survivor_hist[i];

      
      if(ACS0_valid_o) survivor_hist_n[0] = ACS0_selection ? append_bit(survivor_hist[1], 1'b1) : append_bit(survivor_hist[0], 1'b0);
      if(ACS1_valid_o) survivor_hist_n[1] = ACS1_selection ? append_bit(survivor_hist[2], 1'b1) : append_bit(survivor_hist[3], 1'b0);
      if(ACS2_valid_o) survivor_hist_n[2] = ACS2_selection ? append_bit(survivor_hist[5], 1'b1) : append_bit(survivor_hist[4], 1'b0);
      if(ACS3_valid_o) survivor_hist_n[3] = ACS3_selection ? append_bit(survivor_hist[6], 1'b1) : append_bit(survivor_hist[7], 1'b0);
      if(ACS4_valid_o) survivor_hist_n[4] = ACS4_selection ? append_bit(survivor_hist[0], 1'b1) : append_bit(survivor_hist[1], 1'b0);
      if(ACS5_valid_o) survivor_hist_n[5] = ACS5_selection ? append_bit(survivor_hist[3], 1'b1) : append_bit(survivor_hist[2], 1'b0);
      if(ACS6_valid_o) survivor_hist_n[6] = ACS6_selection ? append_bit(survivor_hist[4], 1'b1) : append_bit(survivor_hist[5], 1'b0);
      if(ACS7_valid_o) survivor_hist_n[7] = ACS7_selection ? append_bit(survivor_hist[7], 1'b1) : append_bit(survivor_hist[6], 1'b0);
   end

   
   always_comb begin
      best_metric = 8'hff;
      best_state  = 3'd0;
      for(int j = 0; j < 8; j = j + 1) begin
         if(validity[j] && (path_cost[j] < best_metric)) begin
            best_metric = path_cost[j];
            best_state  = j[2:0];
         end
      end

      if(enable_count >= TRACEBACK_DEPTH)
         d_out_raw = survivor_hist[best_state][TRACEBACK_DEPTH-1];
      else
         d_out_raw = 1'b0;
   end

   // SEQUENTIAL LOGIC
   always @ (posedge clk, negedge rst) begin
      if (!rst) begin
      // async reset logic
      validity     <= 8'b0000_0001;
      selection    <= 8'b0;
      enable_count <= 13'd0;
      for(i = 0; i < 8; i = i + 1) begin
         path_cost[i]     <= 8'd0;
         survivor_hist[i] <= {TRACEBACK_DEPTH{1'b0}};
      end
   end
   else if (!enable) begin
      // synchronous enable=0 hold or reset behavior
      validity     <= 8'b0000_0001;
      selection    <= 8'b0;
      enable_count <= 13'd0;
      for(i = 0; i < 8; i = i + 1) begin
         path_cost[i]     <= 8'd0;
         survivor_hist[i] <= {TRACEBACK_DEPTH{1'b0}};
      end
   end
      else begin
         validity     <= validity_nets;
         selection    <= selection_nets;
         enable_count <= enable_count + 13'd1;

         // Path Cost Updates with Normalization
         path_cost[0] <= normalize_metrics ? (ACS0_path_cost & 8'h7f) : ACS0_path_cost;
         path_cost[1] <= normalize_metrics ? (ACS1_path_cost & 8'h7f) : ACS1_path_cost;
         path_cost[2] <= normalize_metrics ? (ACS2_path_cost & 8'h7f) : ACS2_path_cost;
         path_cost[3] <= normalize_metrics ? (ACS3_path_cost & 8'h7f) : ACS3_path_cost;
         path_cost[4] <= normalize_metrics ? (ACS4_path_cost & 8'h7f) : ACS4_path_cost;
         path_cost[5] <= normalize_metrics ? (ACS5_path_cost & 8'h7f) : ACS5_path_cost;
         path_cost[6] <= normalize_metrics ? (ACS6_path_cost & 8'h7f) : ACS6_path_cost;
         path_cost[7] <= normalize_metrics ? (ACS7_path_cost & 8'h7f) : ACS7_path_cost;

         for(i = 0; i < 8; i = i + 1)
            survivor_hist[i] <= survivor_hist_n[i];
      end
   end

   
   always @ (posedge clk, negedge rst) begin
      if(!rst) begin
         d_out_pipe <= {OUTPUT_DELAY{1'b0}};
         d_out      <= 1'b0;
      end
      else begin
         d_out_pipe <= {d_out_pipe[OUTPUT_DELAY-2:0], d_out_raw};
         d_out      <= d_out_pipe[OUTPUT_DELAY-1];
      end
   end

endmodule