
module conv_enc #(parameter N = 6)( 
  input               clk,
  input               data_in,
  input               reset,
  input       [  1:0] load_mask,  // 01: load mask0; 10: load mask1 
  input       [N-1:0] mask,       
  output logic[  1:0] data_out
);

  // Internal Registers
  logic [N-1:0] mask0;   
  logic [N-1:0] mask1;  
  logic [N-1:0] history; 

  
  always_ff @(posedge clk) begin
    if (load_mask == 2'b01)
      mask0 <= mask;
    else if (load_mask == 2'b10)
      mask1 <= mask;
  end

 always_ff @(posedge clk) begin
    if (!reset) begin
      history <= '0;
    end else if (load_mask == 2'b00) begin
      history <= {data_in, history[N-1:1]};
    end
    
  end

 
  always_comb begin
    data_out[0] = ^(mask0 & history);
    data_out[1] = ^(mask1 & history);
  end

endmodule