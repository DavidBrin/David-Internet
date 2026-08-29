`timescale 1ns/1ns
//Carry Lookahead Adder Testbench Code
module carry_lookahead_adder_testbench;
 parameter N = 32;
 bit[N-1:0] in0, in1;
 bit carryin;
 wire[N:0] sum;
 logic[N:0] sum_exp;

// Instantiate design under test
  carry_lookahead_adder_starter #(.N(N)) design_instance(
    .A(in0),
    .B(in1),
    .CIN(carryin),
    .result(sum));	

initial begin
// Initialize Inputs
// Wait 50 ns 
  #50ns in0=2; in1=1; carryin=1;
  #20ns        in1=1; carryin=0;
  #20ns in0=2; in1=2; 
  #20ns in0=3; in1=1;
  #20   in0=4; in1=7; carryin=1;
  #20   in0=15;in1=2;	carryin=0;
  #20   in0=10;in1=5;
  #20   for(int i=0;i<50;i++) begin
    #20ns in0 = $random; in1 = $random; carryin = $random; 
  end
end

//initial begin
// $monitor(" time=%0t   A=%d   B=%d   CIN=%d   result=%d\n", $time, in0, in1, carryin, sum);
//end
always @(in0, in1, carryin) begin
  # 5ns sum_exp = in0+in1+carryin;
  # 5ns if(sum != sum_exp) $display("doesn't add up! %d != %d",sum,sum_exp); 
end

endmodule