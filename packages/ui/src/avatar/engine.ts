// packages/ui/src/avatar/engine.ts
//
// Procedural "Monte" orb — a glossy green sphere, white pill eyes, floating
// mint hands, and an orbital ring. Web + mobile share the reference-inspired
// model without binary assets, DOM textures, or an expensive glass/bloom pass.
//
// The engine is host-agnostic: it receives a canvas (web) or an existing
// WebGL context (expo-gl on mobile) and exposes tick()/render() for the
// host's own requestAnimationFrame loop.
//
// Gesture map:
//   greeting  → raised floating hand waves; the orb tilts and smiles
//   thinking  → eyes look up/side, one hand moves toward the face, ring pulses
//   speaking  → mouth opens/closes driven by noteDelta() + hand gestures
//   cheerful  → wider smile, brighter rim, livelier hover ("alive")
//   sad       → frown, lowered gaze and hands, slower bob
//   idle      → blinks, gentle gaze wander, slow hover bob

import * as THREE from "three";
import type { AvatarEmotion, AvatarEngineHandle, AvatarGazeTarget, AvatarState } from "./types";

/** Mint/emerald palette from the orb reference, with an off-white face. */
const COLORS = {
  body: 0x43bc83,
  hand: 0xb8ead3,
  face: 0xf2fff7,
  rim: 0xdcffed,
  ring: 0x267f62,
  glow: 0x123e29,
  white: 0xffffff,
};

const GREETING_DURATION = 2.05;
const BLINK_DURATION = 0.14;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Frame-rate independent exponential smoothing. */
function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Smooth 0→1 ramp between two times (seconds). */
function smoothRamp(start: number, end: number, value: number): number {
  const s = clamp01((value - start) / (end - start));
  return s * s * (3 - 2 * s);
}

/**
 * Small, procedural studio reflection map. DataTexture works on expo-gl as
 * well as the browser; no canvas, downloaded HDR, or native image loader.
 */
