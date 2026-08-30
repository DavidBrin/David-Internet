module johnson_counter #(parameter n=4)(
  input clk,
  input clear, // async, active negedge
  input preset, // sync, active low
  input[n-1:0] load_cnt, // loads on !preset
  output logic[n-1:0] count);
  
  always_ff@(posedge clk or negedge clear)
	begin
	if(!clear)
		count <= 'b0;
	else if(!preset)
		count <= load_cnt;
	else
      count <= {~count[0], count[n-1:1]};
	end
	

  
endmodule

