import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  asphaltSet, brushedSet, claddingSet, concreteSet, drawTexture, fbm, grassSet, louvreSet, pavingSet, planeUV, rnd, slatsSet, worldUV,
} from "./textures";

/**
 * The Helix BioPharma facility at dawn. Same silhouette and layout as before (production block,
 * two-storey office/QC wing, glazed entrance hall), now with real facade detail, framed glazing, a lit
 * lobby, loading docks, rooftop plant, kerbs/paving/markings, a gatehouse, lamp posts and landscaping.
 * Repeated parts (mullions, rails, bollards, kerbs, shrubs…) are instanced to keep draw calls low.
 */

export interface Exterior {
  scene: THREE.Scene;
  vehicle: THREE.Object3D;
}

const SUN = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 3.5), THREE.MathUtils.degToRad(-58));

/** One mesh per call, with world-scaled UVs and shadows on. */
function slab(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, tile = 2, cast = true) {
  const m = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), tile), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** Instanced copies of one geometry at the given transforms. */
function instances(geo: THREE.BufferGeometry, mat: THREE.Material, items: { p: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] }[], cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const o = new THREE.Object3D();
  items.forEach((it, i) => {
    o.position.set(...it.p);
    o.rotation.set(...(it.r ?? [0, 0, 0]));
    o.scale.set(...(it.s ?? [1, 1, 1]));
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** A horizontal glazed band on a facade facing +z: interior plane, glass, mullions, transom, sill and head. */
function glazingBand(opts: {
  x: number; y: number; z: number; length: number; height: number; module: number;
  interior: THREE.Material; glass: THREE.Material; frame: THREE.Material;
}) {
  const g = new THREE.Group();
  const { x, y, z, length, height, module } = opts;
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(length, height), opts.interior);
  inner.position.set(x, y, z + 0.01);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(length, height), opts.glass);
  glass.position.set(x, y, z + 0.09);
  g.add(inner, glass);
  const n = Math.round(length / module);
  const posts = Array.from({ length: n + 1 }, (_, i) => ({ p: [x - length / 2 + i * (length / n), y, z + 0.12] as [number, number, number] }));
  g.add(instances(new THREE.BoxGeometry(0.06, height, 0.12), opts.frame, posts));
  for (const [dy, hgt, dep] of [[height / 2 + 0.05, 0.1, 0.22], [-height / 2 - 0.06, 0.12, 0.3]] as const) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(length + 0.12, hgt, dep), opts.frame);
    bar.position.set(x, y + dy, z + dep / 2);
    bar.castShadow = true;
    g.add(bar);
  }
  return g;
}

/** Interior seen through office glazing: ceiling-lit offices, some lit, most still dark (early morning). */
function officeInteriorTexture(cols: number, lit: number) {
  return drawTexture(cols * 48, 96, (g) => {
    for (let i = 0; i < cols; i++) {
      const on = rnd() < lit;
      const x = i * 48;
      const grd = g.createLinearGradient(0, 0, 0, 96);
      if (on) { grd.addColorStop(0, "#fbe2b6"); grd.addColorStop(0.25, "#e7c48f"); grd.addColorStop(1, "#8a6a48"); }
      else { grd.addColorStop(0, "#2c333d"); grd.addColorStop(1, "#151a21"); }
      g.fillStyle = grd;
      g.fillRect(x, 0, 48, 96);
      if (on) { g.fillStyle = "rgba(255,246,226,0.9)"; g.fillRect(x + 8, 4, 32, 3); }
      // Desks / screens silhouettes low in the pane.
      g.fillStyle = on ? "rgba(60,44,30,0.55)" : "rgba(8,10,14,0.6)";
      g.fillRect(x + 6, 66, 36, 6);
      if (rnd() < 0.6) g.fillRect(x + 14, 54, 10, 12);
      // Some blinds partly down.
      if (rnd() < 0.3) { g.fillStyle = on ? "rgba(214,200,176,0.9)" : "rgba(60,66,74,0.9)"; g.fillRect(x, 0, 48, 18 + rnd() * 30); }
    }
  });
}

