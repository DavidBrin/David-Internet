// 2to1 Multiplexor behavioral code
module mux_2x1(
  input in0, in1, 
  input sel, 
  output logic out
); 

 assign out =sel? in1 : in0;
endmodule
 

module barrel_shifter #(
  parameter int n = 8 //declared to be variable but would need nested for loop for general case (just building for 8 for requirements)
)(
  input  logic [$clog2(n)-1:0] shift_value,
  input  logic direction,        // 0 = right, 1 = left 
  input  logic [n-1:0] din,
  input  logic select,        
  output logic [n-1:0] dout
  
);
  
  logic [n-1:0] stage0, stage1;
genvar i;
generate
  for (i = 0; i < n; i++) begin : STAGE0  //using n but doesn't work for n>8 (mvp)
    logic shifted_bit;

    always_comb begin
      if (direction == 0) begin  // right
        if (select)  // rotate
          shifted_bit = din[(i+1) % n];
        else          // logical
          shifted_bit = (i+1 < n) ? din[i+1] : 1'b0;
      end
      else begin  // left
        if (select)  // rotate
          shifted_bit = din[(i-1+n) % n];
        else         // logical
          shifted_bit = (i-1 >= 0) ? din[i-1] : 1'b0;
      end
    end

    mux_2x1 m0 (
      .in0(din[i]),
      .in1(shifted_bit),
      .sel(shift_value[0]),
      .out(stage0[i])
    );
  end
endgenerate

generate
  for (i = 0; i < n; i++) begin : STAGE1
    logic shifted_bit;

    always_comb begin
      if (direction == 0) begin  // right
        if (select)  // rotate
          shifted_bit = stage0[(i+2) % n];
        else          // logical
          shifted_bit = (i+2 < n) ? stage0[i+2] : 1'b0;
      end
      else begin  // left
        if (select)  // rotate
          shifted_bit = stage0[(i-2+n) % n];
        else         // logical
          shifted_bit = (i-2 >= 0) ? stage0[i-2] : 1'b0;
      end
    end

    mux_2x1 m0 (
      .in0(stage0[i]),
      .in1(shifted_bit),
      .sel(shift_value[1]),
      .out(stage1[i])
    );
  end
endgenerate
 
generate
  for (i = 0; i < n; i++) begin : STAGE2
    logic shifted_bit;

    always_comb begin
      if (direction == 0) begin  // right
        if (select)  // rotate
          shifted_bit = stage1[(i+4) % n];
        else          // logical
          shifted_bit = (i+4 < n) ? stage1[i+4] : 1'b0;
      end
      else begin  // left
        if (select)  // rotate
          shifted_bit = stage1[(i-4+n) %n];
        else         // logical
          shifted_bit = (i-4 >= 0) ? stage1[i-4] : 1'b0;
      end
    end

    mux_2x1 m2 (
      .in0(stage1[i]),
      .in1(shifted_bit),
      .sel(shift_value[2]),
      .out(dout[i])
    );
  end
endgenerate
  
endmodule