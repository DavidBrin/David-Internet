`timescale 1ns/1ns
//LFSR Testbench Code With Built-in Checker
module lfsr_testbench;
  parameter N = 6;			  // try values of N = 2 through 8
  logic           clock;
  logic           reset;        // active low
  logic  [  1:0]  load;         // each bit active high
  logic  [N-1:0]  seed_mask = '1;	// ~0   11...11
  int           ct;
  wire [N-1:0]  lfsr_data; 
  wire          lfsr_done;
  logic[7:0]    ct_start;   

  lfsr #(.N(N)) design_inst(

   .clk      (clock),
   .reset    ,
   .load,
   .seed_mask,

   .lfsr_data,
   .lfsr_done
  );
  int file;
  initial begin
    file = $fopen("rslt.txt");     // $fdisplay(2,...) writes to "rslt.txt"
   // $fdisplay(1,..) writes to log/console/transcript    2+1 = 3
   // Wait 10 ns for global reset to finish and start counter
     #10ns   reset     = '1;      // release reset
     for(int i=0; i<2**N; i++) #10ns; // operate for 2**N cycles 
	 //#10ns   reset     = '0;
	 load      = 2'b10;
	 case(N)
	   5: seed_mask = 8'h12;  // also try 8'h14, 8'h17, 8'1b, 8'h1d, 8'h1e  
	   6: seed_mask = 8'h21;  // also try 8'h2D, 8'h30, 8'h33, 8'h36, 8'h39
	 endcase
	 //#10ns   reset  = '1; 
	 #10ns     load   = 2'b01;
     #10ns 	   load   = '0;
	 for(int i=0; i<2**N; i++) #10ns;
	 #10ns 	 reset  = '0;
	 $fclose(file); 
     $finish;             // terminate simulation
  end

  always_ff @(posedge clock) 
    ct <= reset? ct+1 : '0;

  // Clock generator logic
  always begin
    #5ns clock = '1;          // DUT updates on rising edges of clock
    #5ns clock = '0;          // inputs change on falling edges of clock
    $fdisplay(3,"time=%0t,  reset=%b  seed_data=%b  lfsr_data=%b  done=%b count=%d", 
      $time, reset, seed_mask, lfsr_data, lfsr_done, ct);
    if(|load) ct_start = ct+1;
	  if(ct<2) ct_start = 0;
	  if((lfsr_data == seed_mask)&&ct) $fdisplay(3,"back where we started at ct = %d",ct); 
	  if(lfsr_done && ct) begin
	  $fdisplay(3,"lfsr_data = seed_data = %b at ct = %d",lfsr_data, ct);
	  $fwrite(3,"ct=%d,ct_start=%d,dif=%d     ",ct,ct_start,(ct-ct_start));
	  if((ct-ct_start) == 2**N-1) $fdisplay(3,"SUCCESS!!!");	  // watch for this display
	  else if(ct) $fdisplay(3,"WRONG!!!");
    end
  end

endmodule

					  