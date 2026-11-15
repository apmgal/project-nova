import type { Application, SPEObject } from "@splinetool/runtime";
import { eyeView, type OrbitConfig } from "@/components/prototype/warehouse/orbitCamera";

/**
 * Act 5 recovery montage — scripted shots on the existing facility scene (no scene edits).
 * Each shot names its room, a start/end camera (eye-level, like the investigation tours), a short
 * neutral caption and a setup() that captures the objects it moves and returns update(t): a pure
 * function of the shot time t (seconds), so every frame is deterministic, plus restore() to put back
 * anything shared (lights, background) before the next room. Objects are moved from their scene
 * rest pose; the montage runs in its own copy of the scene, so nothing here touches the investigation.
 */
export interface MontageShot {
  room: "warehouse" | "production" | "qualityLab";
  duration: number;
  /** Camera at the start of the shot (cut to behind black) and where it glides to. */
  views: { start: OrbitConfig; end: OrbitConfig };
  /** When the glide starts and how long it takes (s). */
  glide: { at: number; duration: number };
  /**
   * Optional camera keyframes instead of the single glide: at each time, a timed glide (same orbit
   * camera, eased in/out) to that view. Keep them from overlapping.
   */
  camera?: { at: number; view: OrbitConfig; duration: number }[];
  /** Subtle on-screen line, deliberately neutral (activity, not outcome). */
  caption: string;
  /** When the caption fades in (s; default 0.8). It always fades out before the shot's fade to black. */
  captionAt?: number;
  /** Optional sequence of captions (each fades in at `from` and out at `to`), instead of the single one. */
  captions?: { text: string; from: number; to: number }[];
  /** CSS sky painted behind the scene for this shot (seen only where the scene is transparent). */
  backdrop?: string;
  setup: (app: Application) => {
    update: (t: number) => void;
    restore?: () => void;
    /** Daylight entering through an opening at time t (drawn as a soft screen-space overlay), or null. */
    beam?: (t: number) => DaylightBeam | null;
  };
}

type Vec3 = { x: number; y: number; z: number };
/** Sunlight through a rectangular opening in a wall facing +z: what the montage's light overlay needs. */
export interface DaylightBeam {
  /** 0..1 overall brightness (follows how far the shutter is open). */
  strength: number;
  /** The open gap on the inside face of the wall: x span, floor height, top of the gap, and z. */
  opening: { x0: number; x1: number; y0: number; y1: number; z: number };
  /** Direction the sunlight travels (into the room and downward); y must be negative. */
  sun: Vec3;
}

/**
 * World-space shapes for a beam: the lit patch on the floor (the gap's outline cast along the sun
 * direction, so it grows as the shutter rises), the soft shaft between the gap and that patch, and a
 * few faint rays inside it.
 */
export function beamShapes(b: DaylightBeam): { patch: Vec3[]; shaft: Vec3[]; rays: Vec3[][]; from: Vec3; to: Vec3 } {
  const { x0, x1, y0, y1, z } = b.opening;
  const cast = (x: number, y: number): Vec3 => {
    const k = (y - y0) / -b.sun.y; // travel along the ray down to the floor
    return { x: x + b.sun.x * k, y: y0, z: z + b.sun.z * k };
  };
  const farL = cast(x0, y1);
  const farR = cast(x1, y1);
  const patch = [{ x: x0, y: y0, z }, { x: x1, y: y0, z }, farR, farL];
  const shaft = [{ x: x0, y: y1, z }, { x: x1, y: y1, z }, farR, farL];
  const rays = [0.14, 0.38, 0.6, 0.83].map((f, i) => {
    const w = 0.035 + 0.015 * (i % 2);
    const a = x0 + (x1 - x0) * (f - w);
    const c = x0 + (x1 - x0) * (f + w);
    return [{ x: a, y: y1, z }, { x: c, y: y1, z }, cast(c, y1), cast(a, y1)];
  });
  const mid = (x0 + x1) / 2;
  return { patch, shaft, rays, from: { x: mid, y: y1, z }, to: cast(mid, y1) };
}

/**
 * The montage's narrative lines, one per room. Deliberately neutral: they say work is happening,
 * never that it has succeeded, is nearly done or is approved.
 */
export const MONTAGE_CAPTIONS = {
  warehouse: "Replacement materials arrive on site.",
  production: "Engineering work continues, with a replacement engineer secured and additional resources mobilised to support recovery.",
  qualityLab: "Testing activities continue as the team assesses the updated filtration system.",
  qualityLabRecords: "Qualification records and supporting documentation remain under review.",
} as const;

