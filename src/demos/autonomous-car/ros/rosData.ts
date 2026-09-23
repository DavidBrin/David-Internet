/**
 * Static facts for the #ros panel: the five nodes, their wiring, parameters and short
 * verbatim excerpts from the archived files in demos/autonomous_car_raw/Code/, and the
 * two graph layouts (wide and phone).
 */
import { DETECT_PARAMS, GUIDANCE_PARAMS, LANE_PARAMS, SERVO, VESC_PARAMS, servoDuty } from "../core/params";
import type { TopicName } from "./runtime";

export type NodeId = "det" | "lane" | "guid" | "servo" | "vesc";

export interface Wire {
  topic: string;
  type: string;
  note?: string;
}

export interface NodeInfo {
  id: NodeId;
  name: string;
  file: string;
  origin: string;
  pubs: Wire[];
  subs: Wire[];
  rate: string;
  params: [string, string][];
  excerpt: { file: string; lines: string; code: string };
  note?: string;
}

const g = GUIDANCE_PARAMS;
const l = LANE_PARAMS;
const d0 = servoDuty(0);
const d100 = servoDuty(100);

export const NODES: Record<NodeId, NodeInfo> = {
  det: {
    id: "det",
    name: "object_detection_node",
    file: "Code/camera_driver2.py",
    origin: "David. RoboflowOak runs the garbage-dxrv3 v3 detector on the OAK-D Lite itself.",
    pubs: [
      { topic: "/object_detections/image", type: "sensor_msgs/Image", note: "every frame, before the detections" },
      { topic: "/object_detections/centroid", type: "std_msgs/Float32", note: "only when something is detected" },
      { topic: "/object_detections/depth", type: "std_msgs/Float32", note: "the widest box's width in px; the name was kept for compatibility" },
      { topic: "/object_detections/flag", type: "std_msgs/Bool", note: "every frame" },
    ],
    subs: [],
    rate: "create_timer(0.1, self.run_model): 10 Hz",
    params: [
      ["model", `${DETECT_PARAMS.model} v${DETECT_PARAMS.version}`],
      ["confidence", DETECT_PARAMS.confidence.toFixed(2)],
      ["overlap", String(DETECT_PARAMS.overlap)],
      ["depth", "False (stream off)"],
      ["camera_centerline", String(DETECT_PARAMS.camera_centerline)],
      ["target_selection_method", `'${DETECT_PARAMS.target_selection_method}'`],
      ["min_width_for_detection", DETECT_PARAMS.min_width_for_detection.toFixed(1)],
    ],
    excerpt: {
      file: "camera_driver2.py",
      lines: "162-171",
      code: `detection_flag_msg = Bool()
detection_flag_msg.data = len(garbage_predictions) > 0
self.detection_flag_pub.publish(detection_flag_msg)

# Calculate and publish centroid error (steering command)
steering_error = 0.0
if len(garbage_predictions) > 0:
    steering_error = self.calculate_centroid_error(garbage_predictions)
    self.centroid_error.data = steering_error
    self.centroid_error_publisher.publish(self.centroid_error)`,
    },
    note: "The centroid is published only inside `if len(garbage_predictions) > 0`, so with nothing in view the topic exists but stays silent. That is what the startup probe tests.",
  },
  lane: {
    id: "lane",
    name: "lane_detection_node",
    file: "Code/lane_detection_node.py",
    origin: "Begun from the course TA's ucsd_robocar_lane_detection2_pkg example, adapted by David.",
    pubs: [{ topic: "/centroid", type: "std_msgs/Float32", note: "only when at least one line passes the width filter" }],
    subs: [{ topic: "/object_detections/image", type: "sensor_msgs/Image", note: "callback locate_centroid" }],
    rate: "one callback per image: 10 Hz, set by the camera's timer",
    params: [
      ["Hue", `${l.Hue_low} to ${l.Hue_high}`],
      ["Saturation", `${l.Saturation_low} to ${l.Saturation_high}`],
      ["Value", `${l.Value_low} to ${l.Value_high}`],
      ["gray_lower", String(l.gray_lower)],
      ["kernal_size / erode / dilate", `${l.kernal_size} / ${l.erosion_itterations} / ${l.dilation_itterations}`],
      ["Width_min / Width_max", `${l.Width_min} / ${l.Width_max} px`],
      ["error_threshold", String(l.error_threshold)],
      ["crop_width / rows_to_watch / rows_offset", `${l.crop_width_decimal} / ${l.rows_to_watch_decimal} / ${l.rows_offset_decimal}`],
      ["camera_centerline", String(l.camera_centerline)],
    ],
    excerpt: {
      file: "lane_detection_node.py",
      lines: "19-25",
      code: `def __init__(self):
    super().__init__(NODE_NAME)
    self.centroid_error_publisher = self.create_publisher(Float32, CENTROID_TOPIC_NAME, 10)
    self.centroid_error_publisher
    self.centroid_error = Float32()
    self.camera_subscriber = self.create_subscription(Image, CAMERA_TOPIC_NAME, self.locate_centroid, 10)
    self.camera_subscriber`,
    },
    note: "CAMERA_TOPIC_NAME is '/object_detections/image': the lane node reads the detector's frames, so one camera feeds both readers.",
  },
  guid: {
    id: "guid",
    name: "lane_guidance_node",
    file: "Code/lane_guidance_node3.py (class PathPlanner)",
    origin: "David. The PID and throttle-scheduling skeleton came from the course template.",
    pubs: [{ topic: "/cmd_vel", type: "geometry_msgs/Twist", note: "one per centroid message, and every 0.1 s during the maneuver" }],
    subs: [
      { topic: "/centroid or /object_detections/centroid", type: "std_msgs/Float32", note: "exactly one, chosen by check_topic_availability; callback controller" },
      { topic: "/object_detections/depth", type: "std_msgs/Float32", note: "callback width_callback" },
    ],
    rate: "event driven (controller per message) plus create_timer(0.1, check_sweep_and_avoidance_status)",
    params: [
      ["Kp / Ki / Kd", `${g.Kp_steering} / ${g.Ki_steering.toFixed(1)} / ${g.Kd_steering}`],
      ["error_threshold", String(g.error_threshold)],
      ["max_throttle / min_throttle", `${g.max_throttle} / ${g.min_throttle}`],
      ["steering limits", `${g.max_left_steering.toFixed(1)} to ${g.max_right_steering.toFixed(1)}`],
      ["width_threshold", `${g.width_threshold.toFixed(1)} px (code default; not in the yaml)`],
      ["sweep_duration / resume_delay", `${g.sweep_duration} s / ${g.resume_delay} s`],
      ["turn_speed / turn_angle_deg", `${g.turn_speed} rad/s / ${g.turn_angle_deg} deg`],
      ["probe timeout", "3.0 s of spin_once(timeout_sec=0.1)"],
    ],
    excerpt: {
      file: "lane_guidance_node3.py",
      lines: "26-35",
      code: `# Check if OBJ_CENTROID_TOPIC_NAME is publishing data
self.topic_to_use = self.check_topic_availability()

# Subscribe to the chosen topic
self.centroid_subscriber = self.create_subscription(
    Float32,
    self.topic_to_use,
    self.controller,
    10
)`,
    },
  },
  servo: {
    id: "servo",
    name: "servo_sweeper",
    file: "Code/servo_sweeper.py",
    origin: "David. Not a standing node: the guidance node spawns it with subprocess.Popen(['ros2', 'run', 'final_pkg', 'servo_sweeper']) and terminates it after sweep_duration.",
    pubs: [],
    subs: [],
    rate: `no timer: 0 deg, sleep ${SERVO.hold_s} s, 100 deg, sleep ${SERVO.hold_s} s, disable, rclpy.shutdown()`,
    params: [
      ["driver", `PCA9685 over I2C, channel ${SERVO.channel}`],
      ["frequency", `${SERVO.frequency} Hz`],
      ["pulse range", `${SERVO.min_us} to ${SERVO.max_us} us`],
      ["0 deg", `${d0.pulseUs.toFixed(0)} us, duty ${d0.duty}`],
      ["100 deg", `${d100.pulseUs.toFixed(0)} us, duty ${d100.duty}`],
      ["stdout / stderr", "subprocess.DEVNULL"],
    ],
    excerpt: {
      file: "servo_sweeper.py",
      lines: "36-43",
      code: `def move_servo(self):
    # Move to 0°
    self.set_servo_angle(0)
    time.sleep(1)

    # Move to 100°
    self.set_servo_angle(100)
    time.sleep(1)`,
    },
    note: "No topics: it drives the scoop arm directly over I2C, and its output goes to DEVNULL, so none of its log lines reach the launch terminal.",
  },
  vesc: {
    id: "vesc",
    name: "vesc_twist_node",
    file: "course package (not in the team repo)",
    origin: "The course's actuator node. It maps each /cmd_vel through the VESC calibration in racer_calibration2.yaml into a steering servo position and a motor command.",
    pubs: [],
    subs: [{ topic: "/cmd_vel", type: "geometry_msgs/Twist", note: "angular.z in [-1, 1] is steering, linear.x is throttle" }],
    rate: "event driven: one actuator update per /cmd_vel",
    params: [
      ["max_potential_rpm", String(VESC_PARAMS.max_potential_rpm)],
      ["steering left / straight / right", `${VESC_PARAMS.max_left_steering} / ${VESC_PARAMS.straight_steering} / ${VESC_PARAMS.max_right_steering}`],
      ["zero / min / max throttle", `${VESC_PARAMS.zero_throttle} / ${VESC_PARAMS.min_throttle} / ${VESC_PARAMS.max_throttle}`],
      ["polarity", `steering ${VESC_PARAMS.steering_polarity}, throttle ${VESC_PARAMS.throttle_polarity}`],
    ],
    excerpt: {
      file: "racer_calibration2.yaml",
      lines: "80-90",
      code: `vesc_twist_node:
  ros__parameters:
    max_potential_rpm : 20000
    steering_polarity : 1
    throttle_polarity : 1
    zero_throttle : -0.03200000000000003
    max_throttle : 0.382
    min_throttle : 0.363
    max_right_steering : 0.792
    straight_steering : -0.21999999999999997`,
    },
    note: "The node's code belongs to the course, so the card quotes the team's calibration for it instead.",
  },
};

