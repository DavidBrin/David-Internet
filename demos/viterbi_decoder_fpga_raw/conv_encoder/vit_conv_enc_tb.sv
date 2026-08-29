module vit_conv_enc_tb;

parameter N = 4;              // set to desired constraint length + 1;
bit clk, data_in,
         data_in_bad,
         reset;
bit [  1:0] load_mask;		  // 01: load mask 0; 10: load mask 1
bit [N-1:0] mask;			  // prepend desired mask vaue with 1
wire[1:0] data_out,			  // assumes rate 1/2
          data_out_bad;
int       data_out_dif,
          path_metric;
int       error = 8192*64;

// rate 1/2, constraint N-1 convolutional encoder
conv_enc #(.N(N)) ce1(.clk,
             .data_in,
			 .reset,
			 .load_mask,
			 .mask,
			 .data_out);

conv_enc #(.N(N)) ce2(.clk,
             .data_in(data_in_bad),
			 .reset,
			 .load_mask,
			 .mask,
			 .data_out(data_out_bad));

always_comb case({data_out,data_out_bad})
  4'b00_01, 4'b00_10: path_metric++;
  4'b00_00: repeat(2) path_metric++;
  4'b01_00, 4'b01_11: path_metric++;
  4'b01_01: repeat(2) path_metric++;
  4'b10_00, 4'b10_11: path_metric++;
  4'b10_10: repeat(2) path_metric++;
  4'b11_01, 4'b11_10: path_metric++;
  4'b11_11: repeat(2) path_metric++;
  default: begin end
endcase


always_comb case({data_out,data_out_bad})
  4'b00_01, 4'b00_10: data_out_dif++;
  4'b00_11: repeat(2) data_out_dif++;
  4'b01_00, 4'b01_11: data_out_dif++;
  4'b01_10: repeat(2) data_out_dif++;
  4'b10_00, 4'b10_11: data_out_dif++;
  4'b10_01: repeat(2) data_out_dif++;
  4'b11_01, 4'b11_10: data_out_dif++;
  4'b11_00: repeat(2) data_out_dif++;
  default: begin end
endcase

always begin
  #5ns clk = 1'b1;
  #5ns clk = 1'b0;
  data_in_bad = data_in ^ error[0];
  error = error>>1;
end

initial begin
  #10ns mask      =  'o15;		  // 5 with 1 prepended
  #10ns load_mask = 2'b01;
  #10ns load_mask = 2'b00;
  #10ns mask      =  'o17;
  #10ns load_mask = 2'b10;
  #10ns load_mask = 2'b00;
  #10ns reset     = 1'b1;		  // start running
  #10ns data_in   = 1'b0;		  // sequence from Viterbi demo
  #90ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #40ns $stop; 
end

endmodule