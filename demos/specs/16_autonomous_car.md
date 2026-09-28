# 16 · Autonomous Car (ROS 2 robocar)

Status: **built 2026-09-23**. Slug `autonomous-car` (matches the Path stone in
`content/path/journey.ts`). Theme: asphalt gray with safety-yellow accent.

## Summary

UCSD ECE/MAE 148 (Introduction to Autonomous Vehicles), spring 2025, Team 3. A 1/10-scale
robocar on ROS 2 that follows a dashed yellow tape line and hunts "garbage": an OAK-D Lite
camera runs a Roboflow detector (`garbage-dxrv3` v3) on-device, a lane-detection node turns
the same frames into a centroid error, and a guidance node closes the loop with a
gain-scheduled PID, stops when a detection's bounding box grows past 200 px, runs a servo
sweep over I2C, then a scripted five-step maneuver before resuming.

The page emphasises (user directive, 2026-09-23) **computer vision, the ROS 2 pipeline, and
the controls system**. Hardware gets a short credit section.

## Source material

Team repo (public, GitHub Classroom):
`UCSD-Silberman-Classes-and-Projects/148-spring-2025-final-project-team-3` @ `68c50d4`
(cloned to `.cache/autonomous-car/`; copied without `.git` to `demos/autonomous_car_raw/`,
Roboflow API keys redacted even though the user confirmed they were rotated / free tier).