export const TOPIC_TYPE: Record<TopicName, string> = {
  "/object_detections/image": "sensor_msgs/Image",
  "/object_detections/centroid": "std_msgs/Float32",
  "/object_detections/depth": "std_msgs/Float32",
  "/object_detections/flag": "std_msgs/Bool",
  "/centroid": "std_msgs/Float32",
  "/cmd_vel": "geometry_msgs/Twist",
};

export const TOPIC_PUB: Record<TopicName, NodeId> = {
  "/object_detections/image": "det",
  "/object_detections/centroid": "det",
  "/object_detections/depth": "det",
  "/object_detections/flag": "det",
  "/centroid": "lane",
  "/cmd_vel": "guid",
};

// ------------------------------------------------------------------ layouts

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Pt = [number, number];

export interface EdgeDef {
  id: string;
  kind: "pub" | "sub" | "spawn";
  topic: TopicName | "spawn";
  node: NodeId;
  /** start, control 1, control 2, end */
  c: [Pt, Pt, Pt, Pt];
  /** label position + anchor */
  label?: { at: Pt; text: string; anchor?: "start" | "middle" | "end" };
}

export interface Layout {
  name: "wide" | "tall";
  vw: number;
  vh: number;
  font: number;
  nodes: Record<NodeId, Box>;
  topics: Record<TopicName, Box>;
  edges: EdgeDef[];
  /** show the msg type under the pill (true) or skip it */
  typeBelow: boolean;
}

