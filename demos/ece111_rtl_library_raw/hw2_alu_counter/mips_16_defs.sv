package mips_16_defs;
	
	parameter PC_WIDTH = 8,
	          INSTR_MEM_ADDR_WIDTH = 8,
			  DATA_MEM_ADDR_WIDTH  = 8;
 
/************* Operation Code in instructions ********/
    typedef enum logic[3:0]
       {NOP, ADD,  SUB, AND,			
	    OOR, XOR,  OSL, OSR,			
	    SRU, ADI,  OLD, OST, 
	    OBZ} ops;			
	
/************** ALU operation command ****************/
	typedef enum logic[2:0]
	   {AADD, ASUB, AAND, AOR,			
	    AXOR, ASL,  ASR,  ASRU} opa;			
	
/************** Branch condition code ****************/
	parameter BRANCH_Z  = 3'b000,
	          BRANCH_GT	= 3'b001,
	          BRANCH_LE	= 3'b010;
	
endpackage 
 
 