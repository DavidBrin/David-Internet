import mips_16_defs::*;

module alu_e
(
  input	signed       [15:0]	a,		//src1
  input		         [15:0]	b,		//src2
  input		         [ 2:0]	cmd,	//function sel
  output logic signed[15:0]	r		//result	
);
  opa cmde;
  always_comb begin
                r = 'b0;
  	case(cmd)
	  AADD: 	r = a + b;
      ASUB: 	r = a - b;
	  AAND: 	r = a & b;
	  AOR : 	r = a | b;
	  AXOR: 	r = a ^ b;
	  ASL : 	r = a << b;
	  ASR :	r = a >>> b;
	  ASRU:	r = a >> b;
    endcase
    cmde = opa'(cmd);

  end
	
endmodule 