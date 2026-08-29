// LFSR generator
// This function is useful in both encoder and decoder
module lfsr #(parameter N=6)(
  input               clk,
                      reset,      // active low
  input       [  1:0] load,           // [1]: lfsr_data = seed_mask; [0]: tap_ptrn = seed_mask
  input       [N-1:0] seed_mask,      // initial state or tap pattern
  output logic[N-1:0] lfsr_data,    // current state
  output logic        lfsr_done);   // current state = initial state set by load[1]

  logic [N-1:0] tap_ptrn;
  logic [N-1:0] seed_data;
  logic         feedback;

  function logic [N-1:0] default_tap;
    input int n;
    case (n)
      2: default_tap = 2'b11;
      3: default_tap = 3'b110;
      4: default_tap = 4'b1100;
      5: default_tap = 5'b10100;
      6: default_tap = 6'b110000;
      7: default_tap = 7'b1100000;
      8: default_tap = 8'b10111000;
      default: default_tap = '0;
    endcase
  endfunction

  assign feedback = ^(lfsr_data & tap_ptrn);
  assign lfsr_done = (lfsr_data == seed_data);

  always_ff @(posedge clk) begin
    if (!reset) begin
      lfsr_data <= '1;
      tap_ptrn  <= default_tap(N);
      seed_data <= '1;
    end else if (load[1]) begin
      lfsr_data <= seed_mask;
      seed_data <= seed_mask;
    end else if (load[0]) begin
      tap_ptrn <= seed_mask;
    end else begin
      lfsr_data <= {lfsr_data[N-2:0], feedback};
    end
  end

endmodule