/** A shot's captions in order (the single caption becomes one window ending before the fade out). */
export function shotCaptions(shot: MontageShot): { text: string; from: number; to: number }[] {
  return shot.captions ?? [{ text: shot.caption, from: shot.captionAt ?? 0.8, to: shot.duration - 1.4 }];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
/** 0 before a, eased 0→1 across [a, b], 1 after. */
const phase = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));

// ---------------------------------------------------------------------------------------------
// Shot 1 — Warehouse: the dock shutter rolls up, the forklift drives the replacement crate in
// through the loading bay, sets it down in the loading zone and backs off.
// ---------------------------------------------------------------------------------------------

/** World position of the forklift group's origin at rest (its parent group only translates). */
const FORKLIFT_REST_WORLD = { x: -1540, z: 170 };
/** The forks point along the forklift's local −x; turning it +90° about y points them at +z (into the hall). */
const FACE_INTO_HALL = Math.PI / 2;
/** Pallet centre ahead of the forklift origin when it sits on the forks (against the carriage face). */
const LOAD_AHEAD = 52;
/** Carry height: the pallet clears the dock bumper sill (top at y≈23). */
const CARRY_LIFT = 30;
/** Start: forklift + crate wholly outside, hidden behind the closed shutter (front face z≈-611). */
const START_Z = -720;
const BACK_OFF = 70; // reverse after setting down, so the forks come clear of the pallet
/** Straight in through the middle of the dock door (x −957), clear of the delivery pallet and Crate A. */
const LANE_X = -957;

const SHUTTER_HEIGHT = 310;
const SHUTTER_SLATS = 14;

// Daylight through the open dock (no scene edits, montage only): a soft sky seen through the doorway
// (CSS behind a transparent 3D background), the warehouse's own fill light moved just outside the dock
// in a warm daylight tone (it sits outside the wall, so the hall's inner walls stay unlit, and its short
// reach keeps the side walls out of it), and a soft sun-shaft overlay drawn by the montage. All follow
// how far the shutter is open, and everything is put back afterwards.
// Soft daytime sky: a slightly deeper pale blue overhead, lighter towards the horizon, warm haze at the horizon.
const DAYLIGHT_SKY =
  "linear-gradient(180deg, #88b0d2 0%, #9fc4e1 22%, #b9d8ed 38%, #cfe2ec 46%, #e4e4d8 51%, #ecdcc0 56%, #e2d1b6 100%)";
const TRANSPARENT = "rgba(0,0,0,0)";
const SCENE_BACKDROP = "#2b2f36"; // the scene's own background colour
const FILL_LIGHT = "WHD Warm Fill Light";
const SPILL = { at: { x: LANE_X, y: 110, z: -690 }, color: "#fff0d9", intensity: 5, distance: 450, decay: 1 }; // warm daylight
/** The dock opening (inside face of the back wall) and the sun's direction through it: high, a little to the side. */
const DOCK_OPENING = { x0: -1107, x1: -807, y0: 0, gapBottom: 9, z: -601 };
const SUN_DIR = { x: 0.2, y: -0.8, z: 0.56 };
type PointLightLike = {
  intensity: number;
  distance: number;
  decay: number;
  position: { x: number; y: number; z: number; clone(): { set(x: number, y: number, z: number): unknown } };
  color: { getHex(): number; set(c: string | number): void };
  parent?: { worldToLocal(v: unknown): { x: number; y: number; z: number } } | null;
};
/** The scene's three.js light behind a Spline light (internal; null if a runtime change hides it). */
function findSceneLight(app: Application, name: string): PointLightLike | null {
  const scene = (app as unknown as { _scene?: { traverse(cb: (o: { name: string; isLight?: boolean }) => void): void } })._scene;
  let found: PointLightLike | null = null;
  try {
    scene?.traverse((o) => { if (!found && o.isLight && o.name === name) found = o as unknown as PointLightLike; });
  } catch { found = null; }
  return found;
}

