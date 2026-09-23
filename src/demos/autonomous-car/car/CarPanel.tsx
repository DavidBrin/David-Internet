"use client";

/**
 * #car panel (prefix acCa): the real car, from the team repository's CoolCarPics folder
 * (photos of the live debug screens, two short clips as animated WebP) and the
 * lane-following run the repo README links (YouTube, click to load).
 */
import { useState } from "react";
import "./car.css";

const M = "/demos/autonomous-car/media";
const VIDEO_ID = "fsfP0zoJJ4U";

function Clip({ src, poster, alt, caption }: { src: string; poster: string; alt: string; caption: string }) {
  const [playing, setPlaying] = useState(true);
  return (
    <figure className="acCaFig acCaClip">
      <button type="button" className="acCaClipBtn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause clip" : "Play clip"}>
        {/* the animated WebP plays itself; the poster frame stands in when paused */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={playing ? src : poster} alt={alt} width={216} height={384} loading="lazy" />
        <span className="acCaClipState">{playing ? "pause" : "play"}</span>
      </button>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function CarPanel() {
  const [video, setVideo] = useState(false);
  return (
    <div className="acPanel acCa">
      <div className="acCaGrid">
        <figure className="acCaFig acCaTall">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${M}/detect-debug.jpg`} alt="Laptop screen showing the garbage detector window outdoors: a green box labelled garbage 0.90 W:45px, a green centre line, red threshold lines, and ROS logs" width={1050} height={1400} loading="lazy" />
          <figcaption>
            Garbage detection on the lot. camera_driver2&apos;s window draws the box (<span className="acMono">garbage 0.90 W:45px</span>), the
            green centre line, the red threshold band and the red error line to the target, while the ROS logs scroll behind it. The
            threshold lines sit 0.15 of the frame width apart, which is how this page knows the frame was 640 px wide.
          </figcaption>
        </figure>
        <figure className="acCaFig acCaWider">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${M}/lane-debug.jpg`} alt="Monitor showing the lane calibration GUI: the black-and-white mask window, parameter sliders, and the camera view with tracked centroids between red threshold lines" width={1400} height={1050} loading="lazy" />
          <figcaption>
            Lane calibration in the lab: the mask window with the slider bank, and the camera view with the tracked centroids between
            the red threshold lines. These sliders produced racer_calibration2.yaml, the values panel 1 starts from.
          </figcaption>
        </figure>
        <Clip src={`${M}/arm.webp`} poster={`${M}/arm.jpg`} alt="The blue 3D-printed scoop arm on the front of the car swinging on the bench" caption="The scoop arm on the bench, swung by the servo node." />
        <Clip src={`${M}/topdown.webp`} poster={`${M}/topdown.jpg`} alt="The car seen from above, sitting on the dashed yellow tape" caption="The car on the tape, from above." />
        <figure className="acCaFig acCaVideo">
          {video ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
              title="Lane following run, May 21, 2025"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button type="button" className="acCaPoster" onClick={() => setVideo(true)} aria-label="Play the lane-following video (loads YouTube)">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${M}/youtube-${VIDEO_ID}.jpg`} alt="" width={480} height={360} loading="lazy" />
              <span className="acCaPlay" aria-hidden="true" />
            </button>
          )}
          <figcaption>Lane following on May 21, 2025, the run linked from the repo&apos;s README. Plays from YouTube when clicked.</figcaption>
        </figure>
      </div>

      <div className="acCaCredits">
        <div>
          <h3>Software</h3>
          <p>
            David: every ROS 2 node in the package (object detection, lane detection, guidance, servo sweeper), the launch file and the
            calibration. Lane detection began from the course TA&apos;s ucsd_robocar example.
          </p>
        </div>
        <div>
          <h3>Hardware</h3>
          <p>The rest of Team 3: the car&apos;s hardware assembly, including the 3D-printed parts such as the scoop arm.</p>
        </div>
        <div>
          <h3>On the car</h3>
          <p>
            OAK-D Lite camera running the Roboflow detector on board, a VESC motor controller behind the course&apos;s twist node, and a
            PCA9685 servo driver on I2C for the arm.
          </p>
        </div>
      </div>
    </div>
  );
}
