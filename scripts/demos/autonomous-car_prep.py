"""Autonomous Car demo prep (UCSD ECE/MAE 148, spring 2025, Team 3).

Run via  pnpm sync-demos autonomous-car  (scripts/demos/autonomous-car.ts renders the
fixture frames with the page's virtual camera, then spawns this with py -3.12).

    py -3.12 scripts/demos/autonomous-car_prep.py <rawDir> <outDir> <repoRoot> <frameCache>

Inputs (never modified): demos/autonomous_car_raw/ (the team repo @ 68c50d4, keys redacted)
Outputs (committed):
  public/demos/autonomous-car/          photos, clips (animated WebP), posters
  tests/fixtures/autonomous-car-*.json  fixtures the TS ports are tested against

How the fixtures are made
-------------------------
David's ORIGINAL node files are imported as-is from Code/ with the ROS and hardware
modules they need replaced by small stand-ins registered in sys.modules:
rclpy / rclpy.node (a Node that records publishers, parameters, timers, logs),
sensor_msgs / std_msgs / geometry_msgs messages, cv_bridge (passes numpy arrays
through), roboflowoak (returns scripted predictions), board / busio /
adafruit_pca9685 (records duty cycles). time / subprocess inside the guidance node
are swapped for a fake clock and a fake process so the scripted message stream is
deterministic. cv2.imshow/waitKey are no-ops (no display), and np.int0 (removed in
NumPy 2, used only to draw the debug box) is aliased to np.intp.

* lane: lane_detection_node.LaneDetection.locate_centroid on every fixture frame x
  parameter variant -> the value it publishes on /centroid, plus the same OpenCV calls
  step by step for stage checksums, contours and minAreaRect sizes.
* detect: camera_driver2.ObjDetectionNode.run_model on scripted RoboflowOak
  predictions -> /object_detections/{centroid,depth,flag}.
* guidance: lane_guidance_node3.PathPlanner fed a 45 s scripted stream (centroid +
  width at 10 Hz, sweep_timer at 10 Hz) -> every /cmd_vel Twist and log line. The
  executor model during the blocking time.sleep matches control.ts (missed timer
  periods coalesce and run first; queued messages keep QoS depth 10, in order).
* servo: servo_sweeper.ServoSweeper duty cycles.
* cv: cv2 4.x reference outputs for the individual ops on random images.

ASCII-only prints (cp1252 console).
"""
import base64
import importlib.util
import json
import math
import sys
import types
import zlib
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("demos/autonomous_car_raw")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/demos/autonomous-car")
REPO = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(".")
CACHE = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(".cache/autonomous-car-fixture")
CODE = RAW / "Code"
FIXTURES = REPO / "tests" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)
FIXTURES.mkdir(parents=True, exist_ok=True)


def log(msg):
    print(f"[autonomous-car_prep] {msg}")


def save_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    log(f"wrote {path.relative_to(REPO) if path.is_relative_to(REPO) else path} ({path.stat().st_size // 1024} KB)")


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.uint8).tobytes()).decode("ascii")


def crc(a):
    return zlib.crc32(np.ascontiguousarray(a, dtype=np.uint8).tobytes()) & 0xFFFFFFFF


# ---------------------------------------------------------------- ROS / hardware stand-ins

class Clock:
    t = 0.0


CLOCK = Clock()
PARAM_OVERRIDES = {}
TOPICS = {}
PUBLISHED = []  # (topic, value, clock)
LOGS = []  # (level, msg, clock)


class _Logger:
    def info(self, m):
        LOGS.append(("INFO", str(m), CLOCK.t))

    def warn(self, m):
        LOGS.append(("WARN", str(m), CLOCK.t))

    warning = warn

    def error(self, m):
        LOGS.append(("ERROR", str(m), CLOCK.t))


class _Param:
    def __init__(self, v):
        self.value = v


class _Pub:
    def __init__(self, topic):
        self.topic = topic

    def publish(self, msg):
        if hasattr(msg, "linear"):
            v = [float(msg.linear.x), float(msg.angular.z)]
        elif hasattr(msg, "data"):
            v = msg.data if isinstance(msg.data, (bool, int, float)) else "img"
        else:
            v = "msg"
        PUBLISHED.append((self.topic, v, CLOCK.t))


class _Sub:
    def __init__(self, topic, cb):
        self.topic, self.cb = topic, cb


