# Art Canvas (C 13, Python): extracted from C 13 .vrpython (VEXcode VR, 2020).
# Playground: ArtCanvas. The template header ('Author: VEX') is VEXcode's own.

# ------------------------------------------
# 
# 	Project:      VEXcode Project
#	Author:       VEX
#	Created:
#	Description:  VEXcode VR Python Project
# 
# ------------------------------------------

# Library imports
from vexcode import *

# Add project code in "main"
def main():
    pen.move(DOWN)
    drivetrain.turn_for(RIGHT, 180, DEGREES)
    drivetrain.drive_for(FORWARD, 400, MM)
    drivetrain.turn_for(RIGHT,90,DEGREES)
    while location.position(X, MM) > -300:
        wait(5, MSEC) 
        drivetrain.set_drive_velocity(50, PERCENT)
        drivetrain.drive(FORWARD)
    drivetrain.stop()
    drivetrain.turn_for(RIGHT, 128.66, DEGREES)
    while location.position(Y, MM) < 0:
       wait(5, MSEC)
       drivetrain.drive(FORWARD)
    drivetrain.stop()
    brain.print("wooo")

    numero1 = distance.get_distance(MM)
    numero1 = numero1- (distance.get_distance(MM) - 400)
    drivetrain.turn_to_heading(0,DEGREES)
    drivetrain.drive_for(FORWARD, numero1, MM)
    drivetrain.turn_to_heading(270,DEGREES)
    numero2 = distance.get_distance(MM) - (distance.get_distance(MM) - 400)
    drivetrain.drive_for(FORWARD, numero2, MM)
    drivetrain.turn_for(LEFT, 135, DEGREES)
    numero3 = numero1*math.sqrt(2)
    drivetrain.drive_for(FORWARD, numero3, MM)



    





# VR threads — Do not delete
vr_thread(main())