/** a cubic from a to b leaving along da and arriving along db (unit-ish directions) */
function curve(a: Pt, da: Pt, b: Pt, db: Pt, k?: number): [Pt, Pt, Pt, Pt] {
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const kk = k ?? Math.max(18, dist * 0.42);
  return [a, [a[0] + da[0] * kk, a[1] + da[1] * kk], [b[0] - db[0] * kk, b[1] - db[1] * kk], b];
}

const R: Pt = [1, 0];
const D: Pt = [0, 1];

function mid(b: Box, side: "l" | "r" | "t" | "b", f = 0.5): Pt {
  if (side === "l") return [b.x, b.y + b.h * f];
  if (side === "r") return [b.x + b.w, b.y + b.h * f];
  if (side === "t") return [b.x + b.w * f, b.y];
  return [b.x + b.w * f, b.y + b.h];
}

function wide(): Layout {
  const nodes: Record<NodeId, Box> = {
    det: { x: 12, y: 160, w: 196, h: 104 },
    lane: { x: 480, y: 16, w: 188, h: 80 },
    guid: { x: 780, y: 172, w: 206, h: 104 },
    servo: { x: 500, y: 382, w: 190, h: 76 },
    vesc: { x: 790, y: 382, w: 196, h: 76 },
  };
  const P = 28;
  const topics: Record<TopicName, Box> = {
    "/object_detections/image": { x: 246, y: 43, w: 206, h: P },
    "/object_detections/centroid": { x: 246, y: 146, w: 206, h: P },
    "/object_detections/depth": { x: 246, y: 242, w: 206, h: P },
    "/object_detections/flag": { x: 246, y: 338, w: 206, h: P },
    "/centroid": { x: 696, y: 42, w: 96, h: P },
    "/cmd_vel": { x: 836, y: 318, w: 96, h: P },
  };
  const n = nodes;
  const t = topics;
  const edges: EdgeDef[] = [
    { id: "det-img", kind: "pub", topic: "/object_detections/image", node: "det", c: curve(mid(n.det, "r", 0.2), R, mid(t["/object_detections/image"], "l"), R) },
    { id: "det-oc", kind: "pub", topic: "/object_detections/centroid", node: "det", c: curve(mid(n.det, "r", 0.4), R, mid(t["/object_detections/centroid"], "l"), R) },
    { id: "det-dep", kind: "pub", topic: "/object_detections/depth", node: "det", c: curve(mid(n.det, "r", 0.6), R, mid(t["/object_detections/depth"], "l"), R) },
    { id: "det-flag", kind: "pub", topic: "/object_detections/flag", node: "det", c: curve(mid(n.det, "r", 0.8), R, mid(t["/object_detections/flag"], "l"), R) },
    {
      id: "img-lane",
      kind: "sub",
      topic: "/object_detections/image",
      node: "lane",
      c: curve(mid(t["/object_detections/image"], "r"), R, mid(n.lane, "l", 0.55), R),
    },
    { id: "lane-cen", kind: "pub", topic: "/centroid", node: "lane", c: curve(mid(n.lane, "r", 0.55), R, mid(t["/centroid"], "l"), R) },
    {
      id: "cen-guid",
      kind: "sub",
      topic: "/centroid",
      node: "guid",
      c: curve(mid(t["/centroid"], "r"), R, mid(n.guid, "t", 0.72), D, 70),
      label: { at: [920, 118], text: "controller", anchor: "middle" },
    },
    {
      id: "oc-guid",
      kind: "sub",
      topic: "/object_detections/centroid",
      node: "guid",
      c: curve(mid(t["/object_detections/centroid"], "r"), R, mid(n.guid, "l", 0.3), R, 150),
      label: { at: [615, 176], text: "controller", anchor: "middle" },
    },
    {
      id: "dep-guid",
      kind: "sub",
      topic: "/object_detections/depth",
      node: "guid",
      c: curve(mid(t["/object_detections/depth"], "r"), R, mid(n.guid, "l", 0.72), R, 150),
      label: { at: [615, 262], text: "width_callback", anchor: "middle" },
    },
    { id: "guid-cmd", kind: "pub", topic: "/cmd_vel", node: "guid", c: curve(mid(n.guid, "b", 0.54), D, mid(t["/cmd_vel"], "t"), D, 16) },
    { id: "cmd-vesc", kind: "sub", topic: "/cmd_vel", node: "vesc", c: curve(mid(t["/cmd_vel"], "b"), D, mid(n.vesc, "t", 0.54), D, 14) },
    {
      id: "spawn",
      kind: "spawn",
      topic: "spawn",
      node: "servo",
      c: curve(mid(n.guid, "b", 0.12), D, mid(n.servo, "t", 0.6), D, 60),
      label: { at: [712, 350], text: "subprocess.Popen", anchor: "middle" },
    },
  ];
  return {
    name: "wide",
    vw: 1000,
    vh: 470,
    font: 12,
    nodes,
    topics,
    edges,
    typeBelow: true,
  };
}

