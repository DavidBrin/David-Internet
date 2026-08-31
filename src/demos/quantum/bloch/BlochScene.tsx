"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { greatCirclePoints, rotateAroundAxis, type Vec3 } from "./model";

const ACCENT = 0x7c3aed;
const LINE_COLOR = 0xd6d0ea;
const RING_COLOR = 0xb9aede;
const GATE_ANIM_MS = 250;
const TRAIL_MAX = 5;

function toV3(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

/** Small billboard text label (e.g. |0>, |1>, x, y, z) rendered onto a canvas texture. */
function makeLabel(text: string, color: string, fontPx = 54): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontPx}px ui-serif, Georgia, serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.42, 0.21, 1);
  return sprite;
}

interface Arrow {
  group: THREE.Group;
  shaftMat: THREE.MeshBasicMaterial;
  headMat: THREE.MeshBasicMaterial;
  setDir: (v: Vec3) => void;
  setOpacity: (o: number) => void;
}

function makeArrow(color: number, opacity: number): Arrow {
  const shaftLen = 0.78;
  const headLen = 0.18;
  const shaftGeo = new THREE.CylinderGeometry(0.013, 0.013, shaftLen, 8);
  shaftGeo.translate(0, shaftLen / 2, 0);
  const headGeo = new THREE.ConeGeometry(0.05, headLen, 12);
  headGeo.translate(0, shaftLen + headLen / 2, 0);
  // depthWrite only for the fully-opaque main arrow - a translucent ghost writing depth would
  // wrongly occlude whatever is drawn after it (the main arrow, or another ghost).
  const depthWrite = opacity >= 1;
  const shaftMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite });
  const headMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  const head = new THREE.Mesh(headGeo, headMat);
  const group = new THREE.Group();
  group.add(shaft, head);
  const up = new THREE.Vector3(0, 1, 0);
  const setDir = (v: Vec3) => {
    const dir = toV3(v);
    if (dir.lengthSq() < 1e-12) return;
    dir.normalize();
    group.quaternion.setFromUnitVectors(up, dir);
  };
  const setOpacity = (o: number) => {
    shaftMat.opacity = o;
    headMat.opacity = o;
  };
  setDir([0, 0, 1]);
  return { group, shaftMat, headMat, setDir, setOpacity };
}

export interface BlochSceneHandle {
  /** Set the arrow immediately, no animation, no trail entry (initial mount / slider drag). */
  jumpTo: (vec: Vec3) => void;
  /** Slerp the arrow from `fromVec` along `axis` by `angle`, drawing the rotation axis and a
   *  great circle while animating; pushes `fromVec` into the fading trail first. */
  animateGate: (fromVec: Vec3, axis: Vec3, angle: number) => void;
}

