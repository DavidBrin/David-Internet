transcript on
if {[file exists rtl_work]} {
	vdel -lib rtl_work -all
}
vlib rtl_work
vmap work rtl_work

vlog -sv -work work +incdir+C:/Users/david/OneDrive/Documents/UCSD\ classes/ECE111/Homework_4 {C:/Users/david/OneDrive/Documents/UCSD classes/ECE111/Homework_4/barrel_shifter.sv}

