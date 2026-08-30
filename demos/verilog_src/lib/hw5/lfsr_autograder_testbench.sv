`timescale 1ns/1ns

module lfsr_testbench3;
  // -- change this to test another width (2..8)
  parameter int N = 3;
  localparam int MAX_CYCLES = (1<<N) - 1;
  localparam logic [N-1:0] INIT_STATE = {N{1'b1}};               // reset loads all-1's
  // file + counters
  integer file, correct, total;

  // DUT signals
  logic               clk, reset;
  logic        [1:0]  load;
  logic       [N-1:0] seed_mask;
  logic       [N-1:0] lfsr_data;
  logic               lfsr_done;

  // golden-model state & mask
  logic       [N-1:0] golden, mask;

  // instantiate DUT
  lfsr #(.N(N)) DUT (
    .clk       (clk),
    .reset     (reset),
    .load      (load),
    .seed_mask (seed_mask),
    .lfsr_data (lfsr_data),
    .lfsr_done (lfsr_done)
  );

  // clock gen
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end

  // lookup built-in tap pattern
  function automatic [N-1:0] get_tap_pattern(input int Ni);
    case (Ni)
      2:  get_tap_pattern = 2'b11;
      3:  get_tap_pattern = 3'b110;
      4:  get_tap_pattern = 4'b1100;
      5:  get_tap_pattern = 5'b10100;
      6:  get_tap_pattern = 6'b110000;
      7:  get_tap_pattern = 7'b1100000;
      8:  get_tap_pattern = 8'b10111000;
      default: get_tap_pattern = {N{1'b0}};
    endcase
  endfunction

  // next-state golden
  function automatic [N-1:0] next_state(
      input [N-1:0] st,
      input [N-1:0] m);
    next_state = { st[N-2:0], ^(st & m) };
  endfunction

  initial begin
    // open log
    file    = $fopen($sformatf("lfsr_rslt%0d.txt", N), "w");
    correct = 0;
    total   = 0;

    // 1) RESET check
    reset     = 1'b0;    // assert (active-low)
    load      = 2'b00;
    seed_mask = '0;
    #10;                // settle
    @(posedge clk);     // sample after reset
    #1;
    if (lfsr_data !== INIT_STATE)
      $fwrite(file, "Error @ RESET: exp %b, got %b\n", INIT_STATE, lfsr_data);
    else
      correct++;
    total++;

    // deassert reset
    @(posedge clk); #1 reset = 1'b1;

    // prepare golden tap
    mask = get_tap_pattern(N);

    // 2) LOAD[0] test: tap-pattern load
    seed_mask = mask;
    load      = 2'b01;
    @(posedge clk); #1;
    // data should stay INIT_STATE
    if (lfsr_data !== INIT_STATE)
      $fwrite(file,  "Error @ LOAD[0] data: exp %b, got %b\n", INIT_STATE, lfsr_data);
    else
      correct++;
    
    total ++;
    load = 2'b00;

    // 3) LOAD[1] test: state load
    seed_mask = mask;
    load      = 2'b10;
    @(posedge clk); #1;
    // data should equal seed_mask
    if (lfsr_data !== mask)
      $fwrite(file, "Error @ LOAD[1] data: exp %b, got %b\n", mask, lfsr_data);
    else
      correct++;
    total ++;
    load   = 2'b00;

    // initialize golden sequence
    golden = mask;

    // 4) Sequence test with done-flag checks
    for (int i = 1; i <= MAX_CYCLES; i++) begin
      @(posedge clk); #1;
      golden = next_state(golden, mask);

      // check data
      if (lfsr_data !== golden)
        $fwrite(file, "Error @ cycle %0d data: exp %b, got %b\n", i, golden, lfsr_data);
      else
        correct++;
      total++;

      // check done
      if (lfsr_done !== (golden == mask))
        $fwrite(file, "Error @ cycle %0d done: exp %b, got %b\n",
                i, (golden==mask), lfsr_done);
      else
        correct++;
      total++;
    end

    // final score
    $fwrite(file, "Final score: %0d / %0d\n", correct, total);
    $fclose(file);
    $display("Testbench done: passed %0d of %0d checks", correct, total);
    $finish;
  end

endmodule
