import type { CSSProperties } from "react";

// Reusable Ken Burns (slow zoom + pan) config, consumed by SceneBackground
// and by OfficeJourney's walking legs via the shared `nova-ken-burns`
// keyframe in globals.css. Kept as plain data + a style-builder function
// (not a component) so both call sites can plug it into whatever element
// structure they already have rather than being forced through a shared
// wrapper component.

export interface KenBurnsConfig {
  /** Starting zoom, as a CSS scale() factor. Defaults to 1.1 — the same
   * fixed safety margin SceneBackground has always rendered its backdrops
   * at, so turning Ken Burns on doesn't change a scene's first frame. */
  scaleFrom?: number;
  /** Ending zoom. Defaults to a barely-there ambient drift; a walking
   * leg passes something noticeably larger for the "moving forward"
   * push the spec asks for. */
  scaleTo?: number;
  /** How far the shot pans horizontally by the end, as a percentage of
   * its own width. Mirrored left/right per background (see
   * `driftDirection` below) so a run of scenes doesn't all drift the
   * same way. */
  xToPercent?: number;
  /** Vertical pan, percentage of height. Not mirrored — a slight upward
   * drift reads as "camera settling," not as a direction that needs
   * per-scene variety the way the horizontal one does. */
  yToPercent?: number;
  durationMs?: number;
  /** Freezes the animation at whatever frame it's currently on — used
   * while a character is speaking (camera holds still) or a static
   * dialogue scene wants zero motion at all (scaleFrom === scaleTo also
   * works for that, but `paused` is cheaper when the same config just
   * needs to stop/resume across a leg boundary). */
  paused?: boolean;
}

const DEFAULT_AMBIENT: Required<Omit<KenBurnsConfig, "paused">> = {
  scaleFrom: 1.1,
  scaleTo: 1.16,
  xToPercent: 1.4,
  yToPercent: -1,
  durationMs: 28000,
};

// A walking leg's "push forward" — the spec's ~100%→104% zoom read
// against SceneBackground's existing 1.1 base (so 1.1 → 1.1 * 1.04),
// over the leg's own (much shorter) duration rather than the ambient
// default's slow 28s drift.
export const WALK_PUSH_SCALE_MULTIPLIER = 1.04;

/** Deterministic left/right drift direction from a background's own src,
 * so the same photo always drifts the same way (no Math.random —
 * that would either desync between server/client render or make every
 * replay of the same scene look different) while different backgrounds
 * still visibly vary. */
function driftDirection(src: string): 1 | -1 {
  let hash = 0;
  for (let i = 0; i < src.length; i++) hash = (hash * 31 + src.charCodeAt(i)) | 0;
  return hash % 2 === 0 ? 1 : -1;
}

/** Builds the inline style (CSS custom properties + animation controls)
 * a background layer needs to pick up the shared `.animate-nova-ken-burns`
 * class from globals.css. `src` drives both the deterministic drift
 * direction and (via React's `key={src}`, set by the caller) a fresh
 * animation run whenever the image itself changes. */
export function kenBurnsStyle(src: string, config?: KenBurnsConfig | false): CSSProperties {
  if (config === false) return {};
  const c = { ...DEFAULT_AMBIENT, ...config };
  const dir = driftDirection(src);
  return {
    "--kb-scale-from": c.scaleFrom,
    "--kb-scale-to": c.scaleTo,
    "--kb-x-to": `${c.xToPercent * dir}%`,
    "--kb-y-to": `${c.yToPercent}%`,
    animationDuration: `${c.durationMs}ms`,
    animationPlayState: config?.paused ? "paused" : "running",
  } as CSSProperties;
}