const WAREHOUSE_SHOT: MontageShot = {
  room: "warehouse",
  duration: 13.8,
  caption: MONTAGE_CAPTIONS.warehouse,
  backdrop: DAYLIGHT_SKY,
  views: {
    // Establishing: just inside the doorway from the Production Floor, facing the closed dock shutter …
    start: eyeView(-700, -30, 20, 6),
    // … gliding slowly to the receiving side, framing the dock door and the loading zone together.
    end: eyeView(-1120, -50, -22, 8),
  },
  glide: { at: 0.9, duration: 4.4 },
  setup(app) {
    const find = (n: string) => app.findObjectByName(n) ?? null;
    const shutter = find("WH Dock Shutter");
    const slats = Array.from({ length: SHUTTER_SLATS }, (_, i) => find(`WH Dock Shutter Slat ${i + 1}`)).filter((o): o is SPEObject => !!o);
    const forklift = find("WHM Forklift");
    const forks = find("WHM Forklift Lift");
    const crate = find("Crate B on Pallet");

    // Rest pose (local to each parent).
    const shutterY = shutter?.position.y ?? 0;
    const shutterSY = shutter?.scale.y ?? 1;
    const slatY = slats.map((o) => o.position.y);
    const slatTop = shutterY + SHUTTER_HEIGHT / 2; // slats share the shutter's parent; panel origin = its centre
    const fl = forklift ? { x: forklift.position.x, z: forklift.position.z, ry: forklift.rotation.y } : null;
    const forksY = forks?.position.y ?? 0;
    // Crate B sits in the loading zone; its parent is the scene root, so local = world.
    const crateRest = crate ? { x: crate.position.x, y: crate.position.y, z: crate.position.z, ry: crate.rotation.y } : null;
    const laneX = LANE_X;
    const endZ = (crateRest?.z ?? -390) - LOAD_AHEAD; // set down level with Crate B's own spot in the loading zone

    // Daylight: the sky shows through the doorway once the shutter opens; the spill light follows it.
    // Position + intensity go through the Spline object; colour and falloff through its three.js light.
    app.setBackgroundColor(TRANSPARENT); // the CSS sky behind the canvas shows through the doorway
    const fillObj = find(FILL_LIGHT);
    const fill = findSceneLight(app, FILL_LIGHT);
    const spill = !!(fillObj && fill?.parent);
    const fillRest = fillObj && fill
      ? { pos: { x: fillObj.position.x, y: fillObj.position.y, z: fillObj.position.z }, intensity: fillObj.intensity, color: fill.color.getHex(), distance: fill.distance, decay: fill.decay }
      : null;
    if (spill && fillObj && fill?.parent) {
      const local = fill.parent.worldToLocal(fill.position.clone().set(SPILL.at.x, SPILL.at.y, SPILL.at.z));
      fillObj.position.x = local.x; fillObj.position.y = local.y; fillObj.position.z = local.z;
      fill.color.set(SPILL.color);
      fill.distance = SPILL.distance;
      fill.decay = SPILL.decay;
    }

    // Timeline (s): 0–1 establishing (shutter closed) · 1–4 shutter rolls up (slow, eased like a real
    // roller shutter) · 4.1–6.6 forklift drives in with the crate, only once the shutter is fully open ·
    // 6.6–8.4 stops, pauses, lowers it · 8.6–10.1 reverses clear of the doorway · 10.4–13.1 the same
    // shutter rolls back down (same easing), daylight fading with it · fully closed before the fade out.
    const openAt = (t: number) => phase(t, 1.0, 4.0) * (1 - phase(t, 10.4, 13.1));
    const update = (t: number) => {
      // Shutter: the curtain's bottom edge rises into the roll above the opening (and back down).
      const open = openAt(t);
      if (spill && fillObj) fillObj.intensity = SPILL.intensity * open;
      if (shutter) {
        const keep = 1 - open;
        shutter.visible = keep > 0.002;
        shutter.scale.y = shutterSY * Math.max(keep, 0.002);
        shutter.position.y = shutterY + (SHUTTER_HEIGHT * open) / 2; // top edge stays put
      }
      slats.forEach((o, i) => {
        const y = slatY[i] + SHUTTER_HEIGHT * open;
        o.position.y = y;
        o.visible = y < slatTop - 2;
      });

      // Forklift: eased start/stop on every move, with a short pause between stopping and lowering.
      const drive = phase(t, 4.1, 6.6);
      const lower = phase(t, 7.1, 8.4);
      const back = phase(t, 8.6, 10.1);
      const carriedZ = START_Z + (endZ - START_Z) * drive;
      const lift = CARRY_LIFT * (1 - lower);
      if (forklift && fl) {
        forklift.position.x = fl.x + (laneX - FORKLIFT_REST_WORLD.x);
        forklift.position.z = fl.z + (carriedZ - BACK_OFF * back - FORKLIFT_REST_WORLD.z);
        forklift.rotation.y = fl.ry + FACE_INTO_HALL;
      }
      if (forks) forks.position.y = forksY + lift;
      if (crate && crateRest) {
        // Rides on the forks until it is set down, then stays on its rest spot (turned to match the forks).
        crate.position.x = laneX;
        crate.position.y = crateRest.y + lift;
        crate.position.z = carriedZ + LOAD_AHEAD;
        crate.rotation.y = crateRest.ry + FACE_INTO_HALL;
      }
      app.requestRender();
    };

    const restore = () => {
      app.setBackgroundColor(SCENE_BACKDROP);
      if (fillObj && fill && fillRest) {
        fillObj.position.x = fillRest.pos.x; fillObj.position.y = fillRest.pos.y; fillObj.position.z = fillRest.pos.z;
        fillObj.intensity = fillRest.intensity;
        fill.color.set(fillRest.color);
        fill.distance = fillRest.distance;
        fill.decay = fillRest.decay;
      }
      app.requestRender();
    };
    const beam = (t: number): DaylightBeam | null => {
      const open = openAt(t);
      if (open < 0.005) return null;
      const { x0, x1, y0, gapBottom, z } = DOCK_OPENING;
      return { strength: open, opening: { x0, x1, y0, y1: gapBottom + SHUTTER_HEIGHT * open, z }, sun: SUN_DIR };
    };
    return { update, restore, beam };
  },
};

