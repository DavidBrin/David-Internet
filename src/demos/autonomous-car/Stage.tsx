"use client";

/**
 * Autonomous Car demo stage: five sections, vision → graph → control → mission → car.
 *
 * Panel contracts (each panel is self-contained: builds its own World / CarSim from
 * ./core after mount, owns its CSS file with its class prefix, takes no props):
 *   vision/VisionPanel   : #vision   prefix acVi  (lane pipeline stages + sliders + detector overlay)
 *   ros/RosPanel         : #ros      prefix acRo  (live node/topic graph, topic echo, startup probe)
 *   drive/DrivePanel     : #drive    prefix acDr  (closed-loop sim, PID sliders, strip charts)
 *   mission/MissionPanel : #mission  prefix acMi  (garbage run state machine, servo, maneuver)
 *   car/CarPanel         : #car      prefix acCa  (photos, clips, video, credits)
 * Shared classes (autonomous-car.css): acSection acPanel acIntro acChip acBtn acNote acRow
 * acSliderLabel acMono acScreen acLoading. Shared hooks: ui/useFitCanvas (useFitCanvas,
 * useRaf, useNearViewport). NEVER scroll the page from an animation.
 */
import "./autonomous-car.css";
import VisionPanel from "./vision/VisionPanel";
import RosPanel from "./ros/RosPanel";
import DrivePanel from "./drive/DrivePanel";
import MissionPanel from "./mission/MissionPanel";
import CarPanel from "./car/CarPanel";

export default function Stage() {
  return (
    <div className="acStage">
      <section id="vision" className="acSection">
        <h2 className="acH2">
          <span className="acNum">1</span> Lane vision, stage by stage
        </h2>
        <p className="acIntro">
          What lane_detection_node sees: a band of the camera frame goes through an HSV color mask, a
          blur, erosion and dilation, then contour finding. Only blobs of the right width count, and
          their centroids become one steering error. Every value starts at the team&apos;s
          racer_calibration2.yaml; drag the car or the sliders and each stage updates live.
        </p>
        <VisionPanel />
      </section>

      <section id="ros" className="acSection">
        <h2 className="acH2">
          <span className="acNum">2</span> The ROS 2 graph
        </h2>
        <p className="acIntro">
          Four standing nodes, a fifth spawned only for the sweep, and six topics on one car. Messages
          move at their real rates, and the echo pane
          shows what each topic is carrying right now. At startup the guidance node listens for three
          seconds and picks lane-following or garbage-seeking for the whole run.
        </p>
        <RosPanel />
      </section>

      <section id="drive" className="acSection">
        <h2 className="acH2">
          <span className="acNum">3</span> Closed loop: PID and throttle scheduling
        </h2>
        <p className="acIntro">
          The lane node and the guidance node drive a simulated car around the taped lot. Steering comes
          from the PID controller, and throttle falls from 0.2 to 0.1 as the error grows. Change the gains
          and watch the error, steering and throttle traces.
        </p>
        <DrivePanel />
      </section>

      <section id="mission" className="acSection">
        <h2 className="acH2">
          <span className="acNum">4</span> The garbage run
        </h2>
        <p className="acIntro">
          Garbage mode: steer toward the detection, stop when its box is wider than 200 px, swing the
          scoop arm over I2C, then run the five timed steps and resume. The state machine, the servo&apos;s
          PCA9685 duty cycles and every /cmd_vel command are shown as they happen.
        </p>
        <MissionPanel />
      </section>

      <section id="car" className="acSection">
        <h2 className="acH2">
          <span className="acNum">5</span> The car
        </h2>
        <p className="acIntro">
          The real thing, from the team&apos;s repository: the live debug screens, the scoop arm, and the car
          following tape. Built by the rest of Team 3; software by David.
        </p>
        <CarPanel />
      </section>
    </div>
  );
}
