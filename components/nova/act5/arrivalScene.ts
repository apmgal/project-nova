import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ARRIVAL_TIMELINE as T } from "@/lib/nova/inspectorArrival";

/**
 * The inspector-arrival cinematic, built in Three.js: a dark executive car arrives on a wet forecourt at
 * night, close-up on the driver's door opening and closing, then a close tracking shot of the inspector's
 * leather document case. Everything is a pure function of the cinematic time t (seconds, same clock as
 * ARRIVAL_TIMELINE), so playback, review stills and sound cues stay in sync.
 *
 * Assets (public/assets/cinematics/arrival/): executive_car.glb — "Car Concept", Khronos glTF Sample
 * Assets, CC-BY 4.0 (© 2024 Darmstadt Graphics Group GmbH, model and textures by Eric Chadwick; from a
 * CC0 model by Unity Fan), repainted at runtime; leather_normal.webp — from "Sheen Wood Leather Sofa",
 * same source and licence; facility_backdrop_blur.jpg — derived from the project's own facility image.
 */

export interface ArrivalSceneAssets {
  car: string;
  leatherNormal: string;
  backdrop: string;
}

export interface ArrivalScene {
  render(t: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const phase = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
const easeOutQuad = (v: number) => 1 - (1 - v) ** 2; // steady braking to a stop

// Car motion (cinematic seconds): rolls in from far up the forecourt and stops at the entrance.
const CAR = { from: -24, arriveStart: 2.1, stopAt: 4.25, wheelRadius: 0.36 };
// Driver's door (UK: right-hand side of the car): opens, stays while he steps out, closes with a thunk.
const DOOR = { open: [4.95, 5.45] as const, close: [5.62, 5.8] as const, angle: 1.05 };

function makeCanvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return new THREE.CanvasTexture(c);
}

/** Wet asphalt roughness: multi-scale noise — glossy puddle film in the low areas, rougher dry patches. */
function wetAsphaltRoughness() {
  const N = 512;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grid = (cells: number) => Array.from({ length: (cells + 1) * (cells + 1) }, rnd);
  const octaves = [8, 16, 32, 96].map((c) => ({ c, g: grid(c) }));
  const sample = ({ c, g }: { c: number; g: number[] }, x: number, y: number) => {
    const fx = (x / N) * c, fy = (y / N) * c;
    const ix = Math.floor(fx) % c, iy = Math.floor(fy) % c, tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const at = (i: number, j: number) => g[(j % c) * (c + 1) + (i % c)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return a + (b - a) * sy;
  };
  const tex = makeCanvasTexture(N, N, (g) => {
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = sample(octaves[0], x, y) * 0.45 + sample(octaves[1], x, y) * 0.3 + sample(octaves[2], x, y) * 0.15 + sample(octaves[3], x, y) * 0.1;
        const wet = Math.min(1, Math.max(0, (0.52 - v) * 4)); // low areas hold water
        const r = Math.round(255 * (0.66 - 0.4 * wet + (rnd() - 0.5) * 0.05));
        const i = (y * N + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = r;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function softShadowTexture() {
  return makeCanvasTexture(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, "rgba(0,0,0,0.85)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  });
}

/** The inspector's document case: dark leather body with piping, an arched handle and brass clasps. */
function buildDocumentCase(leatherNormal: THREE.Texture) {
  const g = new THREE.Group();
  const n = leatherNormal.clone();
  n.wrapS = n.wrapT = THREE.RepeatWrapping;
  n.repeat.set(3, 3);
  n.needsUpdate = true;
  const leather = new THREE.MeshPhysicalMaterial({
    color: "#1d1510",
    roughness: 0.42,
    normalMap: n,
    normalScale: new THREE.Vector2(0.6, 0.6),
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    sheen: 0.4,
    sheenColor: new THREE.Color("#4a3426"),
  });
  const darker = leather.clone();
  darker.color = new THREE.Color("#120d0a");
  const brass = new THREE.MeshPhysicalMaterial({ color: "#b58f55", metalness: 1, roughness: 0.22 });

  const W = 0.44, H = 0.32, D = 0.1;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, 0.02), leather);
  body.castShadow = true;
  g.add(body);
  // Edge piping: a slightly proud band around the sides.
  const piping = new THREE.Mesh(new RoundedBoxGeometry(W + 0.006, H + 0.006, 0.014, 4, 0.006), darker);
  g.add(piping);
  // Flap seam across the top third.
  const seam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, 0.004, D + 0.004), darker);
  seam.position.y = H * 0.18;
  g.add(seam);
  // Brass clasps on the front face and the handle fittings.
  for (const x of [-0.12, 0.12]) {
    const clasp = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.03, 0.012, 3, 0.004), brass);
    clasp.position.set(x, H * 0.18, D / 2 + 0.004);
    g.add(clasp);
    const fitting = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.018, 0.03, 3, 0.005), brass);
    fitting.position.set(x * 0.62, H / 2 + 0.006, 0);
    g.add(fitting);
  }
  // Arched handle.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.075, H / 2 + 0.01, 0),
    new THREE.Vector3(-0.06, H / 2 + 0.06, 0),
    new THREE.Vector3(0, H / 2 + 0.078, 0),
    new THREE.Vector3(0.06, H / 2 + 0.06, 0),
    new THREE.Vector3(0.075, H / 2 + 0.01, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.011, 12, false), darker);
  handle.castShadow = true;
  g.add(handle);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return g;
}