// ---------------------------------------------------------------------------------------------
// Shot 2 — Production Floor (~20 s): engineering work at the incomplete filtration unit, using only the
// unit's own parts. Both replacement cartridges are lifted off their pallet and lowered onto the two
// empty mounts; the flange cap is seated on the open inlet flange; the loose pipe spool is slid clear of
// the barrier chain, lifted over it and laid on the skid deck, staged alongside the mounts (positioned,
// not connected); then each cartridge gets a quarter-turn twist-lock. The lockout tag and the chain
// barrier stay exactly as they are, and nothing starts running.
// ---------------------------------------------------------------------------------------------

type P3 = { x: number; y: number; z: number };
// World positions (the filtration group only translates, so world deltas = local deltas).
const CART_HALF_HEIGHT = 20;
const MOUNT_PLATE_TOP = 18; // cartridges sit on the plate, the mount's four studs at their corners
// While carried, the underside clears the side barrier's chain (it runs along x 540 at y ≈ 53–56, right
// beside the cartridge pallet) as well as the mounts' studs (top y 24).
const CART_CARRY_Y = 62 + CART_HALF_HEIGHT;
const ALIGN_YAW = 0.12; // rad: slightly off-square while carried, settled square before lowering
// Cartridge 1 sits right under the chain line (x 523–549), so it's first slid 12 along the pallet, clear
// of it (x 511–537), before it's lifted; cartridge 2 is already outside the barrier.
const CARTRIDGES = [
  { name: "IFU Cartridge Box 1", rest: { x: 536, y: 28, z: 30 }, mount: { x: 400, z: 60 }, yaw: ALIGN_YAW, nudgeX: -12 },
  { name: "IFU Cartridge Box 2", rest: { x: 565, y: 28, z: 30 }, mount: { x: 455, z: 60 }, yaw: -ALIGN_YAW, nudgeX: 0 },
];
// The flange cap starts set aside, lying flat on the skid beside the flange, then goes upright onto it.
const CAP = { seated: { x: 401, y: 40, z: 94 }, aside: { x: 432, y: 15.5, z: 116 }, standOff: 10 };
// The loose pipe spool lies on the floor across the front barrier line (under its chain, top y≈62).
const SPOOL = {
  rest: { x: 440, y: 6, z: 175 }, // lying along x, turned 20° about y
  clear: { x: 415, y: 6, z: 184 }, // slid out square, wholly outside the chain line (z 164–166)
  overY: 75, // underside 69: over the chain
  staged: { x: 415, y: 20, z: 112 }, // on the skid deck (top y 14), x 340–490: clear of the frame post, mounts and ladder
};
const QUARTER_TURN = Math.PI / 2; // twist-lock: a square cartridge ends square again
// Decorative access ladder beside the skid (its rails lean 12° but its rungs don't, so they float
// beside it). It plays no part in the installation, so it's hidden for this shot and shown again after.
const LADDER_PARTS = ["IFU Ladder Rail 1", "IFU Ladder Rail 2", "IFU Ladder Step 1", "IFU Ladder Step 2", "IFU Ladder Step 3", "IFU Ladder Step 4"];