function tall(): Layout {
  const nodes: Record<NodeId, Box> = {
    det: { x: 8, y: 22, w: 214, h: 64 },
    lane: { x: 218, y: 104, w: 134, h: 70 },
    guid: { x: 96, y: 404, w: 218, h: 88 },
    servo: { x: 8, y: 594, w: 150, h: 68 },
    vesc: { x: 196, y: 594, w: 156, h: 68 },
  };
  const P = 26;
  const X = 26;
  const W = 182;
  const topics: Record<TopicName, Box> = {
    "/object_detections/image": { x: X, y: 126, w: W, h: P },
    "/object_detections/flag": { x: X, y: 192, w: W, h: P },
    "/object_detections/centroid": { x: X, y: 258, w: W, h: P },
    "/object_detections/depth": { x: X, y: 324, w: W, h: P },
    "/centroid": { x: 238, y: 222, w: 94, h: P },
    "/cmd_vel": { x: 190, y: 522, w: 94, h: P },
  };
  const n = nodes;
  const t = topics;
  // the detector's outputs drop down a bus on the left edge
  const bus = (topic: TopicName, id: string, x: number): EdgeDef => {
    const b = t[topic];
    const y = b.y + b.h / 2;
    const a: Pt = [x, n.det.y + n.det.h];
    return { id, kind: "pub", topic, node: "det", c: [a, [x, y - 4], [x + 2, y], [b.x, y]] };
  };
  const edges: EdgeDef[] = [
    bus("/object_detections/image", "det-img", 20),
    bus("/object_detections/flag", "det-flag", 17),
    bus("/object_detections/centroid", "det-oc", 14),
    bus("/object_detections/depth", "det-dep", 11),
    { id: "img-lane", kind: "sub", topic: "/object_detections/image", node: "lane", c: curve(mid(t["/object_detections/image"], "r"), R, mid(n.lane, "l", 0.5), R, 6) },
    { id: "lane-cen", kind: "pub", topic: "/centroid", node: "lane", c: curve(mid(n.lane, "b", 0.5), D, mid(t["/centroid"], "t", 0.5), D, 14) },
    {
      id: "cen-guid",
      kind: "sub",
      topic: "/centroid",
      node: "guid",
      c: curve(mid(t["/centroid"], "b", 0.5), D, mid(n.guid, "t", 0.84), D, 60),
      label: { at: [300, 300], text: "controller", anchor: "middle" },
    },
    {
      id: "oc-guid",
      kind: "sub",
      topic: "/object_detections/centroid",
      node: "guid",
      c: curve(mid(t["/object_detections/centroid"], "r"), R, mid(n.guid, "t", 0.56), D, 64),
      label: { at: [246, 318], text: "controller", anchor: "middle" },
    },
    {
      id: "dep-guid",
      kind: "sub",
      topic: "/object_detections/depth",
      node: "guid",
      c: curve(mid(t["/object_detections/depth"], "r"), R, mid(n.guid, "t", 0.26), D, 30),
      label: { at: [196, 386], text: "width_callback", anchor: "middle" },
    },
    { id: "guid-cmd", kind: "pub", topic: "/cmd_vel", node: "guid", c: curve(mid(n.guid, "b", 0.62), D, mid(t["/cmd_vel"], "t"), D, 12) },
    { id: "cmd-vesc", kind: "sub", topic: "/cmd_vel", node: "vesc", c: curve(mid(t["/cmd_vel"], "b"), D, mid(n.vesc, "t", 0.5), D, 12) },
    {
      id: "spawn",
      kind: "spawn",
      topic: "spawn",
      node: "servo",
      c: curve(mid(n.guid, "b", 0.14), D, mid(n.servo, "t", 0.5), D, 34),
      label: { at: [26, 556], text: "subprocess.Popen", anchor: "start" },
    },
  ];
  return {
    name: "tall",
    vw: 360,
    vh: 670,
    font: 10.5,
    nodes,
    topics,
    edges,
    typeBelow: true,
  };
}

export const LAYOUTS = { wide: wide(), tall: tall() };

/** point on a cubic at parameter u */
export function bez(c: [Pt, Pt, Pt, Pt], u: number): Pt {
  const v = 1 - u;
  const a = v * v * v,
    b = 3 * v * v * u,
    cc = 3 * v * u * u,
    d = u * u * u;
  return [a * c[0][0] + b * c[1][0] + cc * c[2][0] + d * c[3][0], a * c[0][1] + b * c[1][1] + cc * c[2][1] + d * c[3][1]];
}

export function pathD(c: [Pt, Pt, Pt, Pt]): string {
  const f = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return `M ${f(c[0])} C ${f(c[1])}, ${f(c[2])}, ${f(c[3])}`;
}

/** approximate arc length of a cubic */
export function bezLen(c: [Pt, Pt, Pt, Pt]): number {
  let L = 0;
  let p = c[0];
  for (let i = 1; i <= 24; i++) {
    const q = bez(c, i / 24);
    L += Math.hypot(q[0] - p[0], q[1] - p[1]);
    p = q;
  }
  return L;
}
