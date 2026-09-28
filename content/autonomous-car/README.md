# Autonomous Car: demo content

The `/demos/autonomous-car` page: Team 3's final project in UCSD ECE/MAE 148
(Introduction to Autonomous Vehicles, spring 2025), a 1/10-scale ROS 2 car that follows a
dashed yellow tape line and hunts garbage with an OAK-D Lite camera. David wrote all of
the software; the rest of the team built the car (assembly and 3D-printed parts).

Source: the public team repository
`UCSD-Silberman-Classes-and-Projects/148-spring-2025-final-project-team-3` at `68c50d4`,
archived in `demos/autonomous_car_raw/` (Roboflow API keys redacted; they had already
been rotated).

## What is on the page

1. **Lane vision, stage by stage** (`#vision`): `lane_detection_node.locate_centroid`
   ported to TypeScript and run on a virtual camera: crop band, HSV mask, the gray
   conversion, threshold, blur, erosion, dilation, external contours, the minAreaRect
   width filter (15 to 112 px), contour-moment centroids and the straight/curve error
   logic, each stage visible, each calibration value a slider (defaults from
   `racer_calibration2.yaml`).
2. **The ROS 2 graph** (`#ros`): camera/detector, lane detection, guidance, servo
   sweeper and the VESC twist node with their topics; live values; the three-second
   startup probe that picks `/centroid` or `/object_detections/centroid`.
3. **Closed loop** (`#drive`): the lane node + guidance node drive a bicycle-model car
   around a taped stadium loop; PID and throttle-schedule sliders, strip charts.
4. **The garbage run** (`#mission`): garbage mode end to end: home on the detection,
   stop past 200 px, servo sweep (PCA9685 pulse and duty cycle), the five timed steps,
   the 1.2 s blocking resume.
5. **The car** (`#car`): the two debug-screen photos, the two clips, the YouTube run.

## Honesty notes

- **Fidelity.** The TS ports (written with AI coding tools, 2026-09-23) are tested
  against David's original node files, which `scripts/demos/autonomous-car_prep.py`
  imports and runs under stand-in `rclpy`, `cv_bridge`, `roboflowoak` and PCA9685
  modules (`tests/autonomous-car-core.test.ts`, 12 tests): the lane port publishes the
  same `/centroid` values and every intermediate image matches bit for bit (OpenCV
  4.11) on 12 frames x 8 parameter sets; the guidance port sends the same 448 `/cmd_vel`
  messages and log lines over a 45 s scripted stream (two sweeps, two maneuvers);
  `run_model` and the servo duty cycles match too. `np.int0` (removed in NumPy 2, used
  only to draw the debug box) is aliased to `np.intp` in the harness.
- **Simulated, not recorded.** No camera frames, rosbags or telemetry were archived.
  The page renders a synthetic lot through a virtual camera: 640x480 (the width is
  read from the team's detector screenshot, where the red threshold lines, 0.15 x W
  apart, span about twice a box labelled 45 px), 69 degree horizontal FOV (OAK-D Lite
  colour camera), with an assumed mount (30 cm high, 18 degrees down). Detections are
  garbage boxes projected into that camera, standing in for the Roboflow model
  (`garbage-dxrv3` v3), which runs on the camera and can't run here. The car is a
  kinematic bicycle model with assumed constants (0.33 m wheelbase, 26 degree lock,
  5 m/s per unit throttle).
- **The scoop.** Per David, the servo arm scoops up the item during the sweep; the
  simulation removes it when the arm reaches 100 degrees.
- **Quirks kept as written** (shown on the page, not fixed): the gray conversion reads
  the HSV channels as if they were BGR; in the curve branch, lines inside the threshold
  band are replaced by an error of 1; the PID derivative divides by a fixed 1/20 s while
  frames arrive at 10 Hz; the integral is clamped to 1e-8 (Ki is 0 anyway); the
  maneuver's Twists are written in differential-drive terms (turn in place, negative
  angular.z = right) while the PID path uses the course actuator's positive = right;
  `setup.py` registers `servo_sweeper.py` while the guidance node spawns
  `servo_sweeper`; `width_threshold` is not in the yaml, so the 200 px default applies.
- **Course code.** `lane_detection_node.py` began as the course TA's `ucsd_robocar`
  lane-detection example; David adapted it (camera topic, tuning) along with the rest
  of the package.

## Building

`pnpm sync-demos autonomous-car` renders the fixture frames with the page's own camera
(`scripts/demos/autonomous-car.ts`), then runs `scripts/demos/autonomous-car_prep.py`
(`py -3.12`; numpy, opencv-python, Pillow), which writes `tests/fixtures/autonomous-car-*.json`
and `public/demos/autonomous-car/` (downscaled photos, animated-WebP clips, posters).
Outputs are committed; production builds need no Python.

## Attribution

Code: the Team 3 repository (UCSD-Silberman-Classes-and-Projects, GitHub Classroom),
all software by David; `lane_detection_node.py` started from the course TA's example.
Hardware and 3D prints: the rest of Team 3. Course: UCSD ECE/MAE 148, spring 2025.