const PRODUCTION_SHOT: MontageShot = {
  room: "production",
  duration: 20,
  caption: MONTAGE_CAPTIONS.production,
  captionAt: 3.2, // during the installation
  views: {
    // Establishing: the Production Floor from behind the tool trolley, the filtration unit beyond.
    start: eyeView(120, 380, -40, 7),
    // Where the observer ends up (also the camera keyframes' last stop).
    end: eyeView(370, 335, -12, 16),
  },
  glide: { at: 0.3, duration: 2.7 },
  camera: [
    // Approach: a close, slightly high view from the front-right of the skid, past the end of the inlet pipe.
    { at: 0.3, view: eyeView(470, 330, 10, 14), duration: 2.7 },
    // Ease right a little for the second mount and the cartridge pallet.
    { at: 6.0, view: eyeView(505, 320, 16, 15), duration: 2.0 },
    // Back and slightly left for the flange cap and the pipe spool — then simply hold here while the
    // twist-locks finish (no push-in).
    { at: 9.8, view: eyeView(440, 340, 6, 16), duration: 1.8 },
    // An observer's slow step or two to the left along the skid: same eye height and pitch, about the
    // same distance (~280) from the assembly, turning just enough to keep it centred; eases to a stop
    // and holds until the fade.
    { at: 16.0, view: eyeView(370, 335, -12, 16), duration: 2.8 },
  ],
  setup(app) {
    const find = (n: string) => app.findObjectByName(n) ?? null;
    type Saved = { o: SPEObject; x: number; y: number; z: number; rx: number; ry: number; rz: number };
    const save = (o: SPEObject | null): Saved | null => (o ? { o, x: o.position.x, y: o.position.y, z: o.position.z, rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z } : null);
    // Place an object at a world point (pure translation from its rest pose).
    const place = (s: Saved, restWorld: P3, w: P3) => {
      s.o.position.x = s.x + (w.x - restWorld.x);
      s.o.position.y = s.y + (w.y - restWorld.y);
      s.o.position.z = s.z + (w.z - restWorld.z);
    };
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const carts = CARTRIDGES.map((c) => ({ ...c, s: save(find(c.name)) }));
    const cap = save(find("IFU Flange Cap"));
    const spool = save(find("IFU Loose Pipe Spool"));
    const spoolYaw = spool?.ry ?? 0; // its scene turn (≈20°); squared to 0 when slid clear
    const ladder = LADDER_PARTS.map(find).filter((o): o is SPEObject => !!o);
    const ladderVisible = ladder.map((o) => o.visible);
    ladder.forEach((o) => { o.visible = false; });

    // Timeline (s): 0–3 establishing + approach · cartridge 1: slid clear of the chain 3.0–3.35, lift
    // 3.35–3.9, across (over the chain) 3.9–4.7, square up 4.7–5.15, lower 5.15–6.0 · cartridge 2: lift
    // 6.2–6.9, across (over the chain) 6.9–7.9, square up 7.9–8.6, lower 8.6–9.8
    // · flange cap: lift + upright 10.0–10.8, onto the flange 11.0–11.6 · pipe spool: slid clear 11.4–12.1,
    // lifted 12.1–12.7, over the chain 12.7–13.5, lowered onto the deck 13.7–14.4 · twist-locks 14.6–15.4
    // and 15.2–16.0 (camera holds) · 16–18.8 a slow sideways step along the skid · hold to 20.
    const cartTimes = [
      { nudge: [3.0, 3.35], lift: [3.35, 3.9], move: [3.9, 4.7], square: [4.7, 5.15], lower: [5.15, 6.0], twist: [14.6, 15.4] },
      { nudge: [6.2, 6.2], lift: [6.2, 6.9], move: [6.9, 7.9], square: [7.9, 8.6], lower: [8.6, 9.8], twist: [15.2, 16.0] },
    ] as const;

    const update = (t: number) => {
      carts.forEach((c, i) => {
        if (!c.s) return;
        const tt = cartTimes[i];
        const nudge = tt.nudge[1] > tt.nudge[0] ? phase(t, tt.nudge[0], tt.nudge[1]) : 0;
        const lift = phase(t, tt.lift[0], tt.lift[1]);
        const move = phase(t, tt.move[0], tt.move[1]);
        const square = phase(t, tt.square[0], tt.square[1]);
        const lower = phase(t, tt.lower[0], tt.lower[1]);
        const twist = phase(t, tt.twist[0], tt.twist[1]);
        const seatedY = MOUNT_PLATE_TOP + CART_HALF_HEIGHT;
        const startX = c.rest.x + c.nudgeX * nudge; // slid along the pallet first (cartridge 1)
        place(c.s, c.rest, {
          x: lerp(startX, c.mount.x, move),
          y: c.rest.y + (CART_CARRY_Y - c.rest.y) * lift + (seatedY - CART_CARRY_Y) * lower,
          z: lerp(c.rest.z, c.mount.z, move),
        });
        c.s.o.rotation.y = c.s.ry + c.yaw * lift * (1 - square) + QUARTER_TURN * twist;
      });
      if (cap) {
        const raise = phase(t, 10.0, 10.8);
        const seat = phase(t, 11.0, 11.6);
        // Lift off the skid while turning upright, to a point just off the flange face; then slide on.
        const offX = CAP.seated.x + CAP.standOff;
        place(cap, CAP.seated, {
          x: lerp(CAP.aside.x, offX, raise) + (CAP.seated.x - offX) * seat,
          y: lerp(CAP.aside.y, CAP.seated.y, raise),
          z: lerp(CAP.aside.z, CAP.seated.z, raise),
        });
        cap.o.rotation.z = cap.rz * raise; // flat (0) while set aside → upright, facing the flange
      }
      if (spool) {
        const slide = phase(t, 11.4, 12.1);
        const up = phase(t, 12.1, 12.7);
        const over = phase(t, 12.7, 13.5);
        const down = phase(t, 13.7, 14.4);
        place(spool, SPOOL.rest, {
          x: lerp(SPOOL.rest.x, SPOOL.clear.x, slide),
          y: SPOOL.rest.y + (SPOOL.overY - SPOOL.rest.y) * up + (SPOOL.staged.y - SPOOL.overY) * down,
          z: lerp(SPOOL.rest.z, SPOOL.clear.z, slide) + (SPOOL.staged.z - SPOOL.clear.z) * over,
        });
        spool.o.rotation.y = spoolYaw * (1 - slide);
      }
      app.requestRender();
    };
    const restore = () => {
      ladder.forEach((o, i) => { o.visible = ladderVisible[i]; });
      for (const s of [...carts.map((c) => c.s), cap, spool]) {
        if (!s) continue;
        s.o.position.x = s.x; s.o.position.y = s.y; s.o.position.z = s.z;
        s.o.rotation.x = s.rx; s.o.rotation.y = s.ry; s.o.rotation.z = s.rz;
      }
      app.requestRender();
    };
    return { update, restore };
  },
};