export async function createArrivalScene(canvas: HTMLCanvasElement, assets: ArrivalSceneAssets): Promise<ArrivalScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#04070d");
  scene.fog = new THREE.FogExp2("#060a14", 0.035);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.16;

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 200);

  // ---------- Loading ----------
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const texLoader = new THREE.TextureLoader();
  const [gltf, leatherNormal, backdropTex] = await Promise.all([
    loader.loadAsync(assets.car),
    texLoader.loadAsync(assets.leatherNormal),
    texLoader.loadAsync(assets.backdrop),
  ]);
  backdropTex.colorSpace = THREE.SRGBColorSpace;

  // ---------- Forecourt ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 1, roughnessMap: wetAsphaltRoughness(), metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Painted bay lines either side of the drop-off point.
  const lineMat = new THREE.MeshStandardMaterial({ color: "#c9b46a", roughness: 0.6 });
  for (const x of [-2.6, 2.6]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 16), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.002, -2);
    line.receiveShadow = true;
    scene.add(line);
  }
  // The facility at night, far behind the car (seen in the arrival shot).
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 54),
    new THREE.MeshBasicMaterial({ map: backdropTex, toneMapped: false, fog: false, color: new THREE.Color(0.55, 0.58, 0.68) }),
  );
  backdrop.position.set(0, 19, -60);
  scene.add(backdrop);
  // Distant lamp posts: small bright points that bloom into soft bokeh in the close shots.
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.6, 3.2), toneMapped: false });
  for (const [x, z] of [[-14, -18], [12, -22], [-20, 6], [18, 4], [-9, 16], [10, 14], [22, -6]] as const) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), lampMat);
    lamp.position.set(x, 4.6, z);
    scene.add(lamp);
  }

  // ---------- Lighting: cold night, warm facility floods ----------
  scene.add(new THREE.HemisphereLight("#2a3a5c", "#08090c", 0.55));
  const moon = new THREE.DirectionalLight("#9db7ff", 0.55);
  moon.position.set(-8, 14, -6);
  scene.add(moon);
  const floods: THREE.SpotLight[] = [];
  const floodSpecs: { pos: [number, number, number]; target: [number, number, number]; intensity: number }[] = [
    { pos: [6.5, 7.5, -3], target: [0, 0, 0.5], intensity: 260 },
    { pos: [-7, 6.5, 5.5], target: [-1.5, 0, 1.5], intensity: 200 },
  ];
  for (const { pos, target, intensity } of floodSpecs) {
    const s = new THREE.SpotLight("#ffd7a6", intensity, 40, 0.62, 0.7, 1.6);
    s.position.set(...pos);
    s.target.position.set(...target);
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    s.shadow.bias = -0.0004;
    s.shadow.radius = 4;
    scene.add(s, s.target);
    floods.push(s);
  }

  // ---------- The car ----------
  const carGroup = new THREE.Group(); // drives along +z; pitches on braking
  const carBody = gltf.scene;
  // Repaint: deep graphite metallic with a clear coat; interiors dark; hide the logos.
  const paint = new THREE.MeshPhysicalMaterial({
    color: "#12151a", metalness: 0.65, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04,
  });
  const interiorDark = new THREE.MeshStandardMaterial({ color: "#16130f", roughness: 0.7 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#0d0d0e", roughness: 0.85 });
  const headlightMeshes: THREE.Mesh[] = [];
  const brakeMeshes: THREE.Mesh[] = [];
  carBody.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const name = (Array.isArray(m.material) ? m.material[0] : m.material)?.name ?? "";
    if (/^Paint/.test(name)) m.material = paint;
    else if (/^Interior 3/.test(name)) m.material = interiorDark;
    else if (name === "Tireside") m.material = rubber;
    else if (name === "Headlight") headlightMeshes.push(m);
    else if (name === "Brakelight") brakeMeshes.push(m);
    if (o.name === "License Plate" || o.name === "InteriorSteeringEmblem") o.visible = false;
  });
  // Lights get their own emissive copies so they can glow (and bloom).
  const headMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#eaf1ff"), emissiveIntensity: 3, roughness: 0.2 });
  headlightMeshes.forEach((m) => { m.material = headMat; });
  const brakeMat = new THREE.MeshStandardMaterial({ color: "#3a0000", emissive: new THREE.Color("#ff1a1a"), emissiveIntensity: 1, roughness: 0.3 });
  brakeMeshes.forEach((m) => { m.material = brakeMat; });

  // Sit the car on the ground, centred on its own origin.
  carGroup.add(carBody);
  carBody.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(carBody);
  const centre = box.getCenter(new THREE.Vector3());
  carBody.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
  scene.add(carGroup);
  const carLength = box.max.z - box.min.z;

  // Wheels: re-pivot each around its own centre so it can roll.
  scene.updateMatrixWorld(true);
  const wheels: THREE.Object3D[] = [];
  for (const name of ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"]) {
    const w = carBody.getObjectByName(name);
    if (!w?.parent) continue;
    const parent = w.parent;
    parent.updateMatrixWorld(true);
    const wb = new THREE.Box3().setFromObject(w);
    const c = parent.worldToLocal(wb.getCenter(new THREE.Vector3()));
    const pivot = new THREE.Object3D();
    pivot.position.copy(c);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(w);
    if (name.startsWith("WheelFront")) {
      // The sample model's front wheels are posed steered; straighten them (keep the roll), re-centred.
      w.rotation.y = 0;
      w.rotation.z = 0;
      w.updateMatrixWorld(true);
      const off = pivot.worldToLocal(new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3()));
      w.position.sub(off);
    }
    wheels.push(pivot);
  }
  const driverDoor = carBody.getObjectByName("BodyDoorRColor1") ?? null;

  // Headlight beams and the cabin light.
  const beams: THREE.SpotLight[] = [];
  for (const x of [-0.62, 0.62]) {
    const s = new THREE.SpotLight("#e8f0ff", 45, 16, 0.34, 0.6, 1.4);
    s.position.set(x, 0.72, carLength / 2 - 0.25);
    s.target.position.set(x * 1.4, 0, carLength / 2 + 7); // dipped beams: the pool stays just ahead of the car
    s.castShadow = false;
    carGroup.add(s, s.target);
    beams.push(s);
  }
  const cabin = new THREE.PointLight("#ffd9a0", 0, 2.6, 1.6);
  cabin.position.set(-0.35, 1.05, 0.2);
  carGroup.add(cabin);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, carLength * 1.05),
    new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.004;
  carGroup.add(contact);

  // ---------- The document case ----------
  const docCase = buildDocumentCase(leatherNormal);
  scene.add(docCase);

  // ---------- Post-processing ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.004, maxblur: 0.008 });
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.35, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const bokehUniforms = bokeh.uniforms as unknown as Record<string, { value: number }>;

  // ---------- Animation ----------
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  /** Subtle handheld drift, deterministic in t. */
  const drift = (t: number, amp: number) =>
    tmp.set(Math.sin(t * 1.3) * amp + Math.sin(t * 2.9) * amp * 0.4, Math.sin(t * 1.7 + 1) * amp * 0.6, 0);

  function poseCar(t: number) {
    const u = clamp01((t - CAR.arriveStart) / (CAR.stopAt - CAR.arriveStart));
    const s = easeOutQuad(u);
    const z = CAR.from * (1 - s);
    carGroup.position.set(0, 0, z);
    const distance = -CAR.from * s;
    wheels.forEach((w) => { w.rotation.x = distance / CAR.wheelRadius; });
    // Braking: the nose dips as it stops, then settles back (damped).
    const after = t - CAR.stopAt;
    const dip = u < 1 ? 0.012 * smooth(clamp01((u - 0.55) / 0.45)) : 0.012 * Math.exp(-after * 4) * Math.cos(after * 9);
    carGroup.rotation.x = dip;
    brakeMat.emissiveIntensity = u > 0.35 && after < 0.9 ? 6 : 1.2;
    // Lights dim once parked (the driver switches off as the door opens).
    const off = phase(t, 4.7, 5.0);
    headMat.emissiveIntensity = 3 * (1 - 0.85 * off);
    beams.forEach((b) => { b.intensity = 45 * (1 - off); });
    // Driver's door and cabin light.
    const open = phase(t, DOOR.open[0], DOOR.open[1]) * (1 - phase(t, DOOR.close[0], DOOR.close[1]));
    if (driverDoor) driverDoor.rotation.z = DOOR.angle * open;
    cabin.intensity = 3.2 * open;
  }

  function poseCase(t: number) {
    // Carried from beside the closed door towards camera: walking pace, swing synced to the footsteps.
    const k = clamp01((t - T.shotFootsteps) / (T.shotsOut - T.shotFootsteps));
    const step = (t - (T.footsteps + 0.05)) / 0.5; // a footstep every 0.5 s
    const swing = Math.sin(step * Math.PI) * 0.09;
    docCase.position.set(-2.1 - 0.55 * k, 0.44 + Math.abs(Math.sin(step * Math.PI)) * 0.012, 0.9 + 1.7 * k);
    docCase.rotation.set(swing * 0.4, Math.PI / 2 + 0.08, swing);
    docCase.visible = t >= T.shotFootsteps - 0.05;
  }

  function poseCamera(t: number) {
    if (t < T.shotDoor) {
      // Shot 1 — low, three-quarter front: the car rolls in out of the dark towards the lens and stops.
      const k = phase(t, T.shotsIn - 0.3, T.shotDoor);
      camera.fov = 30;
      camera.position.set(3.3 - 0.4 * k, 0.5 + 0.05 * k, 7.2 - 0.6 * k).add(drift(t, 0.012));
      look.set(0.1, 0.62, carGroup.position.z * 0.35 - 0.2);
      bokehUniforms.aperture.value = 0;
    } else if (t < T.shotFootsteps) {
      // Shot 2 — close on the driver's door from the rear quarter: it opens, light spills, it closes.
      const k = phase(t, T.shotDoor, T.shotFootsteps);
      camera.fov = 32;
      camera.position.set(-3.5 - 0.15 * k, 1.05, -2.5 + 0.3 * k).add(drift(t, 0.008));
      look.set(-1.05, 0.8, 0.55);
      bokehUniforms.focus.value = camera.position.distanceTo(look);
      bokehUniforms.aperture.value = 0.0025;
    } else {
      // Shot 3 — low tracking close-up on the document case as he walks away from the car.
      camera.fov = 30;
      camera.position.set(docCase.position.x + 0.8, 0.33, docCase.position.z + 1.0).add(drift(t, 0.006));
      look.copy(docCase.position).add(tmp.set(0, -0.02, 0));
      bokehUniforms.focus.value = camera.position.distanceTo(look);
      bokehUniforms.aperture.value = 0.006;
    }
    camera.updateProjectionMatrix();
    camera.lookAt(look);
  }

  return {
    render(t) {
      poseCar(t);
      poseCase(t);
      poseCamera(t);
      composer.render();
    },
    resize(width, height) {
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.resolution.set(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      composer.dispose();
      envRT.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat?.dispose());
      });
      renderer.dispose();
    },
  };
}
