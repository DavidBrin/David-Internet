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

   // Survivor-history update (one shift register per state). The ACS "selection" bit says
   // which predecessor won: path 1 = the predecessor reached with input 1, so the appended
   // decoded bit equals the selection. Written as continuous assigns rather than the
   // original always_comb loop over the array, which Icarus Verilog re-triggers on
   // endlessly (it treats a written-and-read array as a self-dependency). 2026-08-30.
   assign normalize_metrics = ACS0_path_cost[7] & ACS1_path_cost[7] & ACS2_path_cost[7] & ACS3_path_cost[7] &
                              ACS4_path_cost[7] & ACS5_path_cost[7] & ACS6_path_cost[7] & ACS7_path_cost[7];

   wire [TRACEBACK_DEPTH-1:0] sh_n0 = !ACS0_valid_o ? survivor_hist[0] : ACS0_selection ? append_bit(survivor_hist[1], 1'b1) : append_bit(survivor_hist[0], 1'b0);
   wire [TRACEBACK_DEPTH-1:0] sh_n1 = !ACS1_valid_o ? survivor_hist[1] : ACS1_selection ? append_bit(survivor_hist[2], 1'b1) : append_bit(survivor_hist[3], 1'b0);
   wire [TRACEBACK_DEPTH-1:0] sh_n2 = !ACS2_valid_o ? survivor_hist[2] : ACS2_selection ? append_bit(survivor_hist[5], 1'b1) : append_bit(survivor_hist[4], 1'b0);
   wire [TRACEBACK_DEPTH-1:0] sh_n3 = !ACS3_valid_o ? survivor_hist[3] : ACS3_selection ? append_bit(survivor_hist[6], 1'b1) : append_bit(survivor_hist[7], 1'b0);
   wire [TRACEBACK_DEPTH-1:0] sh_n4 = !ACS4_valid_o ? survivor_hist[4] : ACS4_selection ? append_bit(survivor_hist[0], 1'b1) : append_bit(survivor_hist[1], 1'b0);
   wire [TRACEBACK_DEPTH-1:0] sh_n5 = !ACS5_valid_o ? survivor_hist[5] : ACS5_selection ? append_bit(survivor_hist[3], 1'b1) : append_bit(survivor_hist[2], 1'b0);
   wire [TRACEBACK_DEPTH-1:0] sh_n6 = !ACS6_valid_o ? survivor_hist[6] : ACS6_selection ? append_bit(survivor_hist[4], 1'b1) : append_bit(survivor_hist[5], 1'b0);
   wire [TRACEBACK_DEPTH-1:0] sh_n7 = !ACS7_valid_o ? survivor_hist[7] : ACS7_selection ? append_bit(survivor_hist[7], 1'b1) : append_bit(survivor_hist[6], 1'b0);

   always_comb begin
      survivor_hist_n[0] = sh_n0;  survivor_hist_n[1] = sh_n1;
      survivor_hist_n[2] = sh_n2;  survivor_hist_n[3] = sh_n3;
      survivor_hist_n[4] = sh_n4;  survivor_hist_n[5] = sh_n5;
      survivor_hist_n[6] = sh_n6;  survivor_hist_n[7] = sh_n7;
   end

   // Best-state search as a comparator tree of continuous assignments. The original
   // accumulator loop (best_metric = 8'hff; for ... if (pc < best_metric) best_metric = pc)
   // reads the variable it writes inside always_comb, which Icarus Verilog re-triggers on
   // forever at t=0 (the simulation never advances past reset). Nets with continuous
   // assigns have no self-dependency, and a tree is what synthesis builds anyway.
   // (Fixed 2026-08-30 when the design was first simulated.)
   wire [7:0]  cm0 = validity[0] ? path_cost[0] : 8'hff;
   wire [7:0]  cm1 = validity[1] ? path_cost[1] : 8'hff;
   wire [7:0]  cm2 = validity[2] ? path_cost[2] : 8'hff;
   wire [7:0]  cm3 = validity[3] ? path_cost[3] : 8'hff;
   wire [7:0]  cm4 = validity[4] ? path_cost[4] : 8'hff;
   wire [7:0]  cm5 = validity[5] ? path_cost[5] : 8'hff;
   wire [7:0]  cm6 = validity[6] ? path_cost[6] : 8'hff;
   wire [7:0]  cm7 = validity[7] ? path_cost[7] : 8'hff;
   wire [10:0] b01   = (cm1 < cm0) ? {3'd1, cm1} : {3'd0, cm0};   // {state, metric}
   wire [10:0] b23   = (cm3 < cm2) ? {3'd3, cm3} : {3'd2, cm2};
   wire [10:0] b45   = (cm5 < cm4) ? {3'd5, cm5} : {3'd4, cm4};
   wire [10:0] b67   = (cm7 < cm6) ? {3'd7, cm7} : {3'd6, cm6};
   wire [10:0] b0123 = (b23[7:0] < b01[7:0]) ? b23 : b01;
   wire [10:0] b4567 = (b67[7:0] < b45[7:0]) ? b67 : b45;
   wire [10:0] best  = (b4567[7:0] < b0123[7:0]) ? b4567 : b0123;

   assign best_state  = best[10:8];
   assign best_metric = best[7:0];
   assign d_out_raw   = (enable_count >= TRACEBACK_DEPTH) ?
                        survivor_hist[best_state][TRACEBACK_DEPTH-1] : 1'b0;

   // Observability only (not part of the datapath): the eight path metrics flattened so a
   // VCD dump can show them side by side. Added for the build-time simulation, 2026-08-30.
   wire [63:0] path_cost_flat = {path_cost[7], path_cost[6], path_cost[5], path_cost[4],
                                 path_cost[3], path_cost[2], path_cost[1], path_cost[0]};

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