import type { Application, SPEObject } from "@splinetool/runtime";

/**
 * Subtle decorative motion for three existing facility objects (no new geometry or lights):
 *   Warehouse        — the forklift reverses ~320 units along its lane, pauses, drives back.
 *   Production Floor — the tablet-press conveyor's four product trays inch along the belt.
 *   Quality Lab      — the dissolution tester head rises ~12 units and lowers again.
 * Plus two coordinated / one-off touches on the same loop:
 *   - the forklift's forks rise slightly while it is stopped, and lower before it moves again;
 *   - the fume-hood sash rises a little once, the first time the player enters the Quality Lab
 *     (an equipment check), then lowers and stays put.
 *
 * The scene renders on demand, so any motion means full redraws while it runs. To keep that cheap,
 * motion only advances while its room (or the site overview) is on screen, the tab is visible and no
 * evidence popup has paused the scene, and it is capped at ~30 fps. Otherwise the loop just idles
 * (no renders requested). Time only accumulates while active, so motion resumes where it left off.
 */

type Room = "warehouse" | "production" | "qualityLab";

const FRAME_MS = 1000 / 30;

const FORKLIFT = "WHM Forklift";
const FORKLIFT_LIFT = "WHM Forklift Lift"; // forks + carriage, inside the forklift group
const SASH_PARTS = ["QL Fume Hood Sash", "QL Fume Hood Sash Handle"];
const TRAYS = ["PF Conveyor Product Tray 1", "PF Conveyor Product Tray 2", "PF Conveyor Product Tray 3", "PF Conveyor Product Tray 4"];
const DISSOLUTION_HEAD = "LTB Dissolution Head";

const smooth = (t: number) => t * t * (3 - 2 * t); // ease in-out on 0..1

/** Forklift offset along +x for loop time t (s): reverse out 5 s, pause 3 s, drive back 5 s, pause 3 s. */
const FORK_CYCLE = 16;
function forkliftOffset(t: number) {
  const DIST = 320;
  const c = t % FORK_CYCLE;
  if (c < 5) return DIST * smooth(c / 5);
  if (c < 8) return DIST;
  if (c < 13) return DIST * (1 - smooth((c - 8) / 5));
  return 0;
}

/** 0..1 lift amount for a stop window [a, b): rise, hold, lower, all inside the stop. */
function stopLift(c: number, a: number, b: number) {
  if (c < a || c >= b) return 0;
  const RAMP = 0.7;
  const u = c - a;
  const d = b - a;
  if (u < 0.2 || u > d - 0.2) return 0; // settle before lifting / after lowering
  if (u < 0.2 + RAMP) return smooth((u - 0.2) / RAMP);
  if (u > d - 0.2 - RAMP) return smooth((d - 0.2 - u) / RAMP);
  return 1;
}
/** Fork lift (units) at loop time t: only during the two stops of the same forklift cycle. */
function forkLift(t: number) {
  const c = t % FORK_CYCLE;
  return 16 * Math.max(stopLift(c, 5, 8), stopLift(c, 13, FORK_CYCLE));
}

/** One-off sash check (s since it started): wait 1 s, rise 1.2 s, hold 1.2 s, lower 1.2 s. */
const SASH_TOTAL = 4.6;
function sashLift(t: number) {
  if (t < 1 || t >= SASH_TOTAL) return 0;
  if (t < 2.2) return 18 * smooth((t - 1) / 1.2);
  if (t < 3.4) return 18;
  return 18 * (1 - smooth((t - 3.4) / 1.2));
}

export interface AmbientMotion { dispose: () => void }

/** Moments in the motion that a sound can follow (fired by startAmbientMotion's options.onCue). */
export type AmbientCue = "forkliftDrive" | "forkliftForksUp" | "forkliftForksDown" | "dissolutionHead" | "fumeHoodSashUp" | "fumeHoodSashDown";

/** True when cycle time crossed `mark` between two frames (prev → next, both within one cycle of `period`). */
function crossed(prev: number, next: number, mark: number, period: number) {
  const a = prev % period, b = next % period;
  return a <= b ? a < mark && b >= mark : a < mark || b >= mark;
}

