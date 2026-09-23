"use client";

/** What servo_launch.py actually brings up, with the packaging details as archived. */
const ENTRIES = [
  { n: 1, name: "camera_driver", pkg: "final_pkg", exe: "camera_driver.py", on: true },
  { n: 2, name: "lane_detection_node", pkg: "ucsd_robocar_lane_detection2_pkg", exe: "lane_detection_node", on: true },
  { n: 3, name: "lane_guidance_node", pkg: "final_pkg", exe: "lane_guidance_node", on: true },
];

const COMMENTED = ["servo_sweeper_node", "object_detection_node", "motor_control_node (vesc_twist_node)"];

export default function LaunchStrip() {
  return (
    <div className="acRoLaunch">
      <div className="acRoLaunchHead">
        <span className="acChip">servo_launch.py : generate_launch_description()</span>
        <span className="acRoLaunchParam acMono">
          parameters=[config_file] <span className="acRoMutedDark">default final_pkg/config/lane_detection_params.yaml</span>
        </span>
      </div>
      <div className="acRoLaunchRow">
        {ENTRIES.map((e) => (
          <div key={e.n} className="acRoLaunchItem">
            <span className="acRoLaunchN acMono">{e.n}</span>
            <div>
              <div className="acMono acRoLaunchName">{e.name}</div>
              <div className="acMono acRoLaunchPkg">
                {e.pkg} / {e.exe}
              </div>
            </div>
          </div>
        ))}
        <div className="acRoLaunchOff">
          <div className="acRoLabel">commented out</div>
          {COMMENTED.map((c) => (
            <div key={c} className="acMono">
              # {c}
            </div>
          ))}
        </div>
      </div>
      <div className="acNote">
        One launch file starts three processes with one parameter file. It names the detector process{" "}
        <code>camera_driver</code>, which replaces the <code>object_detection_node</code> name set in the code. The lane
        node comes from the course package. The archived setup.py registers the sweeper as{" "}
        <code>servo_sweeper.py</code>, while the guidance node spawns <code>ros2 run final_pkg servo_sweeper</code>, so as
        archived the two names do not match. This page runs the sweep as intended.
      </div>
    </div>
  );
}
