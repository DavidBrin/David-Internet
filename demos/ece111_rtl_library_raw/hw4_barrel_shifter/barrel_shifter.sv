// Code your design here
module barrel_shifter #(
  parameter int n = 8
)(
  input  logic [$clog2(n)-1:0] shift_value,
  input  logic direction,
  input  logic [n-1:0] din,
  input  logic select,
  output logic [n-1:0] dout
);

  always_comb begin
    if (direction) begin
      dout = select ? (din << shift_value) | (din >> (n - shift_value)) : (din << shift_value);
    end else begin
      dout = select ? (din >> shift_value) | (din << (n - shift_value)) : (din >> shift_value);
    end
  end

endmodule