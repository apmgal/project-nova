import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  brushedSet, carpetSet, ceilingSet, drawTexture, fabricSet, linenSet, oakSet, planeUV, plasterSet, rnd, worldUV,
} from "./textures";

/**
 * The inspection room — built to double as the Act 6 gameplay room. Layout (metres): the table runs along
 * x; window wall at z = -3.2, glazed partition onto the corridor at z = +3.2, head wall (slat feature wall,
 * display, entrance door) at x = -4.6, foot wall at x = +4.6. Floor at y = 0, ceiling at 2.85.
 */

export const ROOM = { W: 9.2, D: 6.4, H: 2.85, tableY: 0.74 } as const;
/** Where the inspection dossier lies (head of the table) — the director frames shot 3 on this. */
export const DOSSIER_POS = new THREE.Vector3(-2.74, ROOM.tableY + 0.0225, -0.04);

export interface Room {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  /** Entrance door: 0 = closed … 1 = ajar. */
  setDoor(open: number): void;
  dispose(): void;
}

const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

/** A soft, bevelled cushion (extruded rounded rectangle), optionally curved around the vertical axis. */
function cushion(w: number, h: number, depth: number, bevel: number, curve = 0) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.min(w, h) * 0.12), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  if (curve) {
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + curve * p.getX(i) * p.getX(i));
    g.computeVertexNormals();
  }
  return g;
}

/** Ergonomic meeting chair. Local frame: seat front faces -z, backrest towards +z; floor at y = 0. */
function buildChair(fabric: THREE.Material, shell: THREE.Material, alu: THREE.Material, black: THREE.Material) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(cushion(0.5, 0.47, 0.04, 0.022), fabric);
  seat.rotation.x = -Math.PI / 2;
  seat.position.set(0, 0.47, -0.01);
  const seatPan = new THREE.Mesh(cushion(0.48, 0.45, 0.01, 0.008), shell);
  seatPan.rotation.x = -Math.PI / 2;
  seatPan.position.set(0, 0.432, -0.01);
  const back = new THREE.Mesh(cushion(0.46, 0.55, 0.035, 0.02, 0.35), fabric);
  back.position.set(0, 0.86, 0.245);
  back.rotation.x = -0.14;
  const backShell = new THREE.Mesh(cushion(0.47, 0.56, 0.008, 0.006, 0.35), shell);
  backShell.position.set(0, 0.86, 0.275);
  backShell.rotation.x = -0.14;
  // Spine linking seat and back.
  const spine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.43, 0.12), new THREE.Vector3(0, 0.46, 0.27), new THREE.Vector3(0, 0.62, 0.3),
  ]), 16, 0.022, 10, false), shell);
  // Mechanism, gas lift and shroud.
  const mech = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.24, 2, 0.015), black);
  mech.position.set(0, 0.395, 0.0);
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 16), alu);
  lift.position.y = 0.3;
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 16), black);
  shroud.position.y = 0.17;
  g.add(seat, seatPan, back, backShell, spine, mech, lift, shroud);
  // Looped armrests with soft pads.
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.2, 0.44, 0.13), new THREE.Vector3(side * 0.25, 0.56, 0.12),
      new THREE.Vector3(side * 0.255, 0.655, 0.06), new THREE.Vector3(side * 0.255, 0.66, -0.1),
    ]), 24, 0.013, 10, false), shell);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.026, 0.25, 3, 0.011), black);
    pad.position.set(side * 0.255, 0.675, -0.03);
    g.add(arm, pad);
  }
  // Five-star base: tapered polished spokes, twin-wheel castors.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.024, 0.29, 10), alu);
    spoke.rotation.z = Math.PI / 2 - 0.08;
    const holder = new THREE.Group();
    holder.rotation.y = -a;
    spoke.position.set(0.15, 0.085, 0);
    holder.add(spoke);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10), black);
    housing.position.set(0.29, 0.065, 0);
    holder.add(housing);
    for (const dz of [-0.012, 0.012]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.01, 16), black);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(0.3, 0.025, dz);
      holder.add(wheel);
    }
    g.add(holder);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Commissioning-readiness dossier cover (print on navy bookcloth). */