// ---------------------------------------------------------------------------------------------
// Shot 3 — Quality Laboratory (~15 s): several overlapping, controlled testing activities, using only
// the lab's own objects. At the bench the dissolution tester runs two cycles (head down, hold, part way
// up, pause, down again, left running), the microscope stage makes small focusing adjustments, the
// bench displays refresh as readings update and the sample tray slides into place in front of the
// tester; beyond them the fume-hood sash opens, stays open while the work goes on and closes again
// (the hood is at the far wall, so its whole cycle happens while it's in view from the bench); at the
// qualification workstation the first status bar advances in three small stages, the diagram's
// current-step block pulsing with each update, stopping well short of full. The "On Hold" tag stays,
// nothing shows a pass/fail or approval, and nothing is decided here.
// ---------------------------------------------------------------------------------------------

/**
 * The lab is seen at a standing eye height (130, rather than the tours' 90, which sits level with the
 * 84-high benches and hides what's on them); every camera in this shot uses it, so it stays constant.
 */
const LAB_EYE_Y = 130;
const standingView = (x: number, z: number, azimuth: number, elevation: number): OrbitConfig => {
  const v = eyeView(x, z, azimuth, elevation);
  return { ...v, home: { ...v.home, target: { ...v.home.target, y: LAB_EYE_Y } }, limits: { ...v.limits, target: { ...v.limits.target, y: [LAB_EYE_Y, LAB_EYE_Y] } } };
};

