module conv_enc_tb;

parameter N = 4;              // set to desired constraint length + 1;
bit clk, data_in, reset;
bit [  1:0] load_mask;		  // 01: load mask 0; 10: load mask 1
bit [N-1:0] mask;			  // prepend desired mask vaue with 1
wire[1:0] data_out;			  // assumes rate 1/2

// rate 1/2, constraint N-1 convolutional encoder
conv_enc #(.N(N)) ce1(.clk,
             .data_in,
			 .reset,
			 .load_mask,
			 .mask,
			 .data_out);

always begin
  #5ns clk = 1'b1;
  #5ns clk = 1'b0;
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
  #40ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns $stop; 
  #40ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #40ns $stop; 
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b0;
  #10ns data_in   = 1'b1;
  #10ns data_in   = 1'b0;
  #60ns $stop;
end


endmodule