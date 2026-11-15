/**
 * Third-person walking for the warehouse, tuned for players who don't play games:
 *  - ↑ walks forward, ↓ steps back, ← → turn the worker; Shift jogs (W A S D also work).
 *  - Or click the floor to walk there (walkTo), sliding around obstacles.
 *  - The camera auto-follows behind at a fixed distance; a drag gives a quick look
 *    around and then it eases back behind the worker.
 * Simple circle-vs-box collisions keep the worker out of walls and props, and the
 * hip/shoulder pivots swing for a walk cycle. Pure runtime code — the Spline scene
 * only provides the rigged character.
 */
import type { SPEObject } from "@splinetool/runtime";
import type { OrbitCamera, OrbitConfig } from "./orbitCamera";

interface Box { minX: number; maxX: number; minZ: number; maxZ: number }

export interface WalkConfig {
  spawn: { x: number; z: number; yaw: number }; // yaw 0 faces +Z, π faces -Z
  bounds: Box; // walkable floor (the doorway to unbuilt rooms is closed off)
  obstacles: Box[]; // footprints of walls/props, world units
  radius: number; // the character's collision radius
  interact: { x: number; z: number; range: number }; // where "E Inspect" becomes available
}

/** Warehouse layout, measured from the Spline scene (1 m ≈ 50 units). */
export const WAREHOUSE_WALK: WalkConfig = {
  spawn: { x: -1300, z: 450, yaw: Math.PI },
  bounds: { minX: -2200, maxX: -600, minZ: -600, maxZ: 600 },
  radius: 16,
  obstacles: [
    { minX: -2108, maxX: -1292, minZ: -600, maxZ: -514 }, // pallet racking
    { minX: -2200, maxX: -2130, minZ: -385, maxZ: 150 }, // storage shelving
    { minX: -1094, maxX: -1026, minZ: -389, maxZ: -331 }, // crate A
    { minX: -934, maxX: -866, minZ: -419, maxZ: -361 }, // crate B
    { minX: -1835, maxX: -1765, minZ: -85, maxZ: -5 }, // suspicious crate (Wrong_Component), in the racks aisle
    { minX: -807, maxX: -753, minZ: 28, maxZ: 132 }, // inspection table
    { minX: -877, maxX: -738, minZ: -290, maxZ: -240 }, // pallet jack
    { minX: -1117, maxX: -783, minZ: -600, maxZ: -568 }, // dock bumper
  ],
  interact: { x: -1800, z: -45, range: 115 },
};

/** Camera for walking: close behind the character, kept inside the warehouse walls. */
export function walkView(cfg: WalkConfig = WAREHOUSE_WALK): OrbitConfig {
  const { spawn, bounds } = cfg;
  return {
    home: {
      target: { x: spawn.x, y: 62, z: spawn.z },
      azimuth: (spawn.yaw * 180) / Math.PI + 180, // directly behind the character
      elevation: 16,
      distance: 240,
    },
    baseSpeed: 6, // a soft, steady follow
    limits: {
      distance: [120, 420],
      elevation: [4, 55],
      target: { x: [bounds.minX, bounds.maxX], y: [0, 200], z: [bounds.minZ, bounds.maxZ] },
    },
    clampCamera: (p) => {
      p.x = Math.min(bounds.maxX - 15, Math.max(bounds.minX + 15, p.x));
      p.z = Math.max(bounds.minZ + 15, Math.min(1400, p.z));
      p.y = Math.max(25, p.y);
    },
  };
}

export interface ThirdPersonController {
  setEnabled(v: boolean): void;
  reset(): void;
  isNear(): boolean;
  /** Walk to a floor point; onArrive fires on arrival (not if interrupted or stuck). */
  walkTo(x: number, z: number, onArrive?: () => void): void;
  /** Walk to just in front of the interaction point, then call onArrive. */
  walkToInteract(onArrive?: () => void): void;
  /** The player is looking around with the mouse: pause the auto-follow for a moment. */
  noteLook(): void;
  dispose(): void;
}