const BlochScene = forwardRef<BlochSceneHandle>(function BlochScene(_props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentVecRef = useRef<Vec3>([0, 0, 1]);
  const mainArrowRef = useRef<Arrow | null>(null);
  const trailRef = useRef<Arrow[]>([]);
  const trailQueueRef = useRef<Vec3[]>([]);
  const axisLineRef = useRef<THREE.Line | null>(null);
  const circleRef = useRef<THREE.LineLoop | null>(null);
  const animRef = useRef<{ from: Vec3; axis: Vec3; angle: number; start: number; duration: number } | null>(null);
  const reducedMotionRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      jumpTo(vec: Vec3) {
        currentVecRef.current = vec;
        mainArrowRef.current?.setDir(vec);
      },
      animateGate(fromVec: Vec3, axis: Vec3, angle: number) {
        // push the pre-gate position into the trail
        trailQueueRef.current.unshift(fromVec);
        if (trailQueueRef.current.length > TRAIL_MAX) trailQueueRef.current.length = TRAIL_MAX;
        trailRef.current.forEach((g, i) => {
          const v = trailQueueRef.current[i];
          if (v) {
            g.setDir(v);
            g.group.visible = true;
          } else {
            g.group.visible = false;
          }
        });

        const toVec = rotateAroundAxis(fromVec, axis, angle);
        if (reducedMotionRef.current) {
          currentVecRef.current = toVec;
          mainArrowRef.current?.setDir(toVec);
          return;
        }
        animRef.current = { from: fromVec, axis, angle, start: performance.now(), duration: GATE_ANIM_MS };
        if (axisLineRef.current) {
          const pos = axisLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
          pos.setXYZ(0, -axis[0] * 1.3, -axis[1] * 1.3, -axis[2] * 1.3);
          pos.setXYZ(1, axis[0] * 1.3, axis[1] * 1.3, axis[2] * 1.3);
          pos.needsUpdate = true;
          axisLineRef.current.visible = true;
        }
        if (circleRef.current) {
          const pts = greatCirclePoints(axis, 64);
          const arr = new Float32Array(pts.length * 3);
          pts.forEach((p, i) => {
            arr[i * 3] = p[0];
            arr[i * 3 + 1] = p[1];
            arr[i * 3 + 2] = p[2];
          });
          circleRef.current.geometry.setAttribute("position", new THREE.BufferAttribute(arr, 3));
          circleRef.current.visible = true;
        }
      },
    }),
    [],
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const width = wrap.clientWidth || 380;
    const height = wrap.clientHeight || 380;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(2.3, 1.7, 2.3);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.8;
    controls.maxDistance = 6;
    controls.target.set(0, 0, 0);

    // sphere: soft shaded fill + faint latitude/longitude wireframe
    const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
    // depthWrite: false on every translucent backdrop layer below - otherwise each one, even at
    // low opacity, writes full depth and completely occludes the arrow/axes sitting behind it.
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xf6f3fb,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(sphereGeo, fillMat));
    const wireMat = new THREE.MeshBasicMaterial({
      color: LINE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(sphereGeo, wireMat));

    // equator (xy plane) + one meridian (xz plane), drawn bold
    function ringPoints(axis: Vec3): Float32Array {
      const pts = greatCirclePoints(axis, 96);
      const arr = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => {
        arr[i * 3] = p[0];
        arr[i * 3 + 1] = p[1];
        arr[i * 3 + 2] = p[2];
      });
      return arr;
    }
    const ringMat = new THREE.LineBasicMaterial({ color: RING_COLOR, transparent: true, opacity: 0.7, depthWrite: false });
    const equatorGeo = new THREE.BufferGeometry();
    equatorGeo.setAttribute("position", new THREE.BufferAttribute(ringPoints([0, 0, 1]), 3));
    scene.add(new THREE.LineLoop(equatorGeo, ringMat));
    const meridianGeo = new THREE.BufferGeometry();
    meridianGeo.setAttribute("position", new THREE.BufferAttribute(ringPoints([0, 1, 0]), 3));
    scene.add(new THREE.LineLoop(meridianGeo, ringMat.clone()));

    // axis ticks (short lines through the sphere along x, y, z)
    const tickMat = new THREE.LineBasicMaterial({ color: 0xb7b7bd, transparent: true, opacity: 0.6, depthWrite: false });
    const axes: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    for (const a of axes) {
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array([-a[0] * 1.18, -a[1] * 1.18, -a[2] * 1.18, a[0] * 1.18, a[1] * 1.18, a[2] * 1.18]);
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      scene.add(new THREE.Line(geo, tickMat));
    }
    const labelZ0 = makeLabel("|0>", "#1f2023");
    labelZ0.position.set(0, 0, 1.32);
    scene.add(labelZ0);
    const labelZ1 = makeLabel("|1>", "#1f2023");
    labelZ1.position.set(0, 0, -1.32);
    scene.add(labelZ1);
    const labelX = makeLabel("x", "#8a8a92", 46);
    labelX.position.set(1.3, 0, 0);
    scene.add(labelX);
    const labelY = makeLabel("y", "#8a8a92", 46);
    labelY.position.set(0, 1.3, 0);
    scene.add(labelY);

    // rotation axis + great circle helpers, hidden until a gate animation runs
    const axisLineGeo = new THREE.BufferGeometry();
    axisLineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const axisLineMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.35, depthWrite: false });
    const axisLine = new THREE.Line(axisLineGeo, axisLineMat);
    axisLine.visible = false;
    scene.add(axisLine);
    axisLineRef.current = axisLine;

    const circleGeo = new THREE.BufferGeometry();
    circleGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 65), 3));
    const circleMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.22, depthWrite: false });
    const circle = new THREE.LineLoop(circleGeo, circleMat);
    circle.visible = false;
    scene.add(circle);
    circleRef.current = circle;

    // ghost trail (rendered oldest-first so the most recent ghost draws on top)
    const trailOpacities = [0.32, 0.25, 0.19, 0.13, 0.08];
    const trail: Arrow[] = [];
    for (let i = TRAIL_MAX - 1; i >= 0; i--) {
      const g = makeArrow(ACCENT, trailOpacities[i]);
      g.group.visible = false;
      scene.add(g.group);
      trail[i] = g;
    }
    trailRef.current = trail;

    // main state arrow
    const mainArrow = makeArrow(ACCENT, 1);
    mainArrow.setDir(currentVecRef.current);
    scene.add(mainArrow.group);
    mainArrowRef.current = mainArrow;

    let raf = 0;
    const smoothstep = (t: number) => t * t * (3 - 2 * t);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      controls.update();

      const anim = animRef.current;
      if (anim) {
        const t = Math.min(1, (performance.now() - anim.start) / anim.duration);
        const eased = smoothstep(t);
        const dir = rotateAroundAxis(anim.from, anim.axis, anim.angle * eased);
        mainArrow.setDir(dir);
        if (t >= 1) {
          currentVecRef.current = rotateAroundAxis(anim.from, anim.axis, anim.angle);
          animRef.current = null;
          axisLine.visible = false;
          circle.visible = false;
        }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth || 380;
      const h = wrap.clientHeight || 380;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineLoop) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      sphereGeo.dispose();
      fillMat.dispose();
      wireMat.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="qCanvasWrap qBlScene">
      <canvas ref={canvasRef} role="img" aria-label="Bloch sphere with the qubit state as an arrow" />
    </div>
  );
});

export default BlochScene;