const DISSOLUTION = { name: "LTB Dissolution Head", drop: 11, partRaise: 6 }; // head underside 132 → 121 (vessel tops 120); part way up = 127
const MICROSCOPE_STAGE = "LTB Microscope Stage"; // small focusing moves (±2), never touching the base or arm
const BENCH_DISPLAYS = ["LTB Dissolution Display", "LTB pH Meter Display"]; // brief refresh as a reading updates
const DIAGRAM_STEP = "QWS Diagram Block 2"; // the highlighted (current) step on the workstation's right monitor
const SASH = { names: ["QL Fume Hood Sash", "QL Fume Hood Sash Handle"], rise: 18 }; // stays below the hood header
// The sample tray and its eight slots move together: forward a little (clear of the pH meter, which sits
// behind its left end), then along the bench front to sit in front of the dissolution tester.
const TRAY = {
  names: ["LTB Sample Tray", ...Array.from({ length: 8 }, (_, i) => `LTB Empty Sample Slot ${i + 1}`)],
  forward: 5.5, // z: tray back edge -12 → -6.5, clear of the pH meter (front at z -7)
  along: -76, // x: tray 854–902 → 778–826, centred in front of the tester (755–825)
};
// Status bar 1 on the qualification workstation: 25 of 36 units filled (~69%) → 31 (~86%), never full.
const STATUS_FILL = { name: "QWS Status Fill 1", from: 25, stages: [27.5, 29.5, 31] };

const QUALITY_LAB_SHOT: MontageShot = {
  room: "qualityLab",
  duration: 15,
  caption: MONTAGE_CAPTIONS.qualityLab,
  captions: [
    { text: MONTAGE_CAPTIONS.qualityLab, from: 3.0, to: 8.0 },
    { text: MONTAGE_CAPTIONS.qualityLabRecords, from: 9.0, to: 13.6 },
  ],
  views: {
    // Establishing: inside the entry door, looking across the lab to the testing bench and workstation.
    start: standingView(705, 190, -40, 6),
    // Final observational spot at the qualification workstation (the camera keyframes' last stop).
    end: standingView(1225, 175, -18, 10),
  },
  glide: { at: 1.8, duration: 3.0 },
  camera: [
    // Walk up to the testing bench, standing a little to its right so the fume hood shows beyond the tester.
    { at: 1.8, view: standingView(880, 210, 20, 14), duration: 3.0 },
    // A few steps to the right: the sample tray slides into place, and the fume hood comes into clear view
    // beyond the tester (from here it sits to the tester's right instead of behind it).
    { at: 5.2, view: standingView(960, 214, 25, 12), duration: 2.8 },
    // Over to the qualification workstation (same eye height, about the same distance).
    { at: 8.8, view: standingView(1180, 170, -32, 10), duration: 3.0 },
    // An observer's slow step along the workstation, then hold.
    { at: 12.0, view: standingView(1225, 175, -18, 10), duration: 2.2 },
  ],
  setup(app) {
    const find = (n: string) => app.findObjectByName(n) ?? null;
    const head = find(DISSOLUTION.name);
    const headY = head?.position.y ?? 0;
    const sash = SASH.names.map(find).filter((o): o is SPEObject => !!o);
    const sashY = sash.map((o) => o.position.y);
    const tray = TRAY.names.map(find).filter((o): o is SPEObject => !!o);
    const trayRest = tray.map((o) => ({ x: o.position.x, z: o.position.z }));
    const fill = find(STATUS_FILL.name);
    const fillRest = fill ? { x: fill.position.x, sx: fill.scale.x } : null;
    const stage = find(MICROSCOPE_STAGE);
    const stageY = stage?.position.y ?? 0;
    const displays = BENCH_DISPLAYS.map(find);
    const step = find(DIAGRAM_STEP);
    const stepScale = step ? { x: step.scale.x, y: step.scale.y } : null;
    // A short pulse: 0 → 1 → 0 across [a, b].
    const pulse = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));
    // A display is "refreshing" (briefly dark) inside any of these windows.
    const blink = (t: number, at: number[]) => at.some((a) => t >= a && t < a + 0.16);

    // Timeline (s) — activities overlap; each is placed where the camera can see it:
    //   camera   0–1.8 establishing · 1.8–4.8 to the bench · 5.2–8.0 steps right (hood in view) ·
    //            8.8–11.8 over to the workstation · 12–14.2 a slow step along it · hold to 15
    //   dissolution tester  down 2.2–3.4 · test 3.4–5.0 · part way up 5.0–5.7 · pause · down 6.4–7.0 ·
    //            left running (lowered)
    //   bench displays      refresh at 3.4 (tester), 4.2 (pH), 7.0 (tester), 7.6 (pH)
    //   microscope stage    focusing: up 2.6–3.2, down 4.0–4.6, settle 6.0–6.5
    //   sample tray         forward 4.6–5.1, along the bench 5.2–7.0
    //   fume-hood sash      opens 4.6–6.0 · stays open · closes 7.6–8.8
    //   workstation         status bar stages 9.8–10.6, 11.4–12.1, 12.9–13.5 (≈69% → 76% → 82% → 86%),
    //            the diagram's current-step block pulsing with each update
    const update = (t: number) => {
      if (head) {
        const down = phase(t, 2.2, 3.4) - (DISSOLUTION.partRaise / DISSOLUTION.drop) * (phase(t, 5.0, 5.7) - phase(t, 6.4, 7.0));
        head.position.y = headY - DISSOLUTION.drop * down;
      }
      if (stage) stage.position.y = stageY + 2 * phase(t, 2.6, 3.2) - 3 * phase(t, 4.0, 4.6) + 1 * phase(t, 6.0, 6.5);
      if (displays[0]) displays[0].visible = !blink(t, [3.4, 7.0]);
      if (displays[1]) displays[1].visible = !blink(t, [4.2, 7.6]);
      const s = SASH.rise * (phase(t, 4.6, 6.0) - phase(t, 7.6, 8.8));
      sash.forEach((o, i) => { o.position.y = sashY[i] + s; });
      const fwd = TRAY.forward * phase(t, 4.6, 5.1);
      const along = TRAY.along * phase(t, 5.2, 7.0);
      tray.forEach((o, i) => { o.position.x = trayRest[i].x + along; o.position.z = trayRest[i].z + fwd; });
      if (fill && fillRest) {
        // Grow from the left end (the bar's origin is its centre), in three small stages.
        const [s1, s2, s3] = STATUS_FILL.stages;
        const w = STATUS_FILL.from + (s1 - STATUS_FILL.from) * phase(t, 9.8, 10.6) + (s2 - s1) * phase(t, 11.4, 12.1) + (s3 - s2) * phase(t, 12.9, 13.5);
        fill.scale.x = fillRest.sx * (w / STATUS_FILL.from);
        fill.position.x = fillRest.x + (w - STATUS_FILL.from) / 2;
      }
      if (step && stepScale) {
        const k = 1 + 0.14 * (pulse(t, 9.7, 10.7) + pulse(t, 11.3, 12.2) + pulse(t, 12.8, 13.6));
        step.scale.x = stepScale.x * k;
        step.scale.y = stepScale.y * k;
      }
      app.requestRender();
    };
    const restore = () => {
      if (head) head.position.y = headY;
      if (stage) stage.position.y = stageY;
      displays.forEach((o) => { if (o) o.visible = true; });
      if (step && stepScale) { step.scale.x = stepScale.x; step.scale.y = stepScale.y; }
      sash.forEach((o, i) => { o.position.y = sashY[i]; });
      tray.forEach((o, i) => { o.position.x = trayRest[i].x; o.position.z = trayRest[i].z; });
      if (fill && fillRest) { fill.position.x = fillRest.x; fill.scale.x = fillRest.sx; }
      app.requestRender();
    };
    return { update, restore };
  },
};