export function startAmbientMotion(
  app: Application,
  /** Is this room's object currently on screen (its room is open, or the site overview)? */
  isRoomVisible: (room: Room) => boolean,
  /** True while the scene is deliberately paused (e.g. an evidence popup is open). */
  isPaused: () => boolean,
  /** The room the player is inside (not the overview), or null. Drives the one-off sash check. */
  roomInside: () => string | null = () => null,
  /**
   * forklift: false leaves the forklift alone; lab: false leaves the dissolution head and the fume-hood
   * sash alone (a scripted cinematic moves them instead).
   */
  options: { forklift?: boolean; lab?: boolean; onCue?: (cue: AmbientCue, room: Room) => void } = {},
): AmbientMotion {
  const cue = options.onCue;
  const find = (n: string) => app.findObjectByName(n) ?? null;
  const forklift = options.forklift === false ? null : find(FORKLIFT);
  const forks = options.forklift === false ? null : find(FORKLIFT_LIFT);
  const sash = options.lab === false ? [] : SASH_PARTS.map(find).filter((o): o is SPEObject => !!o);
  const trays = TRAYS.map(find).filter((o): o is SPEObject => !!o);
  const head = options.lab === false ? null : find(DISSOLUTION_HEAD);

  // Rest positions (local to each object's parent group).
  const forkliftX = forklift?.position.x ?? 0;
  const forksY = forks?.position.y ?? 0;
  const sashY = sash.map((o) => o.position.y);
  const trayX = trays.map((o) => o.position.x);
  const trayScale = trays.map((o) => o.scale.x);
  const headY = head?.position.y ?? 0;
  // Trays cycle over the span they already occupy (4 trays, evenly spaced along the belt).
  const trayMin = trayX.length ? Math.min(...trayX) : 0;
  const traySpacing = trayX.length > 1 ? (Math.max(...trayX) - trayMin) / (trayX.length - 1) : 0;
  const traySpan = traySpacing * trayX.length;

  const clocks: Record<Room, number> = { warehouse: 0, production: 0, qualityLab: 0 };
  let sashClock = -1; // -1: not started; plays once per facility visit, on first entering the lab
  let raf = 0;
  let lastFrame = performance.now();

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - lastFrame < FRAME_MS) return;
    // Time since the last processed (~30 fps) frame, not since the last browser frame.
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (document.visibilityState !== "visible" || isPaused()) return;

    let changed = false;
    if (forklift && isRoomVisible("warehouse")) {
      const prev = clocks.warehouse;
      clocks.warehouse += dt;
      if (cue) {
        const now = clocks.warehouse;
        // Drives out at 0 s and back at 8 s; the forks rise 0.2 s into each stop and lower 0.9 s before it ends.
        if (crossed(prev, now, 0.001, FORK_CYCLE) || crossed(prev, now, 8, FORK_CYCLE)) cue("forkliftDrive", "warehouse");
        if (crossed(prev, now, 5.2, FORK_CYCLE) || crossed(prev, now, 13.2, FORK_CYCLE)) cue("forkliftForksUp", "warehouse");
        if (crossed(prev, now, 7.1, FORK_CYCLE) || crossed(prev, now, 15.1, FORK_CYCLE)) cue("forkliftForksDown", "warehouse");
      }
      forklift.position.x = forkliftX + forkliftOffset(clocks.warehouse);
      if (forks) forks.position.y = forksY + forkLift(clocks.warehouse);
      changed = true;
    }
    if (trays.length && traySpan > 0 && isRoomVisible("production")) {
      clocks.production += dt;
      const shift = (clocks.production * 18) % traySpan; // ~18 units/s: a steady test run
      trays.forEach((o, i) => {
        const p = (trayX[i] - trayMin + shift) % traySpan; // 0..span along the belt
        o.position.x = trayMin + p;
        // Shrink in/out over the first/last 12 units so the wrap-around isn't a pop.
        const edge = Math.max(0, Math.min(1, Math.min(p, traySpan - traySpacing * 0.25 - p) / 12));
        o.scale.x = o.scale.y = o.scale.z = trayScale[i] * edge;
      });
      changed = true;
    }
    if (head && isRoomVisible("qualityLab")) {
      const prevLab = clocks.qualityLab;
      clocks.qualityLab += dt;
      if (cue && crossed(prevLab, clocks.qualityLab, 0.001, 6)) cue("dissolutionHead", "qualityLab"); // each 6 s rise-and-lower
      head.position.y = headY + 12 * (0.5 - 0.5 * Math.cos((clocks.qualityLab * 2 * Math.PI) / 6));
      changed = true;
    }
    if (sash.length) {
      if (sashClock < 0 && roomInside() === "qualityLab") sashClock = 0;
      if (sashClock >= 0 && sashClock < SASH_TOTAL && isRoomVisible("qualityLab")) {
        const prevSash = sashClock;
        sashClock = Math.min(SASH_TOTAL, sashClock + dt);
        if (cue && prevSash < 1 && sashClock >= 1) cue("fumeHoodSashUp", "qualityLab");
        if (cue && prevSash < 3.4 && sashClock >= 3.4) cue("fumeHoodSashDown", "qualityLab");
        const y = sashLift(sashClock); // ends exactly at 0: back at rest
        sash.forEach((o, i) => { o.position.y = sashY[i] + y; });
        changed = true;
      }
    }
    if (changed) app.requestRender();
  };
  raf = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(raf);
    },
  };
}