function createReflectionTexture(): THREE.DataTexture {
  const width = 128;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  const panels = [
    { u: 0.75, v: 0.82, width: 0.03, height: 0.045 },
    { u: 0.87, v: 0.78, width: 0.02, height: 0.035 },
    { u: 0.59, v: 0.82, width: 0.03, height: 0.09 },
    { u: 0.68, v: 0.91, width: 0.015, height: 0.025 },
    { u: 0.18, v: 0.76, width: 0.025, height: 0.06 },
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const v = (y + 0.5) / height;
      let light = smoothRamp(0.86, 1, v) * 0.85;
      for (const panel of panels) {
        const deltaU = Math.min(Math.abs(u - panel.u), 1 - Math.abs(u - panel.u));
        const highlight = Math.exp(
          -Math.pow(deltaU / panel.width, 4) - Math.pow((v - panel.v) / panel.height, 4)
        );
        light = Math.max(light, highlight);
      }
      const offset = (y * width + x) * 4;
      const base = [46 + v * 55, 108 + v * 60, 77 + v * 55];
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = Math.round(base[channel] + (255 - base[channel]) * light);
      }
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Soft contact shadow, also generated without a DOM canvas. */
function createShadowTexture(): THREE.DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 255;
      data[offset + 3] = Math.round(Math.pow(Math.max(0, 1 - radius), 2) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Minimal canvas stand-in for native hosts. three always registers context
 * listeners on its canvas; native has no DOM canvas, so hand it this. It
 * never calls getContext() because we pass an existing context.
 */
function createStubCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    style: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  return canvas as unknown as HTMLCanvasElement;
}

export interface AvatarEngineOptions {
  /** Canvas to render into (web). Provide `context` instead on native. */
  canvas?: HTMLCanvasElement;
  /** Existing WebGL context (expo-gl). When set, `canvas` may be omitted. */
  context?: WebGLRenderingContext | WebGL2RenderingContext;
  width: number;
  height: number;
  /** Device pixel ratio — defaults to 1 (native surfaces are pre-scaled). */
  pixelRatio?: number;
}

export function createAvatarEngine(options: AvatarEngineOptions): AvatarEngineHandle {
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const canvas = options.canvas ?? createStubCanvas(width, height);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: options.context as WebGLRenderingContext | undefined,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(options.pixelRatio ?? 1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  // Frame the full ring and both hands, including the raised greeting hand,
  // inside the existing square web/native hosts.
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40);
  camera.position.set(0, 0.08, 6.4);
  camera.lookAt(0, -0.06, 0);

  scene.add(new THREE.AmbientLight(COLORS.white, 0.65));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x72b995, 0.9));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.65);
  keyLight.position.set(-3, 8, 4);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xdcffed, 0.8);
  rimLight.position.set(4, 2, -2);
  scene.add(rimLight);

  // Procedural textures are owned by this engine, just like the geometry
  // and materials. Disposing the reflection map also frees three's cube map.
  const materials: THREE.Material[] = [];
  function trackMat<T extends THREE.Material>(material: T): T {
    materials.push(material);
    return material;
  }

  const reflectionTexture = createReflectionTexture();
  const shadowTexture = createShadowTexture();
  const textures = [reflectionTexture, shadowTexture];

  const bodyMat = trackMat(
    new THREE.MeshPhongMaterial({
      color: COLORS.body,
      specular: 0xf0fff7,
      shininess: 110,
      envMap: reflectionTexture,
      combine: THREE.MixOperation,
      reflectivity: 0.42,
      emissive: COLORS.glow,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.96,
    })
  );
  const handMat = trackMat(
    new THREE.MeshPhongMaterial({
      color: COLORS.hand,
      specular: COLORS.white,
      shininess: 95,
      envMap: reflectionTexture,
      combine: THREE.MixOperation,
      reflectivity: 0.48,
      transparent: true,
      opacity: 0.96,
    })
  );
  const faceMat = trackMat(new THREE.MeshBasicMaterial({ color: COLORS.face, toneMapped: false }));
  const ringMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: COLORS.ring, transparent: true, opacity: 0.48, depthWrite: false, toneMapped: false,
    })
  );
  const ringGlowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x83e7bc, transparent: true, opacity: 0.055, depthWrite: false, toneMapped: false,
    })
  );
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x214e37, map: shadowTexture, transparent: true, opacity: 0.16, depthWrite: false,
    })
  );

  // A lightweight Fresnel shell gives the orb and hands the milky glass
  // edge from the reference. GLSL1 + DataTexture keeps WebGL1/expo-gl support.
  const shellMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: { rimColor: { value: new THREE.Color(COLORS.rim) }, strength: { value: 0.48 } },
      vertexShader: `
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDirection = -viewPosition.xyz;
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 rimColor;
        uniform float strength;
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        void main() {
          float facing = abs(dot(normalize(vViewNormal), normalize(vViewDirection)));
          float rim = pow(1.0 - clamp(facing, 0.0, 1.0), 2.6);
          gl_FragColor = vec4(rimColor, rim * strength);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
    })
  );

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.26), shadowMat);
  shadow.position.set(0, -1.3, -0.4);
  scene.add(shadow);

  const root = new THREE.Group();
  root.name = "monte-avatar";
  scene.add(root);

  const orb = new THREE.Group();
  orb.name = "monte-orb";
  root.add(orb);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), bodyMat);
  body.name = "orb-core";
  orb.add(body);

  function addShell(parent: THREE.Group, radius: number, segments: number): void {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), shellMat);
    shell.renderOrder = 2;
    parent.add(shell);
  }
  addShell(orb, 1.018, 48);

  // White face parts sit outside the curved glass surface, even as their
  // gaze moves. No robot skull, pupils, eyebrows, ears, antenna, or torso.
  const faceDepth = (x: number, y: number): number => Math.sqrt(Math.max(0.1, 1 - x * x - y * y)) + 0.035;
  const eyes: Array<{ mesh: THREE.Mesh; side: number; height: number }> = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.12, 5, 18), faceMat);
    eye.name = side < 0 ? "eye-left" : "eye-right";
    eye.scale.z = 0.2;
    eye.position.set(side * 0.3, 0.08, faceDepth(side * 0.3, 0.08));
    orb.add(eye);
    eyes.push({ mesh: eye, side, height: 1 });
  }

  // Rounded white smile/frown strokes, plus a white oval outline for speech.
  const mouth = new THREE.Group();
  mouth.name = "face-mouth";
  mouth.position.set(0, -0.28, faceDepth(0, -0.28));
  orb.add(mouth);

  function createMouthArc(frown: boolean): THREE.Group {
    const start = new THREE.Vector3(-0.185, frown ? -0.025 : 0.025, 0);
    const end = new THREE.Vector3(0.185, frown ? -0.025 : 0.02, 0);
    const curve = new THREE.QuadraticBezierCurve3(
      start, new THREE.Vector3(0, frown ? 0.11 : -0.1, 0.01), end
    );
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.022, 8, false), faceMat));
    for (const point of [start, end]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), faceMat);
      cap.position.copy(point);
      group.add(cap);
    }
    return group;
  }
  const smileArc = createMouthArc(false);
  const frownArc = createMouthArc(true);
  frownArc.visible = false;
  mouth.add(smileArc, frownArc);
  const mouthOpen = new THREE.Mesh(new THREE.TorusGeometry(1, 0.15, 8, 32), faceMat);
  mouthOpen.scale.set(0.145, 0.045, 0.055);
  mouthOpen.visible = false;
  mouth.add(mouthOpen);

  // The ring wraps around the orb, with its front arc above the eyes.
  const ring = new THREE.Group();
  ring.name = "orbit-ring";
  ring.position.y = 0.045;
  ring.rotation.x = Math.PI / 2 - 0.24;
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(1.29, 0.014, 8, 96), ringMat));
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(1.29, 0.036, 6, 96), ringGlowMat));
  root.add(ring);

  // Detached glossy spheres are the hands; gestures move them directly,
  // rather than keeping the old robot's shoulders or arms.
  const hands: Array<{ group: THREE.Group; side: number }> = [];
  for (const side of [-1, 1]) {
    const hand = new THREE.Group();
    hand.name = side < 0 ? "hand-left" : "hand-right";
    hand.position.set(side * 1.15, side < 0 ? -0.7 : -0.75, 0.12);
    hand.add(new THREE.Mesh(new THREE.SphereGeometry(0.33, 28, 20), handMat));
    addShell(hand, 0.338, 28);
    root.add(hand);
    hands.push({ group: hand, side });
  }

  // ── Animation state ──
  let state: AvatarState = { activity: "idle", emotion: "neutral" };
  let gazeTarget: AvatarGazeTarget | null = null;
  let time = 0;
  let lastNow: number | null = null;
  /** Seconds elapsed in the greeting wave, or null while not greeting. */
  let greetingT: number | null = null;
  /** Mouth energy — spikes on noteDelta(), decays while speaking. */
  let speakEnergy = 0.45;
  /** Current mouth openness (smoothed 0..1). */
  let mouthLevel = 0;
  let blinkIn = 2.4;
  let blinkT = -1;

  const setState = (next: Partial<AvatarState>): void => {
    state = { ...state, ...next };
  };

  function update(dt: number): void {
    time += dt;

    if (greetingT != null) {
      greetingT += dt;
      if (greetingT >= GREETING_DURATION) greetingT = null;
    }

    const greeting = greetingT != null;
    // A fast response can arrive during the welcome wave: keep talking
    // while the floating hand finishes its wave rather than hiding speech.
    const speaking = state.activity === "speaking";
    const thinking = state.activity === "thinking" && !greeting;
    const emotion: AvatarEmotion = greeting ? "cheerful" : state.emotion;

    // ── Mouth / speech ──
    let openTarget = 0;
    if (speaking) {
      speakEnergy = Math.max(0.3, speakEnergy * Math.exp(-dt * 2.2));
      const syllable = 0.5 + 0.5 * Math.sin(time * 13.5 + Math.sin(time * 5.1) * 1.4);
      openTarget = 0.25 + 0.75 * syllable * (0.45 + 0.55 * speakEnergy);
    } else {
      speakEnergy = Math.min(speakEnergy, 0.45);
    }
    mouthLevel = damp(mouthLevel, openTarget, speaking ? 20 : 13, dt);

    const showFrown = !speaking && emotion === "sad";
    mouthOpen.visible = speaking;
    mouthOpen.scale.set(0.145 + mouthLevel * 0.02, 0.035 + mouthLevel * 0.095, 0.055);
    // The reference is friendly even at rest: neutral keeps a small smile.
    smileArc.visible = !speaking && !showFrown;
    frownArc.visible = showFrown;
    smileArc.scale.x = damp(smileArc.scale.x, emotion === "cheerful" ? 1.15 : 1, 9, dt);
    smileArc.scale.y = damp(smileArc.scale.y, thinking ? 0.45 : emotion === "cheerful" ? 1.3 : 1, 9, dt);
    mouth.rotation.z = damp(mouth.rotation.z, thinking ? -0.07 : emotion === "sad" ? 0.025 : 0, 8, dt);

    // ── Orb pose ──
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    if (emotion === "cheerful") {
      pitch = -0.05;
      roll = -0.05;
    } else if (emotion === "sad") {
      pitch = 0.16;
    }
    if (thinking) {
      pitch = -0.07;
      roll = -0.1;
      yaw = 0.1;
    }
    if (greeting) {
      pitch = -0.06;
      roll = -0.07; // tilt toward the raised floating hand (+x)
    }
    const nod = speaking ? Math.sin(time * 6.2) * 0.035 : 0;
    orb.rotation.x = damp(orb.rotation.x, pitch + nod, 7, dt);
    orb.rotation.y = damp(orb.rotation.y, yaw + Math.sin(time * 0.6) * 0.035, 5, dt);
    orb.rotation.z = damp(orb.rotation.z, roll, 7, dt);

    // ── Gaze ──
    let gazeX = Math.sin(time * 0.55) * 0.045;
    let gazeY = Math.sin(time * 0.37) * 0.018; // positive = look up
    if (speaking) {
      gazeX = Math.sin(time * 1.6) * 0.018;
      gazeY = 0.012;
    } else if (thinking) {
      gazeX = 0.06 + Math.sin(time * 0.9) * 0.012;
      gazeY = 0.05 + Math.sin(time * 1.4) * 0.008;
    } else if (emotion === "sad") {
      gazeX = Math.sin(time * 0.45) * 0.015;
      gazeY = -0.06;
    } else if (greeting) {
      gazeX = Math.sin(time * 2) * 0.012;
      gazeY = 0.015;
    }
    if (gazeTarget) {
      // Cursor attention only replaces gaze, never blinking or gestures.
      // Keep the white pills on the face, below the ring and above the smile.
      gazeX = gazeTarget.x * 0.15;
      gazeY = gazeTarget.y * (gazeTarget.y > 0 ? 0.055 : 0.075);
    }

    // ── Pill-eye blinks and expression ──
    blinkIn -= dt;
    if (blinkIn <= 0 && blinkT < 0) blinkT = 0;
    let blinkScale = 1;
    if (blinkT >= 0) {
      blinkT += dt;
      const p = blinkT / BLINK_DURATION;
      if (p >= 1) {
        blinkT = -1;
        blinkIn = 2.2 + Math.random() * 3.2;
      } else {
        blinkScale = 1 - Math.sin(p * Math.PI) * 0.94;
      }
    }
    for (const eye of eyes) {
      const mesh = eye.mesh;
      const eyeTarget = thinking ? (eye.side < 0 ? 1.15 : 0.83) : emotion === "cheerful" ? 1.08 : emotion === "sad" ? 0.84 : 1;
      eye.height = damp(eye.height, eyeTarget, 8, dt);
      mesh.scale.y = blinkScale * eye.height;
      mesh.scale.x = damp(mesh.scale.x, emotion === "sad" ? 0.94 : 1, 8, dt);
      mesh.position.x = damp(mesh.position.x, eye.side * 0.3 + gazeX, 7, dt);
      mesh.position.y = damp(mesh.position.y, 0.08 + gazeY + (thinking && !gazeTarget && eye.side < 0 ? 0.015 : 0), 7, dt);
      mesh.position.z = faceDepth(mesh.position.x, mesh.position.y);
      mesh.rotation.z = damp(mesh.rotation.z, emotion === "sad" ? eye.side * 0.14 : 0, 8, dt);
    }

    // ── Floating hands ──
    const g = greetingT ?? 0;
    const raise = greeting ? smoothRamp(0.02, 0.32, g) * (1 - smoothRamp(1.55, 2.0, g)) : 0;
    const swing = greeting && g > 0.25 ? Math.sin((g - 0.25) * 14) : 0;
    for (const hand of hands) {
      const side = hand.side;
      let x = side * (1.15 + Math.sin(time * 1.2 + side) * 0.018);
      let y = (side < 0 ? -0.7 : -0.75) + Math.sin(time * 2 + side) * 0.025;
      let z = 0.12;
      if (emotion === "cheerful") {
        x = side * 1.18;
        y += 0.07;
      } else if (emotion === "sad") {
        x = side * 1.1;
        y -= 0.12;
      }
      if (thinking && side < 0) {
        x = -0.78;
        y = -0.54;
        z = 1; // near the cheek/chin, but outside the glass sphere
      }
      if (speaking) {
        x += Math.sin(time * 3.2 + side) * 0.055;
        y += Math.sin(time * 4.4 + (side > 0 ? 0 : Math.PI)) * 0.11;
        z += Math.sin(time * 3.8 + side) * 0.04;
      }
      if (greeting && side > 0) {
        x += (1.27 + swing * 0.055 - x) * raise;
        y += (0.72 + swing * 0.055 - y) * raise;
        z += 0.04 * raise;
      }
      hand.group.position.x = damp(hand.group.position.x, x, 10, dt);
      hand.group.position.y = damp(hand.group.position.y, y, 10, dt);
      hand.group.position.z = damp(hand.group.position.z, z, 10, dt);
      // Keep both glass shells separated, including the path between poses.
      hand.group.position.clampLength(1.38, Infinity);
    }

    // ── Hover bob + sway ──
    const bobAmp = emotion === "cheerful" ? 0.065 : emotion === "sad" ? 0.022 : 0.04;
    const bobRate = emotion === "cheerful" ? 2.8 : emotion === "sad" ? 1.15 : 1.7;
    const bob = Math.sin(time * bobRate) * bobAmp;
    root.position.y = bob;

    // ── Shadow tracks the hover height ──
    const lift = (bob + bobAmp) / (bobAmp * 2);
    shadow.scale.setScalar(1.04 - lift * 0.12);
    shadowMat.opacity = 0.18 - lift * 0.06;

    // ── Orbital ring + glass glow ──
    const pulseRate = thinking ? 7 : emotion === "cheerful" ? 3.6 : emotion === "sad" ? 1.2 : 2;
    const pulse = 0.5 + 0.5 * Math.sin(time * pulseRate);
    const ringOpacity = emotion === "sad" ? 0.3 : thinking ? 0.5 + pulse * 0.16 : 0.46 + pulse * 0.06;
    ringMat.opacity = damp(ringMat.opacity, ringOpacity, 7, dt);
    ring.rotation.z = Math.sin(time * 0.65) * 0.025;
    ring.rotation.y = Math.sin(time * 0.5) * 0.04;
    bodyMat.emissiveIntensity = damp(
      bodyMat.emissiveIntensity, emotion === "cheerful" ? 0.18 : emotion === "sad" ? 0.025 : thinking ? 0.1 + pulse * 0.06 : 0.08, 7, dt
    );
    shellMat.uniforms.strength.value = damp(
      shellMat.uniforms.strength.value, emotion === "cheerful" ? 0.62 : emotion === "sad" ? 0.4 : 0.48, 7, dt
    );
  }

  return {
    setState,
    getState(): AvatarState {
      return { ...state };
    },
    setGazeTarget(target: AvatarGazeTarget | null): void {
      if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
        gazeTarget = null;
        return;
      }
      const length = Math.max(1, Math.hypot(target.x, target.y));
      gazeTarget = { x: target.x / length, y: target.y / length };
    },
    noteDelta(): void {
      speakEnergy = 1;
    },
    playGreeting(): void {
      greetingT = 0;
    },
    tick(nowMs: number): void {
      if (lastNow == null) lastNow = nowMs;
      const dt = Math.min(Math.max((nowMs - lastNow) / 1000, 0), 0.05);
      lastNow = nowMs;
      update(dt);
    },
    render(): void {
      renderer.render(scene, camera);
    },
    setSize(nextWidth: number, nextHeight: number, pixelRatio?: number): void {
      const w = Math.max(1, Math.floor(nextWidth));
      const h = Math.max(1, Math.floor(nextHeight));
      renderer.setPixelRatio(pixelRatio ?? 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose(): void {
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) geometries.add(object.geometry);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
    },
  };
}
