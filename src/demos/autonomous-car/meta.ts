import type { DemoMeta } from "@/lib/demos";

const RAW = "demos/autonomous_car_raw/Code";
const CORE = "src/demos/autonomous-car/core";

const meta: DemoMeta = {
  slug: "autonomous-car",
  theme: { bg: "#f1f1ee", panel: "#e5e4df" }, // parking-lot asphalt; the accent is the tape
  what: "a ROS 2 robocar's vision, node graph and controller, running live on a simulated lot",
  why: "the car is gone, but its nodes live on as ports checked against the originals: same OpenCV calls, same messages, same PID",
  when: "ECE/MAE 148, UC San Diego, spring 2025",
  story: [
    {
      title: "Spring 2025: a car, a lot, a roll of tape",
      body:
        "UCSD's ECE/MAE 148 gives each team a 1/10-scale car, a ROS 2 software stack and a parking lot. Team 3's final project had the car follow a dashed line of yellow tape and, when its camera spotted garbage, drive to it, stop, and scoop it up with a servo arm. David wrote all of the software. The rest of the team built the car itself, including the 3D-printed parts.",
    },
    {
      title: "Seeing the tape",
      body:
        "The lane node started from the course TA's example and was reworked for this car. It watches one band of each frame (rows 50 to 70 percent of the height, the middle 70 percent of the width), keeps pixels whose HSV color falls in the tuned yellow range (hue 18 to 50, saturation at least 75, value at least 145), cleans the mask with a blur, one erosion and four dilations, and keeps only blobs whose rotated bounding box is between 15 and 112 px wide. The steering error is where the blobs sit relative to a centre line placed at 55 percent of the width. With one dash in the band the error points at that dash; with several, the node averages them on a straight and picks the nearest line outside the threshold band on a curve. The team's calibration photo shows them tuning with a much taller band (62 percent of the height) than the final file keeps. Panel 1 runs that pipeline on every frame with each calibration value on a slider.",
      anchor: "#vision",
    },
    {
      title: "One camera, two readers",
      body:
        "Everything starts at the OAK-D Lite. The camera node runs the Roboflow garbage detector on the camera itself and publishes the frame, a detection flag, a steering error toward the nearest detection, and the widest box's width in pixels. The lane node reads the same frame and publishes its own steering error on /centroid. The guidance node listens for detections for three seconds at startup and then commits to one source for the whole run, so a run is either lane-following or garbage-seeking, while the width topic can stop the car in both.",
      anchor: "#ros",
    },
    {
      title: "Closing the loop",
      body:
        "Each steering error becomes a /cmd_vel message: steering from a PID controller (Kp 0.2, Ki 0, Kd 0.1) clamped to plus or minus 1, and throttle scheduled on the error, full 0.2 while the error stays inside the 0.15 band and easing linearly to 0.1 as the error grows, so the car slows into corners. The derivative divides by a fixed 1/20 s while frames arrive at 10 Hz, which doubles the effective Kd; panel 3 lets you compare the two.",
      anchor: "#drive",
    },
    {
      title: "The garbage run",
      body:
        "When the widest detection passes 200 px, the guidance node sends zero throttle and spawns the servo node, which drives a PCA9685 over I2C to swing the scoop arm from 0 to 100 degrees and collect the item. After five seconds the node runs a fixed maneuver of five timed steps (right 80 degrees, forward 0.4 m, back 0.4 m, left 80 degrees, forward 0.34 m), then waits 1.2 s and resumes.",
      anchor: "#mission",
    },
    {
      title: "Rebuilt for this page (2026-09-23)",
      body:
        "The TypeScript ports were written with AI coding tools and checked against David's original node files, which the build imports and runs under stand-in ROS modules. Across 12 rendered frames and 8 parameter sets, the lane port publishes the same /centroid values and produces every intermediate image bit for bit (OpenCV 4.11). The guidance port sends the same 448 /cmd_vel messages and log lines over a 45-second message stream, including two sweeps. What is simulated: the camera frames (a synthetic lot seen through a 640x480 camera, a width read from the team's own detector screenshot), the detections (garbage boxes projected into that camera, standing in for the Roboflow model), and the car's physics (a bicycle model with assumed wheelbase, steering lock and speed per throttle).",
    },
  ],
  sources: [
    { name: "lane_detection_node.py", path: `${RAW}/lane_detection_node.py`, lang: "python", note: "Lane detection (course TA's example, adapted by David): HSV mask, morphology, contours, width filter, centroid error on /centroid." },
    { name: "camera_driver2.py", path: `${RAW}/camera_driver2.py`, lang: "python", note: "David's object-detection node: RoboflowOak on the OAK-D Lite, lane-style steering error toward garbage, bbox width, flag. (API key redacted in this archive.)" },
    { name: "lane_guidance_node3.py", path: `${RAW}/lane_guidance_node3.py`, lang: "python", note: "David's guidance node: startup topic probe, gain-scheduled PID, width stop, servo sweep, five-step maneuver." },
    { name: "servo_sweeper.py", path: `${RAW}/servo_sweeper.py`, lang: "python", note: "David's servo node: PCA9685 over I2C, 50 Hz, 500-2500 us, 0 to 100 degrees." },
    { name: "racer_calibration2.yaml", path: `${RAW}/racer_calibration2.yaml`, lang: "yaml", note: "The tuned parameters every panel starts from." },
    { name: "servo_launch.py", path: `${RAW}/servo_launch.py`, lang: "python", note: "ROS 2 launch description for the camera, lane detection and guidance nodes." },
    { name: "lane_guidance_node2.py", path: `${RAW}/lane_guidance_node2.py`, lang: "python", note: "The previous guidance version: stops on an OAK-D depth ROI (0.2 m) instead of box width." },
    { name: "camera_driver.py", path: `${RAW}/camera_driver.py`, lang: "python", note: "The earlier detection node (garbage-detection-2 model, depth stream on)." },
    { name: "cv.ts", path: `${CORE}/cv.ts`, lang: "ts", note: "TS ports of the OpenCV calls, bit-exact vs cv2 4.11 (fixture-tested)." },
    { name: "lane.ts", path: `${CORE}/lane.ts`, lang: "ts", note: "locate_centroid, line for line." },
    { name: "control.ts", path: `${CORE}/control.ts`, lang: "ts", note: "PathPlanner, line for line, with an injected clock." },
    { name: "prep script", path: "scripts/demos/autonomous-car_prep.py", lang: "python", note: "Build-time harness: imports the original nodes under stand-in rclpy/cv_bridge/roboflowoak/PCA9685 modules and writes the fixtures." },
  ],
  sourceFooter:
    "Code from the Team 3 repository (UCSD-Silberman-Classes-and-Projects/148-spring-2025-final-project-team-3, spring 2025). All software is David's; lane_detection_node.py began as the course TA's ucsd_robocar example. Car hardware and 3D prints by the rest of Team 3.",
};

export default meta;
