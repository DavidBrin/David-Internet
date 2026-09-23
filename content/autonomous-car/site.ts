import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "autonomous-car",
  kind: "demo",
  displayName: "Autonomous Car",
  fakeDomain: "autonomous-car.davids.net",
  liveUrl: "/demos/autonomous-car",
  tagline: "A ROS 2 robocar that follows tape and scoops up garbage, with its vision, node graph and controller running live in the browser.",
  description:
    "Interactive demo of Team 3's final project in UCSD ECE/MAE 148 (spring 2025): a 1/10-scale car on ROS 2 that follows a dashed yellow tape line and hunts garbage with an OAK-D Lite camera. David wrote all of the software. The page runs his lane-detection node (HSV mask, morphology, contours, minAreaRect width filter, centroid error) frame by frame on a virtual camera, animates the ROS 2 graph with live topic values, closes the loop with his gain-scheduled PID controller on a simulated lot, and plays the garbage run: stop when the detection box passes 200 px, sweep the scoop arm over I2C, then a five-step maneuver. The TypeScript ports are fixture-tested against David's original node files running under stubbed ROS modules, and every OpenCV call matches cv2 bit for bit.",
  accentColor: "#EAB308",
  favicon: "\u{1F697}",
  techStack: ["ROS 2", "Python", "OpenCV", "OAK-D Lite", "Roboflow", "PCA9685 / I2C", "TypeScript", "Canvas"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#vision",
      title: "Lane vision, stage by stage",
      snippet:
        "The lane node's pipeline on a live camera feed: crop, HSV mask, gray, threshold, blur, erode, dilate, contours, the minAreaRect width filter and the steering error, with every calibration value as a slider.",
      keywords: ["lane detection", "hsv", "opencv", "contours", "minarearect", "centroid", "calibration"],
    },
    {
      path: "#ros",
      title: "The ROS 2 graph",
      snippet:
        "Camera, lane detection, guidance and servo nodes with messages flowing at their real rates; ros2 topic echo on every topic and the startup probe that picks lane or garbage mode.",
      keywords: ["ros 2", "nodes", "topics", "cmd_vel", "centroid", "rclpy", "launch"],
    },
    {
      path: "#drive",
      title: "Closed loop: PID + throttle scheduling",
      snippet:
        "David's controller drives a simulated car around a taped lot: tune Kp, Ki, Kd and the throttle schedule and watch error, steering and throttle on strip charts.",
      keywords: ["pid", "steering", "throttle", "gain scheduling", "control", "derivative"],
    },
    {
      path: "#mission",
      title: "The garbage run",
      snippet:
        "Home on a detection, stop when the box passes 200 px, sweep the scoop arm (PCA9685 duty cycles shown), then the five timed maneuver steps and resume.",
      keywords: ["object detection", "roboflow", "oak-d", "servo", "state machine", "maneuver"],
    },
    {
      path: "#car",
      title: "The car",
      snippet: "Photos of the live debug screens, the scoop arm and the car on tape, and the lane-following run.",
      keywords: ["robocar", "photos", "video", "hardware", "3d print"],
    },
  ],
  images: [
    { src: "/demos/autonomous-car/media/detect-debug.jpg", caption: "Garbage detection running outdoors: box, steering error line and threshold band", targetPath: "#mission" },
    { src: "/demos/autonomous-car/media/lane-debug.jpg", caption: "The lane calibration GUI: mask, sliders and tracked centroids", targetPath: "#vision" },
  ],
  videos: [],
  keywords: [
    "autonomous car", "robocar", "ros 2", "ece 148", "mae 148", "lane following", "opencv",
    "pid", "oak-d", "roboflow", "garbage detection", "servo", "ucsd",
  ],
  knowledgePanel: {
    type: "Course project demo",
    facts: {
      Course: "UCSD ECE/MAE 148, spring 2025 (Team 3 final project)",
      Role: "all software (ROS 2 nodes, vision, control); teammates built the hardware",
      Stack: "ROS 2 (rclpy), OpenCV, OAK-D Lite + Roboflow, VESC, PCA9685 servo",
      "Live in-browser": "lane pipeline, ROS graph, PID loop, garbage-run state machine",
      Fidelity: "TS ports fixture-tested vs the original nodes under stubbed ROS; OpenCV ops bit-exact",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
