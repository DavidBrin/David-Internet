module viterbi_tx_rx #(
   parameter int  PERIOD   = 16,   // error repeat period (e.g. 16 = 1/16 rate)
   parameter int  BURST    = 1,    // how many consecutive bad symbols per period
   parameter bit  ERR_BIT0 = 1'b1, // invert bit[0]
   parameter bit  ERR_BIT1 = 1'b0, // invert bit[1]
   parameter bit  USE_RAND = 1'b0, // use $random instead of deterministic
   parameter bit  ENABLE_ERR = 1'b0 // master enable for injection
)(
   input    clk,
   input    rst,
   input    encoder_i,
   input    enable_encoder_i,
   output   decoder_o
);

   wire  [1:0] encoder_o;
   wire        valid_encoder_o;

   int           error_counter,
                 bad_bit_ct,
                 word_ct;
   logic   [1:0] encoder_o_reg0,
                 encoder_o_reg;
   logic         enable_decoder_in;
   logic   [1:0] err_inj;
   logic   [1:0] err_mask;        // which bits to flip
   int           rand_val;
   logic         inject_now;      

   
   assign err_mask = {ERR_BIT1, ERR_BIT0};

   always @ (posedge clk, negedge rst) begin
      if (!rst) begin
         $display("viterbi_tx_rx.sv - PERIOD=%0d BURST=%0d MASK=%b RAND=%0d",
                   PERIOD, BURST, err_mask, USE_RAND);
         error_counter     <= 'd0;
         encoder_o_reg     <= 'b0;
         encoder_o_reg0    <= 'b0;
         enable_decoder_in <= 'b0;
         bad_bit_ct        <= 'b0;
         word_ct           <= 'b0;
         err_inj           <= 'b0;
      end
      else begin
         enable_decoder_in <= valid_encoder_o;
         encoder_o_reg0    <= encoder_o;
         word_ct           <= word_ct + 1;

         // Determine whether to inject this cycle
         if (USE_RAND) begin
            rand_val   = $random;
            // inject randomly at roughly 1/PERIOD rate
            inject_now = ENABLE_ERR && (word_ct < 256) &&
                         ((rand_val % PERIOD) < BURST);
         end
         else begin
            inject_now = ENABLE_ERR && (word_ct < 256) &&
                         ((word_ct % PERIOD) < BURST);
         end

         if (inject_now) begin
            error_counter <= error_counter + 1;
            err_inj       <= err_mask;
            encoder_o_reg <= encoder_o ^ err_mask;
         end
         else begin
            err_inj       <= 2'b00;
            encoder_o_reg <= encoder_o;
         end

         if (word_ct < 256) begin
            bad_bit_ct <= bad_bit_ct
                        + (encoder_o_reg0[1] ^ encoder_o_reg[1])
                        + (encoder_o_reg0[0] ^ encoder_o_reg[0]);
            $display("error_counter,err_inj = %h %b %d %d",
                      error_counter, err_inj, bad_bit_ct, word_ct);
         end
      end
   end

   encoder encoder1 (
      .clk,
      .rst,
      .enable_i (enable_encoder_i),
      .d_in     (encoder_i),
      .valid_o  (valid_encoder_o),
      .d_out    (encoder_o)
   );

   decoder decoder1 (
      .clk,
      .rst,
      .enable   (enable_decoder_in),
      .d_in     (encoder_o_reg),
      .d_out    (decoder_o)
   );

endmodule