export function buildExterior(pmrem: THREE.PMREMGenerator, logo: THREE.Texture | null): Exterior & { dispose(): void } {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#93a0b2", 0.0046);

  // Sky and image-based light from the same dawn sky.
  const sky = new Sky();
  sky.scale.setScalar(3000);
  const su = sky.material.uniforms;
  su.turbidity.value = 4.5;
  su.rayleigh.value = 3.0;
  su.mieCoefficient.value = 0.005;
  su.mieDirectionalG.value = 0.8;
  su.sunPosition.value.copy(SUN);
  scene.add(sky);
  const envScene = new THREE.Scene();
  const sky2 = new Sky();
  sky2.scale.setScalar(3000);
  Object.assign(sky2.material.uniforms.sunPosition.value, SUN);
  sky2.material.uniforms.turbidity.value = 4.5;
  sky2.material.uniforms.rayleigh.value = 3.0;
  envScene.add(sky2);
  const envRT = pmrem.fromScene(envScene);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.75;

  // Light: cool sky dome, a low warm sun just clearing the horizon (soft, long shadows).
  scene.add(new THREE.HemisphereLight("#a9b9d2", "#3a3d40", 0.75));
  const sun = new THREE.DirectionalLight("#ffd2ad", 2.4);
  sun.position.copy(SUN).multiplyScalar(140).add(new THREE.Vector3(0, 22, 0));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 55, bottom: -35, near: 1, far: 420 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // ---------- Materials ----------
  const clad = claddingSet();
  const cladding = new THREE.MeshStandardMaterial({ ...clad, metalness: 0.1, color: "#f2f3f5" });
  const anod = brushedSet([62, 68, 76]);
  const frame = new THREE.MeshStandardMaterial({ ...anod, metalness: 0.65 });
  const darkPanel = new THREE.MeshStandardMaterial({ ...brushedSet([52, 58, 66]), metalness: 0.45 });
  const conc = concreteSet();
  const concrete = new THREE.MeshStandardMaterial({ ...conc });
  const asph = asphaltSet();
  const asphalt = new THREE.MeshStandardMaterial({ ...asph });
  const pave = pavingSet();
  const paving = new THREE.MeshStandardMaterial({ ...pave });
  const grs = grassSet();
  const grass = new THREE.MeshStandardMaterial({ ...grs });
  const galv = new THREE.MeshStandardMaterial({ ...brushedSet([150, 154, 158]), metalness: 0.7 });
  const louvre = new THREE.MeshStandardMaterial({ ...louvreSet(), metalness: 0.6 });
  const slats = new THREE.MeshStandardMaterial({ ...slatsSet(), metalness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#141518", roughness: 0.9 });
  const yellow = new THREE.MeshStandardMaterial({ color: "#c9a227", roughness: 0.55 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#8c9bb0", metalness: 0, roughness: 0.04, transparent: true, opacity: 0.42, envMapIntensity: 1.15, reflectivity: 0.6 });
  const lineWhite = new THREE.MeshStandardMaterial({ color: "#d7d6cf", roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 });
  const lineYellow = new THREE.MeshStandardMaterial({ color: "#c8a63a", roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 });

  // ---------- Ground ----------
  const groundGeo = planeUV(new THREE.PlaneGeometry(700, 700), 2.5);
  const ground = new THREE.Mesh(groundGeo, grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const flat = (w: number, d: number, mat: THREE.Material, x: number, z: number, y = 0.02, tile = 3) => {
    const m = new THREE.Mesh(planeUV(new THREE.PlaneGeometry(w, d), tile), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  flat(118, 32, asphalt, -2, -1); // forecourt and car park
  flat(300, 8, asphalt, 20, 27, 0.025); // approach road (runs along x)
  flat(8, 16, asphalt, 18, 19, 0.024); // site entrance lane
  flat(20, 6, paving, 2, -14, 0.035, 1.2); // entrance plaza
  flat(70, 2.4, paving, -8, -19.6, 0.03, 1.2); // footpath along the production block
  flat(36, 2.4, paving, 22, -17.7, 0.03, 1.2); // footpath along the office wing
  flat(300, 2.0, paving, 20, 32.2, 0.03, 1.2); // footway beyond the road
  flat(22, 9, concrete, -30, -16.4, 0.028, 2); // dock apron

  // Kerbs (bevelled, instanced along the forecourt, the road and the footways).
  const kerbGeo = new RoundedBoxGeometry(1.0, 0.16, 0.18, 2, 0.03);
  const kerbs: { p: [number, number, number] }[] = [];
  const kerbRun = (x0: number, x1: number, z: number) => { for (let x = x0; x < x1; x += 1.0) kerbs.push({ p: [x + 0.5, 0.08, z] }); };
  kerbRun(-61, 14, 15); kerbRun(22, 57, 15); kerbRun(-130, 170, 23); kerbRun(-130, 170, 31); kerbRun(-61, 57, -17);
  scene.add(instances(kerbGeo, concrete, kerbs));

  // Road markings: dashed centre line, give-way at the site entrance, parking bays, a zebra crossing.
  const dash: { p: [number, number, number] }[] = [];
  for (let x = -120; x < 170; x += 6) dash.push({ p: [x, 0.04, 27] });
  scene.add(instances(new THREE.BoxGeometry(3, 0.005, 0.12), lineWhite, dash, false));
  const bays: { p: [number, number, number] }[] = [];
  for (let i = 0; i < 18; i++) bays.push({ p: [-52 + i * 2.6, 0.04, 9.5] });
  scene.add(instances(new THREE.BoxGeometry(0.1, 0.005, 5), lineWhite, bays, false));
  scene.add(instances(new THREE.BoxGeometry(46.8, 0.005, 0.1), lineWhite, [{ p: [-29.4, 0.04, 12] }], false));
  const zebra: { p: [number, number, number] }[] = [];
  for (let i = 0; i < 7; i++) zebra.push({ p: [-2.5 + i * 1.0, 0.04, -8.5] });
  scene.add(instances(new THREE.BoxGeometry(0.5, 0.005, 4), lineWhite, zebra, false));
  scene.add(instances(new THREE.BoxGeometry(7, 0.005, 0.12), lineWhite, [{ p: [18, 0.04, 22.6] }, { p: [18, 0.04, 22.9] }], false));
  scene.add(instances(new THREE.BoxGeometry(0.12, 0.005, 9), lineYellow, [{ p: [-40.6, 0.04, -14.5] }, { p: [-19.4, 0.04, -14.5] }], false));

  // ---------- The building ----------
  const bld = new THREE.Group();
  // Production block (front face z = -21).
  bld.add(slab(70, 11, 26, cladding, -8, 5.5, -34, 4));
  bld.add(slab(70.4, 1.1, 26.4, concrete, -8, 0.55, -34, 2)); // precast plinth
  bld.add(slab(70.5, 0.35, 26.5, frame, -8, 11.18, -34, 2)); // parapet coping
  const fins: { p: [number, number, number] }[] = [];
  for (let i = 0; i <= 10; i++) fins.push({ p: [-43 + i * 7, 5.6, -20.84] });
  bld.add(instances(new THREE.BoxGeometry(0.32, 10.6, 0.3), darkPanel, fins));
  // Clerestory glazing high on the production block.
  const darkInterior = new THREE.MeshStandardMaterial({ color: "#1b2129", roughness: 0.9 });
  bld.add(glazingBand({ x: -2, y: 8.7, z: -21, length: 54, height: 1.2, module: 1.5, interior: darkInterior, glass, frame }));
  // Office / QC wing (front face z = -19), two floors of ribbon glazing with brise-soleil.
  bld.add(slab(36, 8, 14, cladding, 22, 4, -26, 4));
  bld.add(slab(36.4, 0.35, 14.4, frame, 22, 8.15, -26, 2));
  bld.add(slab(36.4, 0.9, 14.4, concrete, 22, 0.45, -26, 2));
  for (const [y, lit] of [[2.55, 0.32], [5.85, 0.22]] as const) {
    const inner = new THREE.MeshStandardMaterial({ map: officeInteriorTexture(24, lit), emissiveMap: null, roughness: 1 });
    inner.emissive = new THREE.Color("#ffffff");
    inner.emissiveMap = inner.map;
    inner.emissiveIntensity = 0.75;
    bld.add(glazingBand({ x: 22, y, z: -19, length: 33.6, height: 1.7, module: 1.4, interior: inner, glass, frame }));
    const shade = new THREE.Mesh(new THREE.BoxGeometry(34, 0.08, 0.75), frame);
    shade.position.set(22, y + 1.05, -18.62);
    shade.castShadow = true;
    bld.add(shade);
  }
  // Company sign on the office wing (the project's own logo artwork).
  if (logo) {
    const img = logo.image as HTMLImageElement;
    const aspect = img && img.width ? img.width / img.height : 4;
    const plate = slab(2.1 * aspect + 0.6, 2.4, 0.08, darkPanel, 30.5, 7.15, -18.95, 2, false);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.1 * aspect, 2.1), new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.6 }));
    sign.position.set(30.5, 7.15, -18.9);
    bld.add(plate, sign);
  }

  // Entrance hall: double-height curtain wall with a warm lit lobby inside.
  const EX = 2, EZ = -17, EW = 14, EH = 7.5, ED = 9;
  bld.add(slab(EW, 0.4, ED, frame, EX, EH + 0.2, EZ - ED / 2, 2)); // roof slab
  bld.add(slab(0.4, EH, ED, darkPanel, EX - EW / 2 + 0.2, EH / 2, EZ - ED / 2, 2));
  bld.add(slab(0.4, EH, ED, darkPanel, EX + EW / 2 - 0.2, EH / 2, EZ - ED / 2, 2));
  const lobbyFloor = new THREE.Mesh(planeUV(new THREE.PlaneGeometry(EW - 0.8, ED), 1.2), new THREE.MeshStandardMaterial({ ...pavingSet(), color: "#d8d2c6" }));
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.position.set(EX, 0.05, EZ - ED / 2);
  bld.add(lobbyFloor);
  const lobbyWall = new THREE.Mesh(
    new THREE.PlaneGeometry(EW - 0.8, EH),
    new THREE.MeshStandardMaterial({
      map: drawTexture(512, 280, (g) => {
        g.fillStyle = "#cdb08a"; g.fillRect(0, 0, 512, 280);
        for (let x = 0; x < 512; x += 9) { g.fillStyle = `rgba(90,62,40,${0.25 + rnd() * 0.2})`; g.fillRect(x, 0, 3, 280); }
        g.fillStyle = "#2c2a28"; g.fillRect(150, 150, 212, 70); // reception desk front
        g.fillStyle = "#e9dcc4"; g.fillRect(150, 146, 212, 6);
      }),
      roughness: 0.8,
      emissive: new THREE.Color("#3a2a18"),
    }),
  );
  lobbyWall.position.set(EX, EH / 2, EZ - ED + 0.05);
  bld.add(lobbyWall);
  const lobbyLight = new THREE.PointLight("#ffd9a6", 60, 16, 1.6);
  lobbyLight.position.set(EX, EH - 1.2, EZ - ED / 2);
  bld.add(lobbyLight);
  const pendant = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe6bf").multiplyScalar(2.2) });
  bld.add(instances(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 20), pendant, [-4, 0, 4].map((dx) => ({ p: [EX + dx, EH - 1.4, EZ - ED / 2 + 1] as [number, number, number] })), false));
  const desk = slab(5, 1.1, 0.9, new THREE.MeshStandardMaterial({ color: "#2a2826", roughness: 0.5 }), EX, 0.55, EZ - ED + 2.2, 1);
  bld.add(desk);
  // Curtain wall: glass, vertical mullions, transoms, sliding entrance doors.
  const cw = new THREE.Mesh(new THREE.PlaneGeometry(EW - 0.8, EH - 0.2), glass);
  cw.position.set(EX, EH / 2, EZ + 0.02);
  bld.add(cw);
  const cwPosts: { p: [number, number, number] }[] = [];
  for (let i = 0; i <= 8; i++) cwPosts.push({ p: [EX - (EW - 0.8) / 2 + i * ((EW - 0.8) / 8), EH / 2, EZ + 0.08] });
  bld.add(instances(new THREE.BoxGeometry(0.08, EH, 0.2), frame, cwPosts));
  bld.add(instances(new THREE.BoxGeometry(EW - 0.8, 0.08, 0.18), frame, [{ p: [EX, 2.6, EZ + 0.08] }, { p: [EX, 5.1, EZ + 0.08] }]));
  bld.add(slab(3.4, 2.5, 0.1, frame, EX, 1.25, EZ + 0.12, 1)); // door surround (the doors read as darker glass inside it)
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.3), new THREE.MeshPhysicalMaterial({ color: "#506070", roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 1.2 }));
  doorGlass.position.set(EX, 1.18, EZ + 0.18);
  bld.add(doorGlass);
  // Canopy: deep flat roof on two slim columns, aluminium fascia, downlights in the soffit.
  bld.add(slab(16, 0.42, 5.2, frame, EX, 6.3, EZ + 2.4, 2));
  bld.add(instances(new THREE.CylinderGeometry(0.14, 0.14, 6.1, 18), frame, [{ p: [EX - 6.2, 3.05, EZ + 4.4] }, { p: [EX + 6.2, 3.05, EZ + 4.4] }]));
  const downlight = new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1d8").multiplyScalar(2.5) });
  const dl: { p: [number, number, number]; r: [number, number, number] }[] = [];
  for (let i = 0; i < 5; i++) for (const dz of [1.2, 3.4]) dl.push({ p: [EX - 6 + i * 3, 6.08, EZ + dz], r: [Math.PI / 2, 0, 0] });
  bld.add(instances(new THREE.CircleGeometry(0.16, 16), downlight, dl, false));
  const canopyGlow = new THREE.SpotLight("#ffe2b8", 70, 14, 1.0, 0.8, 1.5);
  canopyGlow.position.set(EX, 6.0, EZ + 2.5);
  canopyGlow.target.position.set(EX, 0, EZ + 3.5);
  bld.add(canopyGlow, canopyGlow.target);

  // Loading docks on the production block (three bays): shelters, roller doors, levellers, bollards, canopy, lamps.
  const dockXs = [-37, -30, -23];
  for (const x of dockXs) {
    const door = new THREE.Mesh(worldUV(new THREE.BoxGeometry(3.4, 3.6, 0.12), 1), slats);
    door.position.set(x, 1.8 + 1.1, -20.94);
    door.castShadow = door.receiveShadow = true;
    bld.add(door);
    bld.add(slab(0.4, 4.2, 0.6, rubber, x - 1.95, 3.2, -20.7, 1));
    bld.add(slab(0.4, 4.2, 0.6, rubber, x + 1.95, 3.2, -20.7, 1));
    bld.add(slab(4.3, 0.6, 0.6, rubber, x, 5.0, -20.7, 1));
    bld.add(slab(3.2, 0.12, 1.8, galv, x, 1.12, -20.1, 1)); // dock leveller
    bld.add(slab(3.6, 1.1, 0.5, rubber, x, 0.55, -20.75, 1)); // bumpers/apron face
  }
  bld.add(slab(26, 0.3, 3.2, frame, -30, 6.0, -19.4, 2)); // dock canopy
  const bollards: { p: [number, number, number] }[] = [];
  for (const x of dockXs) for (const dx of [-2.2, 2.2]) bollards.push({ p: [x + dx, 0.55, -19.6] });
  bld.add(instances(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 14), yellow, bollards));
  const dockLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a8").multiplyScalar(2) });
  bld.add(instances(new THREE.BoxGeometry(0.4, 0.12, 0.2), dockLamp, dockXs.map((x) => ({ p: [x, 5.65, -19.0] as [number, number, number] })), false));

  // Rooftop plant (top of the production block at y ≈ 11.35): AHUs with louvres, ducts, chillers, stacks, handrails.
  const roofY = 11.35;
  for (const [x, z, w] of [[-28, -36, 9], [-12, -38, 8], [6, -35, 7]] as const) {
    const ahu = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, 2.6, 3.6), 1), louvre);
    ahu.position.set(x, roofY + 1.3, z);
    ahu.castShadow = ahu.receiveShadow = true;
    bld.add(ahu);
    bld.add(slab(w + 0.2, 0.15, 3.8, galv, x, roofY + 2.68, z, 2)); // roof cap
    bld.add(slab(w + 0.4, 0.3, 4.0, concrete, x, roofY + 0.15, z, 2)); // plinth
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 24), galv);
    fan.position.set(x + w / 2 - 1.2, roofY + 3.0, z);
    fan.castShadow = true;
    bld.add(fan);
  }
  // Ducts linking the AHUs (galvanised, with flange joints every 2 m).
  for (const [x0, x1, z] of [[-23.5, -16, -36.5], [-8, 2.5, -36.5]] as const) {
    bld.add(slab(x1 - x0, 1.0, 1.0, galv, (x0 + x1) / 2, roofY + 1.6, z, 1));
    const flanges: { p: [number, number, number] }[] = [];
    for (let x = x0 + 1; x < x1; x += 2) flanges.push({ p: [x, roofY + 1.6, z] });
    bld.add(instances(new THREE.BoxGeometry(0.06, 1.12, 1.12), galv, flanges));
  }
  // Chiller: a long unit with four fan shrouds on top.
  bld.add(slab(10, 2.0, 2.6, louvre, 20, roofY + 1.0, -42, 1));
  bld.add(instances(new THREE.CylinderGeometry(0.85, 0.85, 0.35, 24), new THREE.MeshStandardMaterial({ color: "#2a2e33", roughness: 0.6, metalness: 0.5 }), [16.4, 18.8, 21.2, 23.6].map((x) => ({ p: [x, roofY + 2.15, -42] as [number, number, number] }))));
  // Exhaust stacks with rain caps.
  for (const [x, z, h] of [[-36, -44, 7], [-33.5, -44, 5.5]] as const) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, h, 24), galv);
    st.position.set(x, roofY + h / 2, z);
    st.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 24), galv);
    cap.position.set(x, roofY + h + 0.45, z);
    bld.add(st, cap);
  }
  // Roof-edge handrail along the front of the production block.
  const rails: { p: [number, number, number] }[] = [];
  for (let x = -42.5; x <= 26.5; x += 1.5) rails.push({ p: [x, roofY + 0.55 + 0.18, -21.6] });
  bld.add(instances(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), galv, rails));
  for (const y of [0.55, 1.1]) bld.add(instances(new THREE.CylinderGeometry(0.03, 0.03, 69, 8), galv, [{ p: [-8, roofY + 0.18 + y, -21.6], r: [0, 0, Math.PI / 2] }]));
  bld.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
  scene.add(bld);

  // ---------- Gatehouse and barrier at the site entrance ----------
  const gate = new THREE.Group();
  gate.add(slab(3.2, 2.6, 2.6, cladding, 23.5, 1.3, 19.5, 1.5));
  gate.add(slab(3.9, 0.22, 3.3, frame, 23.5, 2.72, 19.5, 2));
  const gateInner = new THREE.MeshStandardMaterial({ color: "#2a2018", emissive: new THREE.Color("#f0c890"), emissiveIntensity: 0.6, roughness: 1 });
  for (const [x, z, ry] of [[21.88, 19.5, -Math.PI / 2], [23.5, 20.82, 0]] as const) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), gateInner);
    win.position.set(x, 1.55, z);
    win.rotation.y = ry;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), glass);
    gl.position.set(x + (ry ? -0.02 : 0), 1.55, z + (ry ? 0 : 0.02));
    gl.rotation.y = ry;
    gate.add(win, gl);
  }
  gate.add(slab(0.3, 1.0, 0.3, darkPanel, 20.3, 0.5, 19.0, 1)); // barrier post
  const armTex = drawTexture(256, 8, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#e8e6e0" : "#b8302a"; g.fillRect(i * 32, 0, 32, 8); } });
  const arm = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.1, 0.1), new THREE.MeshStandardMaterial({ map: armTex, roughness: 0.5 }));
  arm.position.set(17.0, 0.92, 19.0);
  arm.castShadow = true;
  gate.add(arm);
  gate.add(instances(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 14), yellow, [{ p: [21.5, 0.45, 21.6] }, { p: [25.5, 0.45, 21.6] }]));
  scene.add(gate);

  // ---------- Lamp posts (tapered columns, cantilever luminaires) ----------
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, 7, 12);
  const armGeo = new THREE.BoxGeometry(1.4, 0.08, 0.12);
  const headGeo = new RoundedBoxGeometry(0.8, 0.09, 0.28, 2, 0.03);
  const lensGeo = new THREE.PlaneGeometry(0.66, 0.18);
  const poleMat = new THREE.MeshStandardMaterial({ ...brushedSet([70, 74, 80]), metalness: 0.6 });
  const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe1b0").multiplyScalar(2.4) });
  const lamps: [number, number][] = [[-44, 16.6], [-28, 16.6], [-12, 16.6], [6, 16.6], [30, 24], [44, 24], [34, 30.8], [14, 14]];
  scene.add(instances(poleGeo, poleMat, lamps.map(([x, z]) => ({ p: [x, 3.5, z] as [number, number, number] }))));
  scene.add(instances(armGeo, poleMat, lamps.map(([x, z]) => ({ p: [x - 0.6, 6.95, z] as [number, number, number] }))));
  scene.add(instances(headGeo, poleMat, lamps.map(([x, z]) => ({ p: [x - 1.3, 6.9, z] as [number, number, number] }))));
  scene.add(instances(lensGeo, lens, lamps.map(([x, z]) => ({ p: [x - 1.3, 6.85, z] as [number, number, number], r: [Math.PI / 2, 0, 0] as [number, number, number] })), false));

  // ---------- Landscaping: clipped shrubs in beds, a few young trees, a perimeter fence ----------
  const shrubGeo = mergeVertices(new THREE.IcosahedronGeometry(0.7, 3));
  {
    const p = shrubGeo.attributes.position as THREE.BufferAttribute;
    const n = fbm([4, 9, 18]);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const k = 0.72 + n(v.x * 0.35 + 0.5, v.z * 0.35 + v.y * 0.25 + 0.5) * 0.6;
      p.setXYZ(i, v.x * k, v.y * k * 0.75, v.z * k);
    }
    shrubGeo.computeVertexNormals();
  }
  const leafSet = grassSet();
  leafSet.normalMap.repeat.set(3, 3);
  const leaf = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, normalMap: leafSet.normalMap, normalScale: new THREE.Vector2(2.2, 2.2) });
  const shrubs: { p: [number, number, number]; r: [number, number, number]; s: [number, number, number] }[] = [];
  const bed = (x0: number, x1: number, z: number) => { for (let x = x0; x < x1; x += 1.1) { const s = 0.8 + rnd() * 0.5; shrubs.push({ p: [x + rnd() * 0.4, 0.42 * s, z + rnd() * 0.6], r: [0, rnd() * 6, 0], s: [s, s, s] }); } };
  bed(-6, -1.5, -11.5); bed(5.5, 10, -11.5); bed(10, 38, -15.6); bed(-60, -42, 16.5); bed(22, 24, 22.4);
  const shrubMesh = instances(shrubGeo, leaf, shrubs);
  const tint = new THREE.Color();
  shrubs.forEach((_, i) => shrubMesh.setColorAt(i, tint.setHSL(0.24 + rnd() * 0.06, 0.26 + rnd() * 0.08, 0.2 + rnd() * 0.05, THREE.SRGBColorSpace)));
  scene.add(shrubMesh);
  // Young trees in the entrance planters (clear stems, layered crowns).
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#4a4038", roughness: 1 });
  const crowns: { p: [number, number, number]; r: [number, number, number]; s: [number, number, number] }[] = [];
  for (const [x, z] of [[-5.5, -11.4], [9.5, -11.4], [14, -15.4], [36, -15.4]] as const) {
    scene.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 10), trunkMat), { castShadow: true }).translateX(x).translateY(1.6).translateZ(z));
    for (let k = 0; k < 6; k++) {
      const s = 1.2 + rnd() * 0.6;
      crowns.push({ p: [x + (rnd() - 0.5) * 1.6, 3.6 + rnd() * 1.6, z + (rnd() - 0.5) * 1.6], r: [rnd(), rnd() * 6, rnd()], s: [s, s * 0.9, s] });
    }
  }
  const crownMesh = instances(shrubGeo, leaf, crowns);
  crowns.forEach((_, i) => crownMesh.setColorAt(i, tint.setHSL(0.23 + rnd() * 0.05, 0.24, 0.19 + rnd() * 0.05, THREE.SRGBColorSpace)));
  scene.add(crownMesh);
  // Perimeter fence (powder-coated posts + mesh panels) behind the road.
  const fencePosts: { p: [number, number, number] }[] = [];
  for (let x = -120; x < 170; x += 2.5) fencePosts.push({ p: [x, 1.0, 44] });
  scene.add(instances(new THREE.BoxGeometry(0.06, 2.0, 0.06), poleMat, fencePosts));
  const meshTex = drawTexture(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.strokeStyle = "rgba(60,66,72,1)"; g.lineWidth = 3; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } });
  meshTex.repeat.set(290 / 0.2, 2 / 0.2);
  const fence = new THREE.Mesh(new THREE.PlaneGeometry(290, 2), new THREE.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }));
  fence.position.set(25, 1.0, 44);
  scene.add(fence);
  // Distant tree belt behind the site (soft, hazy layers).
  const beltGeo = new THREE.IcosahedronGeometry(1, 1);
  const belt: { p: [number, number, number]; r: [number, number, number]; s: [number, number, number] }[] = [];
  for (let i = 0; i < 70; i++) { const s = 4 + rnd() * 5; belt.push({ p: [-140 + i * 4.6 + rnd() * 3, s * 0.95, -92 - rnd() * 26], r: [0, rnd() * 6, 0], s: [s, s * 1.35, s] }); }
  scene.add(instances(beltGeo, new THREE.MeshStandardMaterial({ color: "#2f3b36", roughness: 1, flatShading: false }), belt, false));

  // ---------- The distant car (secondary): a dark saloon crossing the forecourt, dipped beams ----------
  const vehicle = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 0.3, metalness: 0.6 });
  const tint2 = new THREE.MeshStandardMaterial({ color: "#07090c", roughness: 0.1, metalness: 0.3 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(4.9, 0.72, 1.86, 4, 0.22), paint);
  body.position.y = 0.66;
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.52, 1.66, 4, 0.24), tint2);
  cabin.position.set(0.15, 1.22, 0);
  vehicle.add(body, cabin);
  const tyreGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18);
  for (const [x, z] of [[-1.55, -0.82], [-1.55, 0.82], [1.5, -0.82], [1.5, 0.82]] as const) {
    const t = new THREE.Mesh(tyreGeo, rubber);
    t.rotation.x = Math.PI / 2;
    t.position.set(x, 0.34, z);
    vehicle.add(t);
  }
  const beam = new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3e0").multiplyScalar(5) });
  for (const z of [-0.66, 0.66]) {
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.12, 0.34, 2, 0.03), beam);
    h.position.set(2.44, 0.78, z);
    vehicle.add(h);
  }
  vehicle.traverse((o) => { o.castShadow = true; });
  scene.add(vehicle);

  return {
    scene,
    vehicle,
    dispose() { envRT.dispose(); },
  };
}