class Node:
    def __init__(self, name):
        self._name = name
        self._params = {}
        self._subs = []
        self._timers = []
        self._logger = _Logger()

    def create_publisher(self, typ, topic, qos):
        return _Pub(topic)

    def create_subscription(self, typ, topic, cb, qos):
        s = _Sub(topic, cb)
        self._subs.append(s)
        return s

    def destroy_subscription(self, s):
        if s in self._subs:
            self._subs.remove(s)

    def create_timer(self, period, cb):
        self._timers.append((period, cb))
        return cb

    def declare_parameters(self, namespace, parameters):
        for name, default in parameters:
            self._params[name] = PARAM_OVERRIDES.get(name, default)

    def get_parameter(self, name):
        return _Param(self._params[name])

    def get_logger(self):
        return self._logger

    def get_topic_names_and_types(self):
        return list(TOPICS.items())

    def get_clock(self):
        class _C:
            def now(self):
                class _T:
                    def to_msg(self):
                        return None
                return _T()
        return _C()

    def destroy_node(self):
        pass


SPIN_ONCE_HOOK = [None]


def _spin_once(node, timeout_sec=0.1):
    CLOCK.t += timeout_sec
    if SPIN_ONCE_HOOK[0]:
        SPIN_ONCE_HOOK[0](node)


def _mod(name, **attrs):
    m = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules[name] = m
    return m


class _Msg:
    def __init__(self, data=None):
        self.data = data


class _Vec:
    def __init__(self):
        self.x = 0.0
        self.y = 0.0
        self.z = 0.0


class Twist:
    def __init__(self):
        self.linear = _Vec()
        self.angular = _Vec()


class _Header:
    def __init__(self):
        self.stamp = None
        self.frame_id = ""


class Image_:
    def __init__(self, arr=None):
        self.data = arr
        self.header = _Header()


class CvBridge:
    def imgmsg_to_cv2(self, msg, desired_encoding=None):
        return msg.data

    def cv2_to_imgmsg(self, arr, encoding=None):
        return Image_(arr)


class RoboflowOak:
    SCRIPT = []

    def __init__(self, **kw):
        self.kw = kw

    def detect(self):
        preds = RoboflowOak.SCRIPT.pop(0)
        frame = np.zeros((480, 640, 3), np.uint8)
        return {"predictions": preds}, frame, frame, None


class Pred:
    def __init__(self, x, y, width, height, confidence):
        self.x, self.y, self.width, self.height, self.confidence = x, y, width, height, confidence


class _Chan:
    def __init__(self):
        self._d = 0
        self.log = []

    @property
    def duty_cycle(self):
        return self._d

    @duty_cycle.setter
    def duty_cycle(self, v):
        self._d = v
        self.log.append(int(v))


class PCA9685:
    def __init__(self, i2c):
        self.frequency = 0
        self.channels = [_Chan() for _ in range(16)]


_mod("rclpy", init=lambda args=None: None, spin=lambda n: None, shutdown=lambda: None, spin_once=_spin_once)
_mod("rclpy.node", Node=Node)
sys.modules["rclpy"].node = sys.modules["rclpy.node"]
_mod("sensor_msgs")
_mod("sensor_msgs.msg", Image=Image_)
_mod("std_msgs")
_mod("std_msgs.msg", Float32=_Msg, Int32=_Msg, Int32MultiArray=_Msg, Bool=_Msg)
_mod("geometry_msgs")
_mod("geometry_msgs.msg", Twist=Twist, PointStamped=_Msg)
_mod("cv_bridge", CvBridge=CvBridge)
_mod("roboflowoak", RoboflowOak=RoboflowOak)
_mod("board", SCL=0, SDA=1)
_mod("busio", I2C=lambda scl, sda: None)
_mod("adafruit_pca9685", PCA9685=PCA9685)

np.int0 = np.intp  # removed in NumPy 2; only used to draw the debug box
cv2.imshow = lambda *a, **k: None
cv2.waitKey = lambda *a, **k: -1
cv2.destroyAllWindows = lambda *a, **k: None


