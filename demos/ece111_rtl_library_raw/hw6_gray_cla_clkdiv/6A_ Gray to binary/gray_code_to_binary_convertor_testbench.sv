//gray code to binary convertor testbench code
module gray_to_binary_convertor_testbench;
  parameter N=16;
  bit          clock, rstn;
  bit  [N-1:0] gray_value; 
  wire [N-1:0] binary_value;
  logic[N-1:0] binary_valueEQ[2],
               binary_valueE,
			   grayQ[2];
// Instantiate design under test			  
  gray_code_to_binary_convertor_starter #(.N(N)) design_instance(
    .clk         (clock),
    .rstn        (rstn),
    .gray_value  (gray_value),
    .binary_value(binary_value)
);

initial begin

// Wait 20 ns for global reset to finish and start counter
  #20ns rstn = '1;

// Drive gray value	by building a binary-to-gray coder into the test bench
  for(int i=0; i<N+1; i++) begin
    #20ns gray_value   = i;
    binary_valueE[N-1] = gray_value[N-1];
    for(int i=N-1; i>0; i--)
      binary_valueE[i-1] = binary_valueE[i]^gray_value[i-1];
  end

// Wait for 20ns and terminate
  #20ns $stop;
end

// The usual clock generator logic
always begin
  #10ns clock = 1;
  #10ns clock = 0;
end

always @(posedge clock) begin
  binary_valueEQ[1] <= binary_valueEQ[0];
  binary_valueEQ[0] <= binary_valueE;
  grayQ[0]          <= gray_value;
  grayQ[1]          <= grayQ[0];
  #1ns 								// allow clk-to-Q delay 
  if(binary_valueEQ[1]!=='x) begin
    if(binary_valueEQ[1]!==binary_value)  
      $display("gray=%b, bin_exp=%b, bin=%b RATS!",	  // substitute any other 4-letter word of your choice :)
      grayQ[1],	binary_valueEQ[1], binary_value);
    else
      $display("gray=%b, bin_exp=%b, bin=%b YAA!",
      grayQ[1],	binary_valueEQ[1], binary_value);
  end
end
endmodule