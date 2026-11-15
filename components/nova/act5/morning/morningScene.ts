import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { MORNING_TIMELINE as T } from "@/lib/nova/morningInspection";
import { buildExterior } from "./exterior";
import { buildRoom, DOSSIER_POS, ROOM } from "./room";
import { resetSeed } from "./textures";

/**
 * "The Morning of the Inspection" — director. Two environments built in code (exterior.ts, room.ts), one
 * camera, restrained post-processing (selective depth of field, light bloom, a gentle shared grade), and
 * every camera move eased so it accelerates in and settles. A pure function of the cinematic time t.
 */

export interface MorningScene {
  render(t: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Ease in-out with a long, soft settle (quintic smootherstep). */
const settle = (v: number) => { const x = clamp01(v); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Point on a quadratic Bézier — gives the dolly moves a gentle arc rather than a straight line. */
const bez = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, k: number, out: THREE.Vector3) =>
  out.set(
    (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * c.x + k * k * b.x,
    (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * c.y + k * k * b.y,
    (1 - k) * (1 - k) * a.z + 2 * (1 - k) * k * c.z + k * k * b.z,
  );

/** A subtle, shared colour grade: cool lift in the shadows, warm gain in the highlights, gentle contrast. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    lift: { value: new THREE.Vector3(-0.012, -0.004, 0.018) },
    gain: { value: new THREE.Vector3(1.02, 1.0, 0.975) },
    contrast: { value: 1.05 },
    saturation: { value: 0.92 },
    vignette: { value: 0.22 },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 lift; uniform vec3 gain; uniform float contrast; uniform float saturation; uniform float vignette;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = c * gain + lift * (1.0 - c);
      c = (c - 0.5) * contrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      vec2 d = vUv - 0.5; c *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.0, 0.8)));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export async function createMorningScene(canvas: HTMLCanvasElement, assets: { logo: string }): Promise<MorningScene> {
  resetSeed();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1)); // cinematic grade + grain hide the difference; keeps laptops smooth
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);

  const logo = await new THREE.TextureLoader().loadAsync(assets.logo).catch(() => null);
  if (logo) logo.colorSpace = THREE.SRGBColorSpace;
  const ext = buildExterior(pmrem, logo);
  const room = buildRoom(pmrem);

  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.03, 3000);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(ext.scene, camera);
  composer.addPass(renderPass);
  const bokeh = new BokehPass(ext.scene, camera, { focus: 3, aperture: 0, maxblur: 0.008 });
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.16, 0.35, 0.97);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  const bu = bokeh.uniforms as unknown as Record<string, { value: number }>;
  const show = (s: THREE.Scene) => { renderPass.scene = s; (bokeh as unknown as { scene: THREE.Scene }).scene = s; };

  // Camera paths (start, arc control, end) and look targets per shot.
  const S1 = { a: v3(47.5, 2.1, 33.2), c: v3(43, 2.3, 30.2), b: v3(37.8, 2.7, 28.4), la: v3(0, 4.2, -21), lb: v3(5, 5.0, -21) };
  const S2 = { a: v3(3.9, 1.5, 2.55), c: v3(2.0, 1.45, 2.3), b: v3(0.15, 1.42, 2.25), la: v3(-4.4, 1.15, 1.2), lb: v3(-3.3, 0.92, -0.25) };
  const D = DOSSIER_POS;
  const S3 = { a: v3(D.x + 0.62, 1.12, D.z + 0.52), b: v3(D.x + 0.46, 1.02, D.z + 0.36), la: v3(D.x, D.y + 0.03, D.z - 0.02), lb: v3(D.x, D.y + 0.015, D.z) };
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const drift = new THREE.Vector3();
  /** Very slight breathing, as from a fluid-head tripod — never shaky. */
  const breathe = (t: number, a: number) => drift.set(Math.sin(t * 0.7) * a, Math.sin(t * 0.9 + 1.3) * a * 0.5, Math.sin(t * 0.5 + 2.1) * a * 0.4);

  function renderFrame(t: number) {
    if (t < T.shot2[0]) {
      // Shot 1 — the facility at dawn: a slow dolly forward with a sideways drift along the approach road,
      // lamp posts and the gatehouse sliding past in the foreground; settles at the end.
      show(ext.scene);
      renderer.toneMappingExposure = 0.86;
      const k = settle(t / (T.shot1[1] + 0.6)); // still settling as we cut
      bez(S1.a, S1.c, S1.b, k, pos).add(breathe(t, 0.02));
      look.lerpVectors(S1.la, S1.lb, k);
      camera.fov = 34;
      bu.aperture.value = 0;
      bokeh.enabled = false;
      bloom.enabled = true; // lamp heads and lobby lights only
      const v = clamp01(t / 3.6);
      ext.vehicle.position.set(lerp(-22, -6, 1 - (1 - v) * (1 - v)), 0, 5.5); // eases in towards the entrance
      room.setDoor(1);
    } else if (t < T.shot3[0]) {
      // Shot 2 — the inspection room: a dolly alongside the table behind the chairs, from an establishing view
      // of the room towards the head; the entrance door (in frame) swings shut on its closer at ~5.8 s.
      show(room.scene);
      renderer.toneMappingExposure = 1.0;
      const k = settle((t - T.shot2[0]) / (T.shot2[1] - T.shot2[0]));
      bez(S2.a, S2.c, S2.b, k, pos).add(breathe(t, 0.004));
      look.lerpVectors(S2.la, S2.lb, settle((t - T.shot2[0] - 0.3) / (T.shot2[1] - T.shot2[0] - 0.3)));
      camera.fov = 40;
      const doorK = clamp01((t - (T.doorClose - 0.55)) / 0.55);
      room.setDoor(1 - doorK * doorK); // a closer accelerates the leaf; the latch lands on the sound cue
      bokeh.enabled = false; // the room reads better sharp; depth of field is kept for the dossier
      bloom.enabled = false;
    } else {
      // Shot 3 — the dossier: a slow push and slight downward tilt; focus pulls from the slat wall to the cover.
      show(room.scene);
      renderer.toneMappingExposure = 0.95;
      const u = (t - T.shot3[0]) / (T.shot3[1] - T.shot3[0]);
      const k = settle(u * 1.1);
      pos.lerpVectors(S3.a, S3.b, k).add(breathe(t, 0.001));
      look.lerpVectors(S3.la, S3.lb, k);
      camera.fov = 32;
      room.setDoor(0);
      const pull = settle((t - T.shot3[0] - 0.05) / 0.85);
      bu.focus.value = lerp(1.9, pos.distanceTo(D), pull);
      bu.aperture.value = 0.0085;
      bokeh.enabled = true;
      bloom.enabled = false;
      // A cloud thins: the window light warms very slightly over the shot.
      room.sun.intensity = 4.0 + 0.35 * settle(u);
    }
    if (t < T.shot3[0]) room.sun.intensity = 4.0;
    camera.position.copy(pos);
    camera.updateProjectionMatrix();
    camera.lookAt(look);
    composer.render();
  }

  return {
    render: renderFrame,
    resize(width, height) {
      const w = Math.max(1, Math.floor(width)), h = Math.max(1, Math.floor(height));
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      composer.dispose();
      for (const s of [ext.scene, room.scene]) {
        s.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry?.dispose();
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
            Object.values(mat as unknown as Record<string, unknown>).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); });
            mat?.dispose();
          });
        });
      }
      ext.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

export { ROOM };
