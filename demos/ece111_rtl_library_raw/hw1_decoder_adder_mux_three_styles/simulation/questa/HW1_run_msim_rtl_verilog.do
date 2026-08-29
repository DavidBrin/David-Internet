transcript on
if {[file exists rtl_work]} {
	vdel -lib rtl_work -all
}
vlib rtl_work
vmap work rtl_work

vlog -sv -work work +incdir+C:/Users/david/OneDrive/Documents/UCSD\ classes/ECE111/Homework1/Homework1/Lab1 {C:/Users/david/OneDrive/Documents/UCSD classes/ECE111/Homework1/Homework1/Lab1/mux_2x1_gate.sv}

