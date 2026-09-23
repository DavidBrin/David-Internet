/**
 * Parameters exactly as tuned in Code/racer_calibration2.yaml (demos/autonomous_car_raw),
 * plus the node defaults that applied because the yaml never set them.
 */

export interface LaneParams {
  Hue_low: number;
  Hue_high: number;
  Saturation_low: number;
  Saturation_high: number;
  Value_low: number;
  Value_high: number;
  number_of_lines: number;
  error_threshold: number;
  Width_min: number;
  Width_max: number;
  gray_lower: number;
  inverted_filter: 0 | 1;
  kernal_size: number;
  erosion_itterations: number;
  dilation_itterations: number;
  crop_width_decimal: number;
  rows_to_watch_decimal: number;
  rows_offset_decimal: number;
  camera_centerline: number;
}

/** lane_detection_node / calibration_node section of racer_calibration2.yaml */
export const LANE_PARAMS: LaneParams = {
  Hue_low: 18,
  Hue_high: 50,
  Saturation_low: 75,
  Saturation_high: 255,
  Value_low: 145,
  Value_high: 255,
  number_of_lines: 100,
  error_threshold: 0.16,
  Width_min: 15,
  Width_max: 112,
  gray_lower: 61,
  inverted_filter: 0,
  kernal_size: 3,
  erosion_itterations: 1,
  dilation_itterations: 4,
  crop_width_decimal: 0.7,
  rows_to_watch_decimal: 0.2,
  rows_offset_decimal: 0.5,
  camera_centerline: 0.55,
};

export interface GuidanceParams {
  Kp_steering: number;
  Ki_steering: number;
  Kd_steering: number;
  error_threshold: number;
  zero_throttle: number;
  max_throttle: number;
  min_throttle: number;
  max_right_steering: number;
  max_left_steering: number;
  /** pixels; declared in lane_guidance_node3.py, not in the yaml, so the default 200 applied */
  width_threshold: number;
  sweep_duration: number;
  resume_delay: number;
  turn_speed: number;
  forward_speed: number;
  reverse_speed: number;
  turn_angle_deg: number;
  forward_distance: number;
  reverse_distance: number;
  final_forward_distance: number;
}

/** lane_guidance_node section of racer_calibration2.yaml (+ width_threshold default) */
export const GUIDANCE_PARAMS: GuidanceParams = {
  Kp_steering: 0.2,
  Ki_steering: 0.0,
  Kd_steering: 0.1,
  error_threshold: 0.15,
  zero_throttle: 0.0,
  max_throttle: 0.2,
  min_throttle: 0.1,
  max_right_steering: 1.0,
  max_left_steering: -1.0,
  width_threshold: 200.0,
  sweep_duration: 5.0,
  resume_delay: 1.2,
  turn_speed: 0.5,
  forward_speed: 0.15,
  reverse_speed: -0.15,
  turn_angle_deg: 80.0,
  forward_distance: 0.4,
  reverse_distance: 0.4,
  final_forward_distance: 0.34,
};

/** object_detection_node (camera_driver2.py) declared defaults; the yaml has no section for it */
export const DETECT_PARAMS = {
  camera_centerline: 0.5,
  error_threshold: 0.15,
  target_selection_method: "closest" as "closest" | "average" | "minimum_error",
  width_threshold: 200.0,
  min_width_for_detection: 0.0,
  confidence: 0.6,
  overlap: 0.01,
  model: "garbage-dxrv3",
  version: "3",
};

/** vesc_twist_node section: the actuator calibration the /cmd_vel values end up in */
export const VESC_PARAMS = {
  max_potential_rpm: 20000,
  steering_polarity: 1,
  throttle_polarity: 1,
  zero_throttle: -0.032,
  max_throttle: 0.382,
  min_throttle: 0.363,
  max_right_steering: 0.792,
  straight_steering: -0.22,
  max_left_steering: -0.831,
};

/** servo_sweeper.py constants (PCA9685 over I2C) */
export const SERVO = {
  frequency: 50,
  channel: 0,
  min_us: 500,
  max_us: 2500,
  sequence: [0, 100] as const,
  hold_s: 1,
};

/** PCA9685 16-bit duty for an angle, exactly servo_sweeper.set_servo_angle. */
export function servoDuty(angleDeg: number): { pulseUs: number; duty: number } {
  const pulse = SERVO.min_us + (angleDeg / 180.0) * (SERVO.max_us - SERVO.min_us);
  const period = 1000000 / SERVO.frequency;
  return { pulseUs: pulse, duty: Math.trunc((pulse / period) * 0xffff) };
}