def load(name):
    spec = importlib.util.spec_from_file_location(f"orig_{name}", CODE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def yaml_section(section):
    """Tiny reader for racer_calibration2.yaml (flat key : value under ros__parameters)."""
    out, cur = {}, None
    for line in (CODE / "racer_calibration2.yaml").read_text(encoding="utf-8").splitlines():
        if line and not line.startswith(" "):
            cur = line.strip().rstrip(":")
            continue
        s = line.split("#")[0].strip()
        if cur == section and ":" in s and not s.startswith("ros__parameters"):
            k, v = [p.strip() for p in s.split(":", 1)]
            out[k] = float(v) if any(c in v for c in ".e") else int(v)
    return out


# ---------------------------------------------------------------- lane fixture

LANE_VARIANTS = {
    "yaml": {},
    "inverted": {"inverted_filter": 1},
    "kernel5": {"kernal_size": 5, "erosion_itterations": 2, "dilation_itterations": 2},
    "lowV": {"Value_low": 100},
    "narrow": {"Width_min": 30, "Width_max": 60},
    "oneLine": {"number_of_lines": 1},
    "centered": {"camera_centerline": 0.5, "error_threshold": 0.05},
    "noMorph": {"erosion_itterations": 0, "dilation_itterations": 0, "gray_lower": 20},
}


def lane_reference(frame, p):
    """The same cv2 calls as locate_centroid, kept step by step for the stage checksums."""
    h, w = frame.shape[:2]
    rows_to_watch = int(h * p["rows_to_watch_decimal"])
    rows_offset = int(h * (1 - p["rows_offset_decimal"]))
    y0 = int(h - rows_offset)
    y1 = int(y0 + rows_to_watch)
    x0 = int((w / 2) * (1 - p["crop_width_decimal"]))
    x1 = int((w / 2) * (1 + p["crop_width_decimal"]))
    img = frame[y0:y1, x0:x1]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([p["Hue_low"], p["Saturation_low"], p["Value_low"]]),
                       np.array([p["Hue_high"], p["Saturation_high"], p["Value_high"]]))
    if p["inverted_filter"] == 1:
        masked = cv2.bitwise_and(hsv, hsv, mask=cv2.bitwise_not(mask))
    else:
        masked = cv2.bitwise_and(hsv, hsv, mask=mask)
    gray = cv2.cvtColor(masked, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, p["gray_lower"], 255, cv2.THRESH_BINARY)
    k = p["kernal_size"]
    kernel = np.ones((k, k), np.uint8)
    blurred = cv2.blur(bw, (k, k))
    eroded = cv2.erode(blurred, kernel, iterations=p["erosion_itterations"])
    dilated = cv2.dilate(eroded, kernel, iterations=p["dilation_itterations"])
    _, final = cv2.threshold(dilated, p["gray_lower"], 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(final, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cs = []
    for c in contours[: p["number_of_lines"]]:
        (cx_, cy_), (rw, rh), ang = cv2.minAreaRect(c)
        entry = {"n": len(c), "w": float(rw), "h": float(rh), "pass": bool(p["Width_min"] < rw < p["Width_max"])}
        if entry["pass"]:
            m = cv2.moments(c)
            if m["m00"] != 0:
                entry["cx"] = int(m["m10"] / m["m00"])
                entry["cy"] = int(m["m01"] / m["m00"])
        cs.append(entry)
    stages = {name: crc(a) for name, a in
              [("hsv", hsv), ("mask", mask), ("masked", masked), ("gray", gray), ("bw", bw), ("blurred", blurred),
               ("eroded", eroded), ("dilated", dilated), ("final", final)]}
    return (x0, y0, x1, y1), img, stages, cs


def prep_lane():
    mod = load("lane_detection_node")
    base = yaml_section("lane_detection_node")
    frames = json.loads((CACHE / "frames.json").read_text())
    cases = []
    crops = {}
    for fr in frames:
        frame = np.frombuffer((CACHE / fr["file"]).read_bytes(), np.uint8).reshape(fr["h"], fr["w"], 3).copy()
        for vname, var in LANE_VARIANTS.items():
            p = dict(base)
            p.update(var)
            PARAM_OVERRIDES.clear()
            PARAM_OVERRIDES.update(p)
            PARAM_OVERRIDES["debug_cv"] = 0
            PUBLISHED.clear()
            node = mod.LaneDetection()
            node.locate_centroid(Image_(frame.copy()))
            pub = [v for (t, v, _) in PUBLISHED if t == "/centroid"]
            box, crop, stages, cs = lane_reference(frame, p)
            if fr["name"] not in crops:
                crops[fr["name"]] = {"box": list(box), "w": fr["w"], "h": fr["h"], "bgr": b64(crop)}
            cases.append({"frame": fr["name"], "variant": vname, "params": p,
                          "published": pub[0] if pub else None, "stages": stages, "contours": cs})
    kinds = {}
    for c in cases:
        k = "none" if c["published"] is None else "published"
        kinds[k] = kinds.get(k, 0) + 1
    log(f"lane: {len(cases)} cases over {len(frames)} frames x {len(LANE_VARIANTS)} variants {kinds}")
    save_json(FIXTURES / "autonomous-car-lane.json", {"frames": crops, "cases": cases})


# ---------------------------------------------------------------- detector fixture

def prep_detect():
    mod = load("camera_driver2")
    rng = np.random.default_rng(148)
    cases = []
    for method in ["closest", "average", "minimum_error"]:
        PARAM_OVERRIDES.clear()
        PARAM_OVERRIDES["target_selection_method"] = method
        LOGS.clear()
        script = []
        for i in range(40):
            n = int(rng.integers(0, 5))
            preds = []
            for _ in range(n):
                preds.append(Pred(float(rng.uniform(0, 640)), float(rng.uniform(0, 480)), float(rng.uniform(8, 320)),
                                  float(rng.uniform(8, 240)), float(rng.uniform(0.6, 1))))
            script.append(preds)
        RoboflowOak.SCRIPT = [list(p) for p in script]
        node = mod.ObjDetectionNode()
        for preds in script:
            PUBLISHED.clear()
            node.run_model()
            out = {t: v for (t, v, _) in PUBLISHED if t != "/object_detections/image"}
            cases.append({"method": method,
                          "preds": [[p.x, p.y, p.width, p.height, p.confidence] for p in preds],
                          "flag": out.get("/object_detections/flag"),
                          "centroid": out.get("/object_detections/centroid"),
                          "width": out.get("/object_detections/depth")})
        errs = [m for (lvl, m, _) in LOGS if lvl == "ERROR"]
        if errs:
            raise SystemExit(f"camera_driver2 raised inside run_model: {errs[:3]}")
    log(f"detect: {len(cases)} run_model() calls over 3 selection methods")
    save_json(FIXTURES / "autonomous-car-detect.json", {"imageWidth": 640, "cases": cases})


# ---------------------------------------------------------------- guidance fixture

class FakeTime:
    @staticmethod
    def time():
        return CLOCK.t

    @staticmethod
    def sleep(s):
        CLOCK.t += s


class FakePopen:
    n = 0

    def __init__(self, *a, **k):
        FakePopen.n += 1
        self.pid = 1000 + FakePopen.n

    def terminate(self):
        pass

    def wait(self, timeout=None):
        return 0

    def kill(self):
        pass


def guidance_events():
    rng = np.random.default_rng(3)
    ev = []
    e = 0.0
    t = 0.0
    while t < 45.0:
        e = float(np.clip(0.85 * e + rng.normal(0, 0.18), -1.2, 1.2))
        ev.append((round(t, 3), "centroid", e))
        # widths: far objects, a close one at ~4 s and another at ~30 s, some invalid values
        if 3.5 < t < 5.2:
            w = 150 + (t - 3.5) * 60
        elif 29.0 < t < 31.0:
            w = 120 + (t - 29.0) * 70
        else:
            w = float(rng.uniform(20, 120))
        if rng.random() < 0.05:
            w = [0.0, -3.0, float("nan"), float("inf")][int(rng.integers(0, 4))]
        ev.append((round(t + 0.002, 3), "width", w))
        ev.append((round(t + 0.05, 3), "tick", None))
        t += 0.1
    return ev


def run_guidance(mod, events, params):
    PARAM_OVERRIDES.clear()
    PARAM_OVERRIDES.update(params)
    CLOCK.t = 0.0
    TOPICS.clear()  # /object_detections/centroid not advertised -> /centroid
    PUBLISHED.clear()
    LOGS.clear()
    mod.time = FakeTime
    mod.subprocess = types.SimpleNamespace(Popen=FakePopen, DEVNULL=None, TimeoutExpired=Exception)
    node = mod.PathPlanner()
    PUBLISHED.clear()
    LOGS.clear()
    cb_centroid = next(s.cb for s in node._subs if s.topic in ("/centroid", "/object_detections/centroid"))
    cb_width = next(s.cb for s in node._subs if s.topic == "/object_detections/depth")
    cb_tick = node._timers[0][1]
    pending_tick = False
    queue = []

    def deliver(kind, v):
        if kind == "centroid":
            cb_centroid(_Msg(v))
        elif kind == "width":
            cb_width(_Msg(v))
        else:
            cb_tick()

    for (t, kind, v) in events:
        if t < CLOCK.t:
            # the node was sleeping inside a callback: model the executor backlog
            if kind == "tick":
                pending_tick = True
            else:
                queue.append((kind, v))
                same = [m for m in queue if m[0] == kind]
                if len(same) > 10:
                    queue.remove(same[0])
            continue
        if pending_tick or queue:
            CLOCK.t = t
            if pending_tick:
                pending_tick = False
                deliver("tick", None)
            q, queue = queue, []
            for (k2, v2) in q:
                deliver(k2, v2)
        CLOCK.t = t
        deliver(kind, v)
    pubs = [[round(tm, 6), v[0], v[1]] for (topic, v, tm) in PUBLISHED if topic == "/cmd_vel"]
    logs = [[lvl, m] for (lvl, m, _) in LOGS]
    return pubs, logs


def prep_guidance():
    mod = load("lane_guidance_node3")
    params = yaml_section("lane_guidance_node")
    params.pop("depth_threshold", None)
    params.pop("roi_width_ratio", None)
    params.pop("roi_height_ratio", None)
    events = guidance_events()
    runs = {}
    for name, over in {"yaml": {}, "pid": {"Kp_steering": 0.6, "Ki_steering": 0.4, "Kd_steering": 0.05}}.items():
        p = dict(params)
        p.update(over)
        pubs, logs = run_guidance(mod, events, p)
        runs[name] = {"params": p, "cmd_vel": pubs, "logs": logs}
        log(f"guidance[{name}]: {len(pubs)} /cmd_vel messages, {len(logs)} log lines")
    # the startup probe, three ways
    probes = {}
    for case in ["absent", "silent", "live"]:
        CLOCK.t = 0.0
        TOPICS.clear()
        LOGS.clear()
        SPIN_ONCE_HOOK[0] = None
        if case != "absent":
            TOPICS["/object_detections/centroid"] = ["std_msgs/msg/Float32"]
        if case == "live":
            def hook(node):
                for s in list(node._subs):
                    if s.topic == "/object_detections/centroid" and s.cb.__name__ == "_test_callback":
                        s.cb(_Msg(0.1))
            SPIN_ONCE_HOOK[0] = hook
        node = mod.PathPlanner()
        keep = ("Checking", "Topic ", "Data detected", "No data detected")
        probes[case] = {"topic": node.topic_to_use, "logs": [m for (_, m, _) in LOGS if m.startswith(keep)]}
    SPIN_ONCE_HOOK[0] = None
    save_json(FIXTURES / "autonomous-car-guidance.json",
              {"events": [[t, k, (None if v is None else (v if math.isfinite(v) else str(v)))] for (t, k, v) in events],
               "runs": runs, "probes": probes})


# ---------------------------------------------------------------- servo fixture

def prep_servo():
    mod = load("servo_sweeper")
    mod.time = FakeTime
    node = mod.ServoSweeper()
    seq = list(node.pca.channels[0].log)
    angles = [0, 10, 45, 90, 100, 135, 180]
    duties = []
    for a in angles:
        node.set_servo_angle(a)
        duties.append(node.pca.channels[0].log[-1])
    log(f"servo: move_servo duty sequence {seq}")
    save_json(FIXTURES / "autonomous-car-servo.json", {"sequence": seq, "angles": angles, "duties": duties})


# ---------------------------------------------------------------- cv fixture

def prep_cv():
    rng = np.random.default_rng(11)
    cases = []
    for t in range(24):
        h, w = int(rng.integers(12, 48)), int(rng.integers(12, 64))
        bw = np.zeros((h, w), np.uint8)
        for _ in range(int(rng.integers(1, 5))):
            kind = rng.integers(0, 3)
            if kind == 0:
                x0, y0 = int(rng.integers(-4, w)), int(rng.integers(-4, h))
                cv2.rectangle(bw, (x0, y0), (x0 + int(rng.integers(1, 20)), y0 + int(rng.integers(1, 20))), 255, -1)
            elif kind == 1:
                cv2.ellipse(bw, (int(rng.uniform(0, w)), int(rng.uniform(0, h))),
                            (int(rng.integers(1, 12)), int(rng.integers(1, 8))), float(rng.uniform(0, 180)), 0, 360, 255, -1)
            else:
                pts = rng.integers(0, [w, h], size=(4, 2)).astype(np.int32)
                cv2.fillConvexPoly(bw, cv2.convexHull(pts), 255)
        if t % 4 == 0:
            bw[rng.random((h, w)) < 0.04] = 255
        img = rng.integers(0, 256, (h, w, 3), dtype=np.uint8)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        k = int(rng.integers(1, 6))
        it = int(rng.integers(0, 5))
        cs, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cont = []
        for c in cs:
            (cx, cy), (rw, rh), ang = cv2.minAreaRect(c)
            m = cv2.moments(c)
            cont.append({"pts": c.reshape(-1, 2).tolist(), "rect": [cx, cy, rw, rh, ang],
                         "m": [m["m00"], m["m10"], m["m01"]]})
        cases.append({"w": w, "h": h, "k": k, "it": it, "img": b64(img), "bw": b64(bw),
                      "hsv": crc(cv2.cvtColor(img, cv2.COLOR_BGR2HSV)), "gray": crc(gray),
                      "blur": crc(cv2.blur(gray, (k, k))) if k > 0 else None,
                      "erode": crc(cv2.erode(gray, np.ones((k, k), np.uint8), iterations=it)),
                      "dilate": crc(cv2.dilate(gray, np.ones((k, k), np.uint8), iterations=it)),
                      "contours": cont})
    log(f"cv: {len(cases)} random images, {sum(len(c['contours']) for c in cases)} contours (cv2 {cv2.__version__})")
    save_json(FIXTURES / "autonomous-car-cv.json", {"opencv": cv2.__version__, "cases": cases})


# ---------------------------------------------------------------- assets

def ship_photo(src, dest, max_side=1400, quality=80):
    im = ImageOps.exif_transpose(Image.open(src))  # phone photos carry their rotation in EXIF
    im = im.convert("RGB")
    s = max_side / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(dest, quality=quality)
    log(f"photo {dest.name} {im.width}x{im.height} ({dest.stat().st_size // 1024} KB)")
    return im.size


def ship_clip(src, dest, poster, scale=0.3, step=2, quality=62):
    cap = cv2.VideoCapture(str(src))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames = []
    i = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i % step == 0:
            # the phone recorded portrait (rotation metadata 90); the decoder hands back landscape
            f = cv2.rotate(f, cv2.ROTATE_90_CLOCKWISE)
            f = cv2.resize(f, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            frames.append(Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)))
        i += 1
    frames[0].save(dest, save_all=True, append_images=frames[1:], duration=round(1000 * step / fps), loop=0, quality=quality)
    frames[len(frames) // 2].save(poster, quality=78)
    log(f"clip {dest.name} {frames[0].width}x{frames[0].height} x{len(frames)} ({dest.stat().st_size // 1024} KB)")
    return frames[0].size, len(frames) * step / fps


def prep_assets():
    pics = RAW / "CoolCarPics"
    d = OUT / "media"
    d.mkdir(parents=True, exist_ok=True)
    meta = {}
    meta["laneDebug"] = ship_photo(pics / "IMG_7008.jpeg", d / "lane-debug.jpg")
    meta["detectDebug"] = ship_photo(pics / "IMG_7035.jpeg", d / "detect-debug.jpg")
    meta["arm"] = ship_clip(pics / "IMG_7028.mp4", d / "arm.webp", d / "arm.jpg")
    meta["topdown"] = ship_clip(pics / "IMG_7039.mp4", d / "topdown.webp", d / "topdown.jpg")
    # poster for the click-to-load YouTube embed (the repo README links this run)
    yt = d / "youtube-fsfP0zoJJ4U.jpg"
    if not yt.exists():
        try:
            import urllib.request
            with urllib.request.urlopen("https://i.ytimg.com/vi/fsfP0zoJJ4U/hqdefault.jpg", timeout=20) as r:
                yt.write_bytes(r.read())
            log(f"poster {yt.name} ({yt.stat().st_size // 1024} KB)")
        except Exception as e:  # offline builds keep the committed copy
            log(f"poster download skipped: {e}")
    save_json(OUT / "media.json", meta)


if __name__ == "__main__":
    prep_cv()
    prep_lane()
    prep_detect()
    prep_guidance()
    prep_servo()
    prep_assets()
