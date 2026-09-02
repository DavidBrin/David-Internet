# Grid experiment (Python): extracted from Experiment text project.vrpython (VEXcode VR, 2020).
# Playground: Grid. The template header ('Author: VEX') is VEXcode's own.

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
    drivetrain.drive_for(FORWARD, 200, MM)
    drivetrain.turn_for(RIGHT, 90, DEGREES) 
    drivetrain.drive_for(FORWARD, 600, MM)
    pen.move(DOWN)


    while (drivetrain.heading(DEGREES) < 180):
        drivetrain.drive_for(FORWARD, 400, MM)
        drivetrain.turn_for(LEFT, 90, DEGREES)

    drivetrain.drive_for(FORWARD, 400, MM)
    drivetrain.turn_for(LEFT, 90, DEGREES)
    drivetrain.drive_for(FORWARD, 400, MM)
    drivetrain.stop()

    drivetrain.turn_for(LEFT, 90, DEGREES)
    drivetrain.turn_for(LEFT, 45, DEGREES)
    drivetrain.drive_for(FORWARD, 565.685, MM)

    pen.move(UP)
    drivetrain.drive_for(FORWARD, 200, MM)

    brain.print("yay")

    def operation_circle():
        brain.print("CIRCLE")
        drivetrain.turn_to_heading(0, DEGREES)
        drivetrain.drive_for(FORWARD, 250, MM)
        drivetrain.turn_to_heading(2, DEGREES)
        drivetrain.set_drive_velocity(500, PERCENT)
        drivetrain.set_turn_velocity(500, PERCENT)
        pen.move(DOWN)
        while (drivetrain.heading(DEGREES) > 1):
            drivetrain.drive_for(FORWARD, 15, MM)
            drivetrain.turn_for(LEFT, 4, DEGREES)

    operation_circle()


# VR threads — Do not delete
vr_thread(main())