function dossierCover() {
  return drawTexture(1024, 1352, (g) => {
    g.fillStyle = "#17233a";
    g.fillRect(0, 0, 1024, 1352);
    const ink = "#ebe7dc";
    g.fillStyle = "#9fae63";
    g.fillRect(96, 132, 4, 214);
    g.fillStyle = ink;
    g.textBaseline = "alphabetic";
    g.font = "600 34px Helvetica, Arial, sans-serif";
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "6px";
    g.fillText("NOVA PHARMACEUTICAL FACILITY", 132, 170);
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "1px";
    g.font = "700 74px Helvetica, Arial, sans-serif";
    g.fillText("COMMISSIONING", 128, 262);
    g.fillText("READINESS", 128, 340);
    g.font = "400 40px Helvetica, Arial, sans-serif";
    g.fillStyle = "rgba(235,231,220,0.9)";
    g.fillText("Quality & Regulatory Evidence Dossier", 132, 420);
    g.fillStyle = "rgba(235,231,220,0.35)";
    g.fillRect(132, 470, 760, 2);
    // Lower block: copy status.
    g.strokeStyle = "rgba(235,231,220,0.85)";
    g.lineWidth = 3;
    g.strokeRect(132, 1040, 420, 84);
    g.fillStyle = ink;
    g.font = "700 36px Helvetica, Arial, sans-serif";
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "5px";
    g.fillText("INSPECTION COPY", 158, 1096);
    g.font = "600 26px Helvetica, Arial, sans-serif";
    g.fillStyle = "#c9b27a";
    g.fillText("CONTROLLED DOCUMENT", 132, 1182);
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "1px";
    g.font = "400 22px Helvetica, Arial, sans-serif";
    g.fillStyle = "rgba(235,231,220,0.6)";
    g.fillText("Doc. NOVA-QA-CRD-001  ·  Rev. 03", 132, 1228);
    // Subtle wear: slightly lighter corners and edge rub.
    const grd = g.createRadialGradient(512, 676, 300, 512, 676, 900);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(1, "rgba(255,255,255,0.05)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 1352);
  });
}

/** Ruled notepad page / printed report page. */
const notepadTex = () => drawTexture(256, 362, (g) => {
  g.fillStyle = "#f5f3ec"; g.fillRect(0, 0, 256, 362);
  g.fillStyle = "rgba(130,160,190,0.55)"; for (let y = 44; y < 350; y += 13) g.fillRect(14, y, 228, 1);
  g.fillStyle = "rgba(200,90,90,0.45)"; g.fillRect(34, 0, 1, 362);
  g.fillStyle = "#2d3138"; g.fillRect(0, 0, 256, 10);
});
const reportTex = () => drawTexture(256, 362, (g) => {
  g.fillStyle = "#f4f3ef"; g.fillRect(0, 0, 256, 362);
  g.fillStyle = "#1c2738"; g.fillRect(22, 22, 212, 3);
  g.fillStyle = "rgba(28,39,56,0.85)"; g.fillRect(22, 36, 110, 8);
  g.fillStyle = "rgba(30,34,44,0.42)";
  for (let y = 62; y < 330; y += 8) { if (rnd() < 0.1) { y += 6; continue; } g.fillRect(22, y, 140 + rnd() * 72, 2.5); }
});
const pageEdgesTex = () => drawTexture(64, 256, (g) => {
  g.fillStyle = "#ecebe5"; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(120,118,110,${0.08 + rnd() * 0.12})`; g.fillRect(0, y, 64, 1); }
});

/** A bright, softly over-exposed morning view through the glazing (sky, a far site, trees), drawn procedurally. */
const viewTexture = () => drawTexture(1024, 400, (g) => {
  const sky = g.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, "#c2d0e2"); sky.addColorStop(0.55, "#eaeef2"); sky.addColorStop(0.72, "#f3f1ec"); sky.addColorStop(1, "#d3d6d0");
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 400);
  g.fillStyle = "rgba(156,168,176,0.65)";
  for (let x = 0; x < 1024; x += 9) { g.beginPath(); g.arc(x, 262 + rnd() * 8, 8 + rnd() * 14, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(178,186,194,0.85)"; g.fillRect(90, 222, 300, 52); g.fillRect(640, 206, 300, 68);
  g.fillStyle = "rgba(160,170,180,0.8)"; for (let x = 100; x < 380; x += 26) g.fillRect(x, 236, 14, 6);
  g.fillStyle = "#cfd2cc"; g.fillRect(0, 274, 1024, 126);
});

export function buildRoom(pmrem: THREE.PMREMGenerator): Room {
  const { W, D, H, tableY } = ROOM;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e4e8ee");
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.3;

  // ---------- Materials ----------
  const plasterMat = new THREE.MeshStandardMaterial({ ...plasterSet() });
  const carpetMat = new THREE.MeshStandardMaterial({ ...carpetSet() });
  const ceilMat = new THREE.MeshStandardMaterial({ ...ceilingSet() });
  const alu = new THREE.MeshStandardMaterial({ ...brushedSet([176, 180, 186]), metalness: 0.85 });
  const aluDark = new THREE.MeshStandardMaterial({ ...brushedSet([66, 70, 76]), metalness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.55 });
  const oak = oakSet();
  const oakTop = (repeatU: number, repeatV: number, rotate = 0) => {
    const rep = (t: THREE.Texture) => { const c = t.clone(); c.repeat.set(repeatU, repeatV); c.rotation = rotate; c.needsUpdate = true; return c; };
    return new THREE.MeshPhysicalMaterial({
      map: rep(oak.map), normalMap: rep(oak.normalMap), roughnessMap: oak.roughnessMap ? rep(oak.roughnessMap) : null,
      normalScale: new THREE.Vector2(0.18, 0.18), clearcoat: 0.1, clearcoatRoughness: 0.5,
    });
  };
  const fabric = new THREE.MeshPhysicalMaterial({ ...fabricSet([58, 64, 76]), sheen: 0.6, sheenColor: new THREE.Color("#8a93a3"), sheenRoughness: 0.8 });
  (fabric.map as THREE.Texture).repeat.set(14, 14);
  (fabric.normalMap as THREE.Texture).repeat.set(14, 14);
  const shellMat = new THREE.MeshStandardMaterial({ color: "#26292f", roughness: 0.45 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: "#f4f8fa", roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 0.9, depthWrite: false });

  const plane = (w: number, h: number, mat: THREE.Material, pos: [number, number, number], rot: [number, number, number], tile?: number) => {
    const m = new THREE.Mesh(tile ? planeUV(new THREE.PlaneGeometry(w, h), tile) : new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const blk = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, tile = 1.5) => {
    const m = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), tile), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, items: [number, number, number][], rot?: [number, number, number]) => {
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const o = new THREE.Object3D();
    items.forEach((p, i) => { o.position.set(...p); if (rot) o.rotation.set(...rot); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // ---------- Shell ----------
  plane(W, D, carpetMat, [0, 0, 0], [-Math.PI / 2, 0, 0], 1);
  plane(W, D, ceilMat, [0, H, 0], [Math.PI / 2, 0, 0], 1.2);
  blk(0.12, H, D, plasterMat, W / 2 + 0.06, H / 2, 0); // foot wall
  // Head wall in two parts around the entrance door (door opening z 1.85..2.85).
  blk(0.12, H, 5.05, plasterMat, -W / 2 - 0.06, H / 2, -0.675);
  blk(0.12, H, 0.35, plasterMat, -W / 2 - 0.06, H / 2, 3.025);
  blk(0.12, H - 2.2, 1.0, plasterMat, -W / 2 - 0.06, 2.2 + (H - 2.2) / 2, 2.35);
  // Shadow-gap skirting and ceiling trims (anodised aluminium).
  blk(0.015, 0.06, D, aluDark, W / 2 - 0.008, 0.03, 0);
  blk(0.015, 0.06, 4.0, aluDark, -W / 2 + 0.008, 0.03, -1.2);
  blk(W, 0.02, 0.02, alu, 0, H - 0.01, -D / 2 + 0.01);

  // ---------- Ceiling services: recessed linear luminaires, diffusers, sprinklers ----------
  const diffuserMat = new THREE.MeshStandardMaterial({ color: "#fbf8f2", emissive: new THREE.Color("#fff3e2"), emissiveIntensity: 0.9, roughness: 0.6 });
  for (const x of [-2.4, 0, 2.4]) {
    blk(1.24, 0.02, 0.24, alu, x, H - 0.012, 0);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.18), diffuserMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, H - 0.024, 0);
    scene.add(lens);
  }
  const grille = drawTexture(128, 128, (g) => {
    g.fillStyle = "#e9e9e6"; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(120,120,118,0.6)"; g.lineWidth = 2;
    for (let i = 8; i < 64; i += 9) g.strokeRect(i, i, 128 - i * 2, 128 - i * 2);
  });
  for (const [x, z] of [[-3.0, 1.9], [3.0, -1.9]] as const) plane(0.58, 0.58, new THREE.MeshStandardMaterial({ map: grille, roughness: 0.7 }), [x, H - 0.006, z], [Math.PI / 2, 0, 0]);
  const sprinklers: [number, number, number][] = [];
  for (const x of [-3.6, -1.2, 1.2, 3.6]) for (const z of [-1.8, 1.8]) sprinklers.push([x, H - 0.02, z]);
  inst(new THREE.CylinderGeometry(0.018, 0.024, 0.04, 12), alu, sprinklers);
  inst(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20), new THREE.MeshStandardMaterial({ color: "#f2f2ef", roughness: 0.6 }), [[0.9, H - 0.01, 1.4]]); // smoke detector

  // ---------- Window wall (z = -D/2): clear full-height glazing, slim mullions, manifestation, blinds ----------
  const wz = -D / 2, bays = 8, bayW = W / bays;
  const posts: [number, number, number][] = [];
  for (let i = 0; i <= bays; i++) posts.push([-W / 2 + i * bayW, H / 2, wz]);
  inst(new THREE.BoxGeometry(0.05, H, 0.1), aluDark, posts);
  blk(W, 0.08, 0.16, aluDark, 0, 0.04, wz); // sill track
  blk(W, 0.12, 0.2, aluDark, 0, H - 0.06, wz + 0.04); // head + blind box
  plane(W, H, glassMat, [0, H / 2, wz - 0.01], [0, 0, 0]);
  const manifest = drawTexture(512, 32, (g) => {
    g.clearRect(0, 0, 512, 32);
    g.fillStyle = "rgba(255,255,255,0.75)";
    for (let x = 2; x < 512; x += 6) for (let y = 4; y < 28; y += 6) { g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); }
  });
  manifest.repeat.set(W / 1.5, 1);
  plane(W, 0.14, new THREE.MeshStandardMaterial({ map: manifest, transparent: true, roughness: 0.6, depthWrite: false }), [0, 1.2, wz + 0.005], [0, 0, 0]);
  const blindMat = new THREE.MeshStandardMaterial({ color: "#efebe3", emissive: new THREE.Color("#d9d3c6"), emissiveIntensity: 0.28, roughness: 0.95, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
  const drops = [0.42, 0.6, 0.3, 0.5, 0.75, 0.38, 0.55, 0.34];
  for (let i = 0; i < bays; i++) {
    const x = -W / 2 + (i + 0.5) * bayW;
    const b = plane(bayW - 0.08, drops[i], blindMat, [x, H - 0.13 - drops[i] / 2, wz + 0.08], [0, 0, 0]);
    b.castShadow = true;
    blk(bayW - 0.06, 0.03, 0.02, aluDark, x, H - 0.13 - drops[i], wz + 0.08);
  }
  const view = new THREE.Mesh(new THREE.PlaneGeometry(44, 16), new THREE.MeshBasicMaterial({ map: viewTexture(), toneMapped: false, fog: false, color: new THREE.Color(1.02, 1.02, 1.02) }));
  view.position.set(0, 3.2, wz - 10);
  scene.add(view);

  // ---------- Glazed partition onto the corridor (z = +D/2), with frosted manifestation ----------
  const pz = D / 2;
  const pPosts: [number, number, number][] = [];
  for (let i = 0; i <= 8; i++) pPosts.push([-W / 2 + i * (W / 8), H / 2, pz]);
  inst(new THREE.BoxGeometry(0.045, H, 0.08), alu, pPosts);
  blk(W, 0.06, 0.1, alu, 0, 0.03, pz);
  blk(W, 0.06, 0.1, alu, 0, H - 0.03, pz);
  plane(W, H, glassMat, [0, H / 2, pz], [0, Math.PI, 0]);
  const frostBand = drawTexture(512, 64, (g) => {
    g.clearRect(0, 0, 512, 64);
    g.fillStyle = "rgba(246,247,248,0.85)";
    g.fillRect(0, 0, 512, 44);
    g.clearRect(0, 18, 512, 4);
  });
  frostBand.repeat.set(W / 2, 1);
  plane(W, 0.32, new THREE.MeshStandardMaterial({ map: frostBand, transparent: true, roughness: 0.7, depthWrite: false }), [0, 1.3, pz - 0.006], [0, Math.PI, 0]);
  // Corridor beyond: carpet, an opposite wall with two framed notices, a ceiling light strip.
  plane(W + 2, 1.8, new THREE.MeshStandardMaterial({ ...carpetSet(), color: "#9aa0a8" }), [0, 0.001, pz + 0.95], [-Math.PI / 2, 0, 0], 1);
  blk(W + 2, H, 0.1, plasterMat, 0, H / 2, pz + 1.9);
  for (const x of [-1.6, 1.4]) {
    blk(0.62, 0.85, 0.02, aluDark, x, 1.5, pz + 1.84);
    plane(0.56, 0.79, new THREE.MeshStandardMaterial({ map: reportTex(), roughness: 0.8 }), [x, 1.5, pz + 1.828], [0, Math.PI, 0]);
  }
  plane(W, 0.12, diffuserMat, [0, H - 0.01, pz + 0.95], [Math.PI / 2, 0, 0]);
  const corridorLight = new THREE.PointLight("#fff2e0", 3.5, 7, 1.6);
  corridorLight.position.set(0, H - 0.3, pz + 0.95);
  scene.add(corridorLight);

  // ---------- Head wall: slat feature wall, display, low credenza, the entrance door ----------
  const hx = -W / 2;
  blk(0.02, H - 0.14, 4.1, new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 1 }), hx + 0.01, H / 2, -0.95); // felt backing
  const slatMat = oakTop(0.3, 1.2);
  const slatGeo = new RoundedBoxGeometry(0.036, H - 0.16, 0.026, 2, 0.008);
  const slatPos: [number, number, number][] = [];
  for (let z = -2.95; z <= 1.05; z += 0.068) slatPos.push([hx + 0.04, H / 2, z]);
  inst(slatGeo, slatMat, slatPos);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.98, 1.72, 2, 0.008), black);
  bezel.position.set(hx + 0.085, 1.55, -0.95);
  scene.add(bezel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.94), new THREE.MeshPhysicalMaterial({ color: "#07080a", roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15 }));
  screen.position.set(hx + 0.104, 1.55, -0.95);
  screen.rotation.y = Math.PI / 2;
  scene.add(screen);
  blk(0.5, 0.06, 2.4, black, hx + 0.32, 0.08, -0.95); // credenza plinth
  blk(0.48, 0.44, 2.4, oakTop(1, 0.2), hx + 0.33, 0.33, -0.95);
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.03, 32), black);
  puck.position.set(hx + 0.33, 0.57, -0.4);
  scene.add(puck);
  // Entrance door (z 1.85..2.85): oak leaf on a concealed closer, aluminium frame, vertical vision strip.
  blk(0.14, 2.24, 0.05, alu, hx, 1.12, 1.82);
  blk(0.14, 2.24, 0.05, alu, hx, 1.12, 2.88);
  blk(0.14, 0.05, 1.11, alu, hx, 2.215, 2.35);
  const hinge = new THREE.Group();
  hinge.position.set(hx - 0.02, 0, 1.87);
  const leaf = new THREE.Mesh(worldUV(new THREE.BoxGeometry(0.045, 2.18, 0.95), 1.2), oakTop(0.5, 1, Math.PI / 2));
  leaf.position.set(0, 1.09, 0.475);
  leaf.castShadow = leaf.receiveShadow = true;
  const vision = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.3), glassMat);
  vision.position.set(0.024, 1.2, 0.8);
  vision.rotation.y = Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 12), alu);
  handle.position.set(0.05, 1.05, 0.86);
  hinge.add(leaf, vision, handle);
  scene.add(hinge);
  // Vestibule beyond the door: lit so the opening reads when the door is ajar.
  plane(1.4, H, new THREE.MeshStandardMaterial({ ...plasterSet(), emissive: new THREE.Color("#5a4a36"), emissiveIntensity: 0.5 }), [hx - 1.3, H / 2, 2.35], [0, Math.PI / 2, 0]);
  const vestLight = new THREE.PointLight("#ffe2bf", 4, 3, 1.5);
  vestLight.position.set(hx - 0.8, 2.3, 2.35);
  scene.add(vestLight);

  // Foot wall: a glass whiteboard.
  blk(0.03, 1.1, 2.2, new THREE.MeshPhysicalMaterial({ color: "#f6f7f7", roughness: 0.08, clearcoat: 1 }), W / 2 - 0.02, 1.45, -0.3);

  // ---------- Conference table ----------
  const TL = 5.8, TW = 1.45;
  const top = new THREE.Mesh(new RoundedBoxGeometry(TL, 0.042, TW, 4, 0.012), oakTop(TL / 2.4, TW / 0.6));
  top.position.set(-0.2, tableY, 0);
  top.castShadow = top.receiveShadow = true;
  scene.add(top);
  const steel = new THREE.MeshStandardMaterial({ ...brushedSet([44, 47, 52]), metalness: 0.75 });
  for (const x of [-2.1, 1.7]) {
    const legGeo = new RoundedBoxGeometry(0.07, tableY - 0.03, 1.05, 3, 0.02);
    const leg = new THREE.Mesh(legGeo, steel);
    leg.position.set(x, (tableY - 0.03) / 2, 0);
    leg.castShadow = leg.receiveShadow = true;
    scene.add(leg);
    blk(0.1, 0.012, 1.1, steel, x, 0.006, 0);
  }
  blk(3.75, 0.06, 0.1, steel, -0.2, tableY - 0.06, 0); // stretcher
  const port = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.006, 0.12, 2, 0.003), aluDark);
  port.position.set(0.4, tableY + 0.022, 0);
  scene.add(port);

  // ---------- Chairs (shared geometry; slight natural variation in placement) ----------
  const proto = buildChair(fabric, shellMat, alu, black);
  const seats: [number, number, number][] = [];
  for (const x of [-1.85, -0.75, 0.35, 1.45]) { seats.push([x, -1.02, Math.PI]); seats.push([x, 1.02, 0]); }
  seats.push([-3.52, 0, -Math.PI / 2]);
  seats.forEach(([x, z, ry], i) => {
    const c = proto.clone();
    c.position.set(x + ((i * 37) % 7 - 3) * 0.012, 0, z + (((i * 17) % 5) - 2) * 0.02);
    c.rotation.y = ry + (((i * 13) % 5) - 2) * 0.025;
    scene.add(c);
  });

  // ---------- Table settings: notepads, pens, water glasses on coasters, carafe, folders ----------
  const paper = new THREE.MeshStandardMaterial({ map: notepadTex(), roughness: 0.85 });
  const report = new THREE.MeshStandardMaterial({ map: reportTex(), roughness: 0.85 });
  const edges = new THREE.MeshStandardMaterial({ map: pageEdgesTex(), roughness: 0.9 });
  const card = new THREE.MeshStandardMaterial({ color: "#3a3f47", roughness: 0.8 });
  const padMats = [edges, edges, paper, card, edges, edges];
  const glassWater = new THREE.MeshPhysicalMaterial({ color: "#f4f8fb", roughness: 0.03, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false });
  const glassGeo = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.03, 0), new THREE.Vector2(0.032, 0.004), new THREE.Vector2(0.036, 0.1), new THREE.Vector2(0.034, 0.1), new THREE.Vector2(0.03, 0.006), new THREE.Vector2(0, 0.006)], 28);
  const coaster = new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.9 });
  const penGeo = new THREE.CylinderGeometry(0.0045, 0.0035, 0.142, 12);
  const penMat = new THREE.MeshStandardMaterial({ color: "#1b1e24", roughness: 0.35, metalness: 0.5 });
  const place = (x: number, side: number, withGlass: boolean, doc: "pad" | "report") => {
    const zc = side * 0.43;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.008, 0.297), doc === "pad" ? padMats : [edges, edges, report, card, edges, edges]);
    pad.position.set(x, tableY + 0.025, zc);
    pad.rotation.y = side > 0 ? 0.03 : Math.PI - 0.04;
    pad.castShadow = pad.receiveShadow = true;
    scene.add(pad);
    const pen = new THREE.Mesh(penGeo, penMat);
    pen.rotation.set(Math.PI / 2, 0, 0.25 * side);
    pen.position.set(x + 0.15, tableY + 0.026, zc);
    pen.castShadow = true;
    scene.add(pen);
    if (withGlass) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.004, 24), coaster);
      c.position.set(x - 0.2, tableY + 0.023, zc - side * 0.12);
      const gl = new THREE.Mesh(glassGeo, glassWater);
      gl.position.set(x - 0.2, tableY + 0.025, zc - side * 0.12);
      scene.add(c, gl);
    }
  };
  place(-1.85, -1, true, "pad"); place(-1.85, 1, true, "report"); place(-0.75, -1, false, "pad"); place(-0.75, 1, true, "pad");
  place(0.35, 1, false, "report"); place(1.45, -1, true, "pad");
  const carafe = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.055, 0), new THREE.Vector2(0.062, 0.02), new THREE.Vector2(0.062, 0.17), new THREE.Vector2(0.04, 0.23), new THREE.Vector2(0.033, 0.27), new THREE.Vector2(0.035, 0.28)], 32), glassWater);
  carafe.position.set(-0.4, tableY + 0.021, -0.05);
  scene.add(carafe);
  // Neat stack of supporting folders and a stapled report near the head.
  const folderCols = ["#2a3a52", "#59606b", "#2f4566"];
  folderCols.forEach((c, i) => {
    const f = new THREE.Mesh(new RoundedBoxGeometry(0.235, 0.012, 0.31, 2, 0.003), new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 }));
    f.position.set(-2.38, tableY + 0.027 + i * 0.0125, 0.44);
    f.rotation.y = Math.PI / 2 + (i - 1) * 0.02;
    f.castShadow = f.receiveShadow = true;
    scene.add(f);
  });
  const stapled = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.004, 0.297), [edges, edges, report, report, edges, edges]);
  stapled.position.set(-2.4, tableY + 0.023, -0.42);
  stapled.rotation.y = Math.PI / 2 - 0.06;
  stapled.castShadow = stapled.receiveShadow = true;
  scene.add(stapled);
  const laptop = new THREE.Mesh(new RoundedBoxGeometry(0.31, 0.016, 0.22, 3, 0.006), alu);
  laptop.position.set(-2.95, tableY + 0.03, 0.4);
  laptop.rotation.y = Math.PI / 2 - 0.08;
  laptop.castShadow = laptop.receiveShadow = true;
  scene.add(laptop);
  const headPen = new THREE.Mesh(penGeo, penMat);
  headPen.rotation.set(Math.PI / 2, 0, -0.35);
  headPen.position.set(-2.55, tableY + 0.026, -0.25);
  headPen.castShadow = true;
  scene.add(headPen);

  // ---------- The dossier: bookcloth boards, spine, page block with visible edges, index tabs ----------
  const dossier = new THREE.Group();
  const linen = linenSet([24, 36, 58]);
  const cloth = new THREE.MeshStandardMaterial({ ...linen, color: "#ffffff" });
  (cloth.map as THREE.Texture).repeat.set(1, 1);
  const DW = 0.236, DD = 0.316, DT = 0.042;
  const backBoard = new THREE.Mesh(new RoundedBoxGeometry(DW, 0.0035, DD, 2, 0.0012), cloth);
  backBoard.position.y = 0.00175;
  const frontBoard = backBoard.clone();
  frontBoard.position.y = DT - 0.00175;
  const coverPrint = new THREE.Mesh(new THREE.PlaneGeometry(DW - 0.003, DD - 0.003), new THREE.MeshStandardMaterial({ map: dossierCover(), normalMap: linen.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -2 }));
  coverPrint.rotation.x = -Math.PI / 2;
  coverPrint.position.y = DT + 0.00002;
  const spineM = new THREE.Mesh(new RoundedBoxGeometry(0.008, DT, DD, 2, 0.003), cloth);
  spineM.position.set(-DW / 2 + 0.002, DT / 2, 0);
  const block = new THREE.Mesh(new THREE.BoxGeometry(DW - 0.012, DT - 0.008, DD - 0.01), [edges, edges, paper, paper, edges, edges]);
  block.position.set(0.002, DT / 2, 0);
  const tabCols = ["#9fae63", "#c9b27a", "#7d8fa6", "#b08a8a"];
  tabCols.forEach((c, i) => {
    const tab = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.001, 0.028, 1, 0.0004), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    tab.position.set(DW / 2 + 0.002, DT * (0.25 + i * 0.13), -DD / 2 + 0.05 + i * 0.06);
    dossier.add(tab);
  });
  dossier.add(backBoard, frontBoard, coverPrint, spineM, block);
  dossier.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  dossier.position.set(DOSSIER_POS.x, tableY + 0.021, DOSSIER_POS.z);
  dossier.rotation.y = Math.PI / 2 + 0.05; // spine to the inspector's left, title towards the room
  scene.add(dossier);

  // ---------- Light: low morning sun through the glazing, soft sky light, warm interior fill ----------
  const sun = new THREE.DirectionalLight("#ffe8cc", 4.0);
  sun.position.set(-6.5, 5.2, -9.5);
  sun.target.position.set(0.4, 0, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const sky = new THREE.RectAreaLight("#dce7f5", 1.4, W, H);
  sky.position.set(0, H / 2, wz + 0.06);
  sky.lookAt(0, H / 2, 0);
  scene.add(sky);
  scene.add(new THREE.HemisphereLight("#eaf0f6", "#6a655e", 0.28));
  const overhead = new THREE.DirectionalLight("#fff0dc", 0.35);
  overhead.position.set(0.5, 6, 0.3);
  scene.add(overhead);

  return {
    scene,
    sun,
    setDoor(open: number) { hinge.rotation.y = -1.15 * open; },
    dispose() { envRT.dispose(); },
  };
}