interface Options {
  player: SPEObject;
  pivots: { hipL?: SPEObject; hipR?: SPEObject; shoulderL?: SPEObject; shoulderR?: SPEObject };
  orbit: OrbitCamera;
  requestRender: () => void;
  config?: WalkConfig;
  onNearChange?: (near: boolean) => void;
  onInteract?: () => void;
  onFirstMove?: () => void;
}

const KEYS: Record<string, "f" | "b" | "l" | "r"> = {
  KeyW: "f", ArrowUp: "f", KeyS: "b", ArrowDown: "b",
  KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r",
};
/** Physical key code, falling back to e.key (some browsers/keyboards leave e.code empty). */
function keyCode(e: KeyboardEvent): string {
  if (e.code) return e.code;
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (k === " ") return "Space";
  return k.length === 1 ? `Key${k}` : k; // "ArrowUp", "Enter", ...
}

const WALK_SPEED = 170; // units/s (~3.4 m/s, a brisk game walk)
const JOG_MULT = 1.7;
const BACK_MULT = 0.55; // stepping backwards is slower
const TURN_SPEED = 2.6; // rad/s for A/D
const LOOK_HOLD_MS = 1400; // after a mouse look, wait this long before easing back behind the worker
const ARRIVE_DIST = 10;

export function createThirdPersonController(o: Options): ThirdPersonController {
  const cfg = o.config ?? WAREHOUSE_WALK;
  const held = new Set<string>();
  let shift = false;
  let enabled = false;
  let moved = false;
  let near = false;
  let x = cfg.spawn.x, z = cfg.spawn.z, yaw = cfg.spawn.yaw;
  let phase = 0, stride = 0; // walk-cycle phase and blend (0 idle → 1 walking)
  // Click-to-walk target. nearOk: arriving within reach of the interaction point counts as arrived.
  let dest: { x: number; z: number; onArrive?: () => void; stuck: number; nearOk?: boolean } | null = null;
  let lastLook = -Infinity;
  let raf = 0;
  let last = performance.now();

  const blocked = (px: number, pz: number) => {
    const r = cfg.radius, b = cfg.bounds;
    if (px - r < b.minX || px + r > b.maxX || pz - r < b.minZ || pz + r > b.maxZ) return true;
    for (const box of cfg.obstacles) {
      const cx = Math.max(box.minX, Math.min(px, box.maxX));
      const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
      if ((px - cx) ** 2 + (pz - cz) ** 2 < r * r) return true;
    }
    return false;
  };

  const write = () => {
    const p = o.player;
    p.position.x = x;
    p.position.z = z;
    p.position.y = Math.abs(Math.sin(phase)) * 1.8 * stride; // gentle bob
    p.rotation.y = yaw;
    const swing = Math.sin(phase) * 0.6 * stride;
    if (o.pivots.hipL) o.pivots.hipL.rotation.x = swing;
    if (o.pivots.hipR) o.pivots.hipR.rotation.x = -swing;
    if (o.pivots.shoulderL) o.pivots.shoulderL.rotation.x = -swing * 0.8;
    if (o.pivots.shoulderR) o.pivots.shoulderR.rotation.x = swing * 0.8;
    o.orbit.follow({ x, y: 62, z });
    o.requestRender();
  };

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (enabled) {
      let fwd = 0, turn = 0;
      for (const k of held) {
        const d = KEYS[k];
        if (d === "f") fwd += 1;
        if (d === "b") fwd -= 1;
        if (d === "l") turn += 1;
        if (d === "r") turn -= 1;
      }
      if (fwd || turn) dest = null; // keyboard always takes over from click-to-walk
      let moving = false;
      const speed = WALK_SPEED * (shift ? JOG_MULT : 1);

      if (dest) {
        // Click-to-walk: head straight for the point, turning smoothly; slide around obstacles.
        const dx = dest.x - x, dz = dest.z - z;
        const dist = Math.hypot(dx, dz);
        const inReach = dest.nearOk && Math.hypot(x - cfg.interact.x, z - cfg.interact.z) < cfg.interact.range * 0.75;
        if (dist < ARRIVE_DIST || inReach) {
          const done = dest.onArrive;
          dest = null;
          done?.();
        } else {
          const target = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
          yaw += diff * Math.min(1, dt * 10);
          const step = Math.min(dist, speed * dt);
          const mx = (dx / dist) * step, mz = (dz / dist) * step;
          const bx = x, bz = z;
          if (!blocked(x + mx, z)) x += mx;
          if (!blocked(x, z + mz)) z += mz;
          moving = true;
          // Give up if something is in the way and we're not getting anywhere.
          const progressed = Math.hypot(x - bx, z - bz);
          dest.stuck = progressed < step * 0.15 ? dest.stuck + dt : 0;
          if (dest.stuck > 0.35) dest = null;
        }
      } else {
        // Keyboard: A/D turn the worker, W/S walk along the way it faces.
        yaw += turn * TURN_SPEED * dt;
        if (fwd) {
          const sp = speed * (fwd < 0 ? BACK_MULT : 1) * dt * Math.sign(fwd);
          const mx = Math.sin(yaw) * sp, mz = Math.cos(yaw) * sp;
          if (!blocked(x + mx, z)) x += mx;
          if (!blocked(x, z + mz)) z += mz;
          moving = true;
        }
      }
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); // keep within one turn
      if (moving || turn) {
        if (!moved) { moved = true; o.onFirstMove?.(); }
      }
      if (moving) phase += dt * (shift ? 13 : 9.5);

      // Auto-follow: unless the player just looked around, ease the camera back behind the worker.
      if (now - lastLook > LOOK_HOLD_MS) o.orbit.setGoal({ azimuth: (yaw * 180) / Math.PI + 180, elevation: 16, distance: 240 });

      stride += ((moving ? 1 : 0) - stride) * Math.min(1, dt * 10);
      if (!moving && stride < 0.02) { stride = 0; phase = 0; }
      write();
      const d = Math.hypot(x - cfg.interact.x, z - cfg.interact.z);
      const nowNear = d < cfg.interact.range;
      if (nowNear !== near) { near = nowNear; o.onNearChange?.(near); }
    }
    raf = requestAnimationFrame(tick);
  };

  const typing = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!enabled || typing(e)) return;
    if (e.key === "Shift") shift = true;
    const code = keyCode(e);
    if (KEYS[code]) { held.add(code); e.preventDefault(); }
    if ((code === "KeyE" || code === "Enter" || code === "Space") && near && !e.repeat) {
      e.preventDefault();
      o.onInteract?.();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Shift") shift = false;
    held.delete(keyCode(e));
  };
  const onBlur = () => { held.clear(); shift = false; };
  // Capture phase on the document, so nothing in the page (incl. the 3D canvas) can swallow the keys first.
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onBlur);
  raf = requestAnimationFrame(tick);

  return {
    setEnabled(v) {
      enabled = v;
      if (!v) { held.clear(); shift = false; }
    },
    reset() {
      x = cfg.spawn.x; z = cfg.spawn.z; yaw = cfg.spawn.yaw;
      phase = 0; stride = 0; moved = false; near = false; dest = null; lastLook = -Infinity;
      write();
    },
    walkTo(tx, tz, onArrive) {
      const r = cfg.radius, b = cfg.bounds;
      dest = {
        x: Math.min(b.maxX - r, Math.max(b.minX + r, tx)),
        z: Math.min(b.maxZ - r, Math.max(b.minZ + r, tz)),
        onArrive,
        stuck: 0,
      };
    },
    walkToInteract(onArrive) {
      // Approach the interaction point from whichever side the worker is on, stopping within reach.
      const t = cfg.interact;
      const dx = x - t.x, dz = z - t.z;
      const d = Math.hypot(dx, dz) || 1;
      const reach = t.range * 0.6;
      dest = { x: t.x + (dx / d) * reach, z: t.z + (dz / d) * reach, onArrive, stuck: 0, nearOk: true };
    },
    noteLook() { lastLook = performance.now(); },
    isNear: () => near,
    dispose() {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    },
  };
}
