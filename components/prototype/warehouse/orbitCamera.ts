/**
 * Orbit / pan / zoom controller that drives a Spline camera object from the
 * web app. Spline's own play-mode orbit controls are switched off in the
 * scene (playControls 'none'), so this owns the camera: smooth damping,
 * navigation limits, reset, and enable/disable while overlays are open.
 */

const DEG = Math.PI / 180;

export interface Vec3 { x: number; y: number; z: number }
export interface OrbitView { target: Vec3; azimuth: number; elevation: number; distance: number }
export interface OrbitConfig {
  home: OrbitView;
  /** Optional: nudge the computed camera position (e.g. keep it inside walls). */
  clampCamera?: (p: Vec3) => void;
  /** Easing rate when settled (default 9; lower = softer, e.g. for a follow camera). */
  baseSpeed?: number;
  limits: {
    distance: [number, number];
    elevation: [number, number];
    target: { x: [number, number]; y: [number, number]; z: [number, number] };
  };
}
/** Minimal shape of a Spline runtime object we write transforms to. */
export interface CameraLike { position: Vec3; rotation: Vec3 }

export const WAREHOUSE_VIEW: OrbitConfig = {
  // Original isometric framing of Area A (world units, degrees).
  home: { target: { x: -1400, y: 90, z: 0 }, azimuth: 35, elevation: 32, distance: 2300 },
  limits: {
    distance: [450, 4200],
    elevation: [8, 82],
    target: { x: [-2300, -500], y: [0, 320], z: [-700, 700] },
  },
};

/** Room B — Production Floor, same isometric angle as the warehouse. */
export const PRODUCTION_VIEW: OrbitConfig = {
  home: { target: { x: 25, y: 90, z: 0 }, azimuth: 35, elevation: 34, distance: 2000 },
  limits: {
    distance: [450, 3800],
    elevation: [8, 82],
    target: { x: [-560, 620], y: [0, 320], z: [-600, 600] },
  },
};

/** Room C — Quality Laboratory, same isometric angle as the other rooms. */
export const QUALITY_LAB_VIEW: OrbitConfig = {
  home: { target: { x: 1045, y: 90, z: 0 }, azimuth: 35, elevation: 34, distance: 1700 },
  limits: {
    distance: [450, 3400],
    elevation: [8, 82],
    target: { x: [650, 1440], y: [0, 320], z: [-600, 600] },
  },
};

/**
 * Room B eye-level tour: the camera sits at head height and turns around that point
 * (tiny orbit distance, no zoom or pan). Moving between viewpoints glides in ~1 s.
 */
export type InteriorViewpoint = "entrance" | "filtration" | "planning";
export const eyeView = (x: number, z: number, azimuth: number, elevation = 10): OrbitConfig => ({
  home: { target: { x, y: 90, z }, azimuth, elevation, distance: 25 },
  limits: { distance: [25, 25], elevation: [-35, 40], target: { x: [x, x], y: [90, 90], z: [z, z] } },
});
export const PRODUCTION_INTERIOR_VIEWS: Record<InteriorViewpoint, OrbitConfig> = {
  entrance: eyeView(-330, 60, -50, 4), // a few steps in from the warehouse doorway, facing the tanks, skids and filtration unit
  filtration: eyeView(150, 250, -53), // facing the incomplete filtration unit
  planning: eyeView(-330, 540, 19, 8), // in front of the engineer's workstation (the planning board is easiest to reach from the Entrance)
};
/** Room A (Warehouse) eye-level tour: entrance doorway, receiving desk + dock, the racks aisle with the crate. */
export type WarehouseViewpoint = "entrance" | "receiving" | "racks";
export const WAREHOUSE_INTERIOR_VIEWS: Record<WarehouseViewpoint, OrbitConfig> = {
  entrance: eyeView(-670, -40, 95, 4), // just inside the doorway from the Production Floor, looking down the hall
  receiving: eyeView(-1030, -130, 28, 8), // facing the receiving desk, deliveries and the dock door
  racks: eyeView(-1560, -45, 90, 6), // at the mouth of the racks aisle, facing the suspicious crate
};
/** Room C (Quality Laboratory) eye-level tour: entry door, testing/qualification area, QA documentation corner. */
export type QualityLabViewpoint = "entrance" | "testing" | "qa";
export const QUALITY_LAB_INTERIOR_VIEWS: Record<QualityLabViewpoint, OrbitConfig> = {
  entrance: eyeView(705, 190, -65, 5), // inside the entry door, looking across the benches to the analytical wall
  testing: eyeView(1080, 200, -20, 5), // facing the qualification workstation and the analytical bench
  qa: eyeView(1100, 560, 76, 2), // along the south wall, facing the records desk and the QA documentation cabinet
};

