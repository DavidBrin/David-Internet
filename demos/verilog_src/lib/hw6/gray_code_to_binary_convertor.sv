module gray_code_to_binary_convertor#(parameter N = 4)( 
  input               clk, rstn, 
  input       [N-1:0] gray_value,
  output logic[N-1:0] binary_value);

  /* cominational stuff happens between the input and output registers */
  logic [N-1:0] gray_value_r;
  //logic [N-1:0] gray_value_rr; register to wait a second clock cycle
  logic [N-1:0] binary_comb;

  always_comb begin
    binary_comb[N-1] = gray_value_r[N-1];
    for (int i = N-2; i >= 0; i--)
      binary_comb[i] = binary_comb[i+1] ^ gray_value_r[i];
  end

  always @(posedge clk, negedge rstn)
    if(!rstn) begin
	  /* input & output registers reset to 0 */
      gray_value_r  <= '0;
      //gray_value_rr <= '0;
      binary_value  <= '0;
	end
	else begin
      /* input & output registers upated */    
      gray_value_r  <= gray_value;
      //gray_value_rr <= gray_value_r;
      binary_value  <= binary_comb;
    end

endmodule