/** A shot's camera moves: its keyframes, or the single start → end glide. */
export function cameraKeys(shot: MontageShot): { at: number; view: OrbitConfig; duration: number }[] {
  return shot.camera ?? [{ at: shot.glide.at, view: shot.views.end, duration: shot.glide.duration }];
}

/** The camera a shot shows at time t (same ease as the orbit camera's timed glide) — for review stills. */
export function viewAt(shot: MontageShot, t: number): OrbitConfig {
  let cur = shot.views.start;
  for (const k of cameraKeys(shot)) {
    if (t < k.at) break;
    const u = Math.min(1, Math.max(0, (t - k.at) / k.duration));
    const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const a = cur.home;
    const b = k.view.home;
    const mix = (x: number, y: number) => x + (y - x) * e;
    cur = {
      ...k.view,
      home: {
        azimuth: mix(a.azimuth, a.azimuth + ((((b.azimuth - a.azimuth) % 360) + 540) % 360) - 180),
        elevation: mix(a.elevation, b.elevation),
        distance: mix(a.distance, b.distance),
        target: { x: mix(a.target.x, b.target.x), y: mix(a.target.y, b.target.y), z: mix(a.target.z, b.target.z) },
      },
    };
  }
  return cur;
}

/** The montage, in order. */
export const MONTAGE_SHOTS: MontageShot[] = [WAREHOUSE_SHOT, PRODUCTION_SHOT, QUALITY_LAB_SHOT];