/** Whole-site overview: warehouse + the Production Floor / Quality Lab footprints. */
export const SITE_VIEW: OrbitConfig = {
  home: { target: { x: -375, y: 80, z: 0 }, azimuth: 25, elevation: 38, distance: 5200 },
  limits: {
    distance: [2600, 8000],
    elevation: [15, 82],
    target: { x: [-2300, 1500], y: [0, 400], z: [-900, 900] },
  },
};

/**
 * The site overview framed for the current screen: about a third closer than SITE_VIEW's original
 * 5200 on wide screens, pulled back on narrower/portrait ones so the whole facility stays in view.
 */
export function siteViewFor(aspect: number): OrbitConfig {
  const wide = 1.45; // at or above this aspect the facility fits comfortably at the base distance
  const k = aspect >= wide ? 1 : Math.min(2, (wide / Math.max(aspect, 0.4)) ** 0.9);
  // Target nudged right/forward so the site sits centred, clear of the progress card (bottom-right).
  return { ...SITE_VIEW, home: { ...SITE_VIEW.home, target: { x: -200, y: 80, z: 300 }, distance: Math.round(4000 * k) } };
}

/** Same angle as `to`, shifted by whole turns so it's the shortest rotation from `from`. */
const nearestAngle = (from: number, to: number) => from + ((((to - from) % 360) + 540) % 360) - 180;

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));
const cloneView = (v: OrbitView): OrbitView => ({ ...v, target: { ...v.target } });

export interface OrbitCamera {
  setEnabled(v: boolean): void;
  /**
   * Swap to another view's home + limits; fly = a slower, cinematic glide there; jump = cut instantly;
   * duration (s) = a timed ease-in-out glide that arrives exactly then (scripted cinematics).
   */
  setConfig(config: OrbitConfig, opts?: { fly?: boolean; jump?: boolean; duration?: number }): void;
  rotate(dxPx: number, dyPx: number): void;
  pan(dxPx: number, dyPx: number, viewportHeight: number): void;
  zoom(deltaY: number): void;
  reset(): void;
  /** Point the camera at a moving target (e.g. a walking character); eased like everything else. */
  follow(target: Vec3): void;
  /** Ease toward a new angle/distance (azimuth takes the shortest way round). */
  setGoal(v: { azimuth?: number; elevation?: number; distance?: number }): void;
  getAzimuth(): number;
  dispose(): void;
}