| File | What | Author |
|---|---|---|
| `Code/lane_detection_node.py` | HSV mask → gray → threshold → blur/erode/dilate → contours → minAreaRect width filter → centroid error (straight: mean, curve: nearest line outside threshold). Subscribes to the OAK-D frame topic `/object_detections/image`. | Started from the course TA's `ucsd_robocar_lane_detection2_pkg` example; adapted by David |
| `Code/camera_driver2.py` | Final object-detection node: RoboflowOak (`garbage-dxrv3`, conf 0.60, depth off), publishes image, centroid error (lane-style math: `closest`/`average`/`minimum_error`), max bbox width on `/object_detections/depth` (name kept for compatibility), detection flag. | David |
| `Code/camera_driver.py` | Earlier version: `garbage-detection-2`, depth stream on, PointStamped with depth at bbox center. | David |
| `Code/lane_guidance_node3.py` | Final guidance: startup topic probe (3 s) chooses object vs lane centroid; PID steering (Kp 0.2, Ki 0, Kd 0.1, Ts 1/20); throttle scheduled on abs(error) between min 0.1 and max 0.2; width > 200 px → stop → spawn servo sweeper (5 s) → 5 timed steps → resume after 1.2 s. | David |
| `Code/lane_guidance_node2.py` | Previous version using an OAK-D depth image ROI + 0.2 m threshold instead of bbox width. | David |
| `Code/servo_sweeper.py` | PCA9685 over I2C, 50 Hz, 500-2500 us, channel 0: 0 deg → 100 deg → disable. | David |
| `Code/racer_calibration2.yaml` | Tuned parameters for lane detection, guidance, VESC/Adafruit twist nodes. | David |
| `Code/servo_launch.py`, `setup.py`, `final_package_xml.xml` | ament_python package `final_pkg`, launch description. | David (package.xml maintainer tag still the course template's) |
| `CoolCarPics/` | 2 photos of live debug screens (lane calibration GUI; garbage detection outdoors), 2 short clips (servo arm; top-down on tape). | Team |
| YouTube `fsfP0zoJJ4U` ("May 21, 2025") | Lane-following run, third-person. | David's channel |

Credit (user, 2026-09-23): **all software is David's**; the rest of Team 3 built the hardware
(assembly + 3D prints). `CAD designs/` is empty in the repo.

Findings carried honestly on the page and in the README:
- The guidance node's topic probe runs once at startup, so a run is either garbage-seeking or
  lane-following; the width stop works in both.
- PID derivative uses fixed Ts = 1/20 s while frames arrive from a 10 Hz timer, so the
  effective Kd is doubled relative to the nominal value.
- Avoidance steps are open-loop, timed (duration = distance / speed); steps 1 and 4 command
  `angular.z` with `linear.x = 0` (a turn in place in Twist units), which an Ackermann chassis
  can only express as a wheel swing. Steps use ROS's negative-is-right sign while the PID
  path uses positive-is-right (course actuator convention).
- `setup.py` registers `servo_sweeper.py` but the guidance node spawns `servo_sweeper`.
- `width_threshold` is not in the yaml, so the 200 px default applies.

## Stage

Prefix `ac`. Five sections:

1. `#vision` **Lane vision, stage by stage** (prefix `acVi`). A virtual 640x480 OAK-D frame
   (width read from the team's detector screenshot) rendered from a car pose on the synthetic lot (presets: straight, curve, dash gap, glare /
   grass, garbage in view). The ported pipeline shows every intermediate (crop ROI, HSV mask,
   gray-of-HSV, threshold, blur, erode, dilate, contours with minAreaRect pass/fail, centroids,
   straight/curve decision with threshold lines exactly like the node's debug overlay). All
   calibration sliders default to `racer_calibration2.yaml`. Beside it: the real calibration
   GUI photo. Garbage overlay: detector stand-in bbox + centroid error + width vs 200 px.
   Animation: frames stream while the car creeps along; stage thumbnails update live.
2. `#ros` **The ROS 2 graph** (prefix `acRo`). Nodes + topics as a live diagram; message dots
   travel at real rates; a `ros2 topic echo`-style pane shows values from a headless sim. The
   startup probe is animated (3 s spin_once window, then the subscription is chosen). Toggle
   detector on/off to see the other branch. Click a node → its parameters and the key code.
3. `#drive` **Closed loop** (prefix `acDr`). Top-down lot + onboard camera inset; the real
   pipeline + PID drive a bicycle model. Sliders: Kp, Ki, Kd, max/min throttle, error
   threshold, camera rate; presets (team gains, P only, high Kp, no schedule, Ts fixed vs
   true). Strip charts: error, steering, throttle; lap time and mean abs error.
4. `#mission` **The garbage run** (prefix `acMi`). State machine (DRIVE → STOP → SWEEP →
   AVOID 1-5 → RESUME) animated with the top-down scene; servo dial with PCA9685 pulse /
   duty-cycle math; command timeline of the five Twist steps.
5. `#car` **The car** (prefix `acCa`). Photos, clips (animated WebP), YouTube embed, team
   hardware credit.

## Story rail

Spring 2025, 148 → who did what → vision → ROS 2 graph → controls → garbage run →
rebuilt for this page (AI-tools disclosure, fixture tests vs OpenCV 4.11, synthetic camera,
simulated detector, assumed physical constants).

## Tech

- `src/demos/autonomous-car/core/`: `cv.ts` (BGR2HSV, inRange, BGR2GRAY, threshold, box blur,
  erode/dilate, findContours external, convexHull, minAreaRect, contour moments), `lane.ts`
  (locate_centroid), `detect.ts` (camera_driver2 math), `control.ts` (PathPlanner), `world.ts`,
  `camera.ts`, `sim.ts`, `params.ts`.
- Fixtures: `tests/fixtures/autonomous-car-*.json` from `scripts/demos/autonomous-car_prep.py`,
  which imports David's ORIGINAL node files under stubbed rclpy / cv_bridge / roboflowoak /
  PCA9685 modules and runs them on frames rendered by the page's own camera
  (`scripts/demos/autonomous-car.ts`); `tests/autonomous-car-core.test.ts` (12 tests).
- Assets: `public/demos/autonomous-car/` (downscaled photos, WebP clips, YouTube poster).

## Out of scope

Running the Roboflow model in the browser (it runs on the OAK-D; a browser build would need
Roboflow's inference.js, a publishable key and network access). CAD (none in the repo). The
car's onboard computer and ROS launch environment (not described in the repo).

## Resolved questions (2026-09-23)

- Credit: all software is David's; teammates did the hardware assembly and 3D prints;
  lane_detection began from the TA's class example, adapted by David.
- API keys: rotated, free tier; redacted in the archive anyway.
- The servo arm scoops/collects the item during the sweep (the sim removes it at 100 deg).
- Emphasis: computer vision, the ROS 2 pipeline, the controls system.
