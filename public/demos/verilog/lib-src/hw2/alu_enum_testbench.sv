`timescale 1ns/1ps
// Self-checking testbench for the 16-bit MIPS-style ALU (alu_e in alu_enum.sv).
// Exercises every opa command with values chosen to tell arithmetic and logical shifts apart.
import mips_16_defs::*;

module alu_enum_testbench;
  logic signed [15:0] a;
  logic        [15:0] b;
  logic        [ 2:0] cmd;
  logic signed [15:0] r;
  int pass = 0, fail = 0;

  alu_e dut(.a(a), .b(b), .cmd(cmd), .r(r));

  task check(input logic signed [15:0] ta, input logic [15:0] tb, input opa tc, input string nm, input logic [15:0] exp);
    a = ta; b = tb; cmd = tc;
    #10;
    if (r === exp) begin
      pass++;
      $display("PASS %s a=%h b=%h r=%h", nm, ta, tb, r);
    end else begin
      fail++;
      $display("FAIL %s a=%h b=%h r=%h expected=%h", nm, ta, tb, r, exp);
    end
  endtask

  initial begin
    check(16'd5,     16'd3, AADD, "AADD", 16'd8);
    check(16'd5,     16'd3, ASUB, "ASUB", 16'd2);
    check(16'd3,     16'd5, ASUB, "ASUB", 16'hFFFE);   // -2
    check(16'h00F0,  16'h0F0F, AAND, "AAND", 16'h0000);
    check(16'h00F0,  16'h0F0F, AOR, "AOR",  16'h0FFF);
    check(16'h00F0,  16'h0F0F, AXOR, "AXOR", 16'h0FFF);
    check(16'd5,     16'd3, ASL, "ASL",  16'd40);
    check(16'hFFF8,  16'd2, ASR, "ASR",  16'hFFFE);   // -8 >>> 2 = -2 (sign extended)
    check(16'hFFF8,  16'd2, ASRU, "ASRU", 16'h3FFE);   // logical shift brings in zeros
    check(16'h8000,  16'd1, ASR, "ASR",  16'hC000);
    check(16'h8000,  16'd1, ASRU, "ASRU", 16'h4000);
    check(16'h7FFF,  16'd1, AADD, "AADD", 16'h8000);   // overflow wraps
    $display("alu_e: %0d passed, %0d failed", pass, fail);
    $finish;
  end
endmodule