export function createOrbitCamera(
  camera: CameraLike,
  requestRender: () => void,
  config: OrbitConfig = WAREHOUSE_VIEW,
): OrbitCamera {
  let cfg = config;
  let limits = cfg.limits;
  let speed = 9; // damping rate; lowered temporarily while flying between views
  const goal = cloneView(config.home);
  const cur = cloneView(config.home);
  let enabled = true;
  let raf = 0;
  let last = performance.now();
  // Timed glide (setConfig duration): eases from where the camera was to the goal over a fixed time.
  let glide: { from: OrbitView; t0: number; ms: number } | null = null;

  function constrain(v: OrbitView) {
    v.distance = clamp(v.distance, limits.distance);
    v.elevation = clamp(v.elevation, limits.elevation);
    v.target.x = clamp(v.target.x, limits.target.x);
    v.target.y = clamp(v.target.y, limits.target.y);
    v.target.z = clamp(v.target.z, limits.target.z);
  }

  // Look-at as yaw (Y) then pitch (X), converted to the XYZ Euler order Spline objects use.
  function apply(v: OrbitView) {
    const a = v.azimuth * DEG;
    const e = v.elevation * DEG;
    const ce = Math.cos(e);
    camera.position.x = v.target.x + v.distance * Math.sin(a) * ce;
    camera.position.y = v.target.y + v.distance * Math.sin(e);
    camera.position.z = v.target.z + v.distance * Math.cos(a) * ce;
    cfg.clampCamera?.(camera.position);
    const ca = Math.cos(a), sa = Math.sin(a);
    const cp = Math.cos(-e), sp = Math.sin(-e);
    camera.rotation.x = Math.atan2(sp, ca * cp);
    camera.rotation.y = Math.asin(Math.max(-1, Math.min(1, sa * cp)));
    camera.rotation.z = Math.atan2(-sa * sp, ca);
    requestRender();
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (glide) {
      const u = Math.min(1, (now - glide.t0) / glide.ms);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * u); // ease in-out
      const f = glide.from;
      const mix = (a: number, b: number) => a + (b - a) * e;
      cur.azimuth = mix(f.azimuth, goal.azimuth);
      cur.elevation = mix(f.elevation, goal.elevation);
      cur.distance = mix(f.distance, goal.distance);
      cur.target.x = mix(f.target.x, goal.target.x);
      cur.target.y = mix(f.target.y, goal.target.y);
      cur.target.z = mix(f.target.z, goal.target.z);
      apply(cur);
      if (u >= 1) glide = null;
      raf = requestAnimationFrame(tick);
      return;
    }
    const k = 1 - Math.exp(-dt * speed); // smooth ease toward the goal
    let moving = false;
    const step = (from: number, to: number) => {
      const d = to - from;
      if (Math.abs(d) > 1e-3) moving = true;
      return from + d * k;
    };
    cur.azimuth = step(cur.azimuth, goal.azimuth);
    cur.elevation = step(cur.elevation, goal.elevation);
    cur.distance = step(cur.distance, goal.distance);
    cur.target.x = step(cur.target.x, goal.target.x);
    cur.target.y = step(cur.target.y, goal.target.y);
    cur.target.z = step(cur.target.z, goal.target.z);
    if (moving) apply(cur);
    else speed = cfg.baseSpeed ?? 9; // arrived: back to the view's normal responsiveness
    raf = requestAnimationFrame(tick);
  }

  apply(cur);
  raf = requestAnimationFrame(tick);

  return {
    setEnabled(v) { enabled = v; },
    setConfig(next, opts) {
      cfg = next;
      limits = next.limits;
      Object.assign(goal, cloneView(next.home));
      goal.azimuth = nearestAngle(cur.azimuth, goal.azimuth);
      speed = opts?.fly ? 2.6 : next.baseSpeed ?? 9;
      glide = opts?.duration && !opts.jump ? { from: cloneView(cur), t0: performance.now(), ms: opts.duration * 1000 } : null;
      if (opts?.jump) {
        // Cut straight to the new view (used behind a fade to black).
        Object.assign(cur, cloneView(goal));
        apply(cur);
      }
    },
    rotate(dxPx, dyPx) {
      if (!enabled) return;
      goal.azimuth -= dxPx * 0.25;
      goal.elevation += dyPx * 0.2;
      constrain(goal);
    },
    pan(dxPx, dyPx, viewportHeight) {
      if (!enabled) return;
      // Screen-space pan along the camera's right and up vectors.
      const unitsPerPx = (goal.distance * 0.9) / Math.max(1, viewportHeight);
      const a = goal.azimuth * DEG;
      const e = goal.elevation * DEG;
      const right = { x: Math.cos(a), z: -Math.sin(a) };
      const up = { x: -Math.sin(a) * Math.sin(e), y: Math.cos(e), z: -Math.cos(a) * Math.sin(e) };
      goal.target.x += (-dxPx * right.x + dyPx * up.x) * unitsPerPx;
      goal.target.y += dyPx * up.y * unitsPerPx;
      goal.target.z += (-dxPx * right.z + dyPx * up.z) * unitsPerPx;
      constrain(goal);
    },
    zoom(deltaY) {
      if (!enabled) return;
      goal.distance *= Math.exp(deltaY * 0.0012);
      constrain(goal);
    },
    reset() {
      Object.assign(goal, cloneView(cfg.home));
      goal.azimuth = nearestAngle(cur.azimuth, goal.azimuth);
    },
    follow(t) {
      goal.target.x = t.x; goal.target.y = t.y; goal.target.z = t.z;
      constrain(goal);
    },
    getAzimuth: () => cur.azimuth,
    setGoal(v) {
      if (v.azimuth !== undefined) goal.azimuth = nearestAngle(cur.azimuth, v.azimuth);
      if (v.elevation !== undefined) goal.elevation = v.elevation;
      if (v.distance !== undefined) goal.distance = v.distance;
      constrain(goal);
    },
    dispose() { cancelAnimationFrame(raf); },
  };
}
