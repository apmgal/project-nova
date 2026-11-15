/**
 * Act 5 sound design — one table for the facility walkthrough, the recovery montage, the Recovery Meeting
 * and the readiness recommendation, played through the game's existing audio pieces:
 *   - ambience beds: SceneAudio (components/nova/narrative/SceneAudio.tsx) — fade in/out, crossfade on a
 *     change of bed, cleanup on unmount, autoplay unlock on the first gesture; mute = volume 0;
 *   - one-shots: playCue() below — the same HTMLAudio pattern the inspection film uses.
 *
 * Every file here is an existing, licensed recording already in the project (the Epidemic Sound
 * recordings in assets-src/sfx/epidemic/, trimmed/filtered for the inspection film and epilogues).
 * No generated or synthesised sound. Cues whose recording doesn't exist yet are `null`: the integration
 * point is wired (the cue fires at the right moment) but stays silent until the asset is added — see
 * MISSING_ACT5_ASSETS for the file each one needs.
 */

export interface SoundCue {
  src: string;
  volume: number;
}

const VENTILATION = "/assets/sfx/epilogue/plant_room_tone_loop.wav"; // low band (28–230 Hz) of the ES office ambience: building plant / ventilation hum, no voices
const SEALED_ROOM = "/assets/sfx/inspection/room_quiet_loop.wav"; // ES office ambience through a sealed-room filter: a quiet, occupied room tone
const PAPER_SETTLE = "/assets/sfx/inspection/paper_settle.wav"; // ES paper — a sheet set down
const PAPER_FOLDER = "/assets/sfx/inspection/paper_dossier.wav"; // ES paper — a folder handled and opened
// Facility walkthrough (public/assets/sfx/facility/): trimmed, filtered, levelled and loop-joined from the
// supplied Epidemic Sound recordings (originals in assets-src/sfx/epidemic/).
const FAC = "/assets/sfx/facility/";

/** Room / scene ambience beds (looped through SceneAudio). */
export const ACT5_BEDS = {
  /** Darker and quieter: the ventilation hum alone, low. */
  warehouse: { src: VENTILATION, volume: 0.1 },
  /** More present: the same plant hum, louder — equipment running. */
  production: { src: VENTILATION, volume: 0.22 },
  /** Quieter, controlled: a sealed-room tone instead of plant hum. */
  qualityLab: { src: SEALED_ROOM, volume: 0.13 },
  /** The Recovery Meeting: an occupied room, unobtrusive. Ducked under Mike's call. */
  meeting: { src: SEALED_ROOM, volume: 0.3 },
  meetingDucked: 0.06,
  /** The readiness recommendation (the facility at dusk): the plant hum, barely there. */
  readiness: { src: VENTILATION, volume: 0.06 },
} as const satisfies Record<string, SoundCue | number>;

export type FacilityRoomId = "warehouse" | "production" | "qualityLab";

/**
 * The walkthrough's layered room soundscapes.
 *   Layer 1 — base: continuous, low (the room's air).
 *   Layer 2 — secondary: quieter continuous texture, or occasional distant events (ROOM_OCCASIONAL).
 *   Layer 3 — events: ACT5_CUES fired by the visible animation (ambientMotion.ts) and by evidence collection.
 * Each layer is its own SceneAudio, so room changes crossfade every layer and nothing outlives the walkthrough.
 * Levels are set by ear-equivalent loudness (each file is levelled to a known RMS): the warehouse sits around
 * −42 dB, the production floor around −38 dB, the lab around −50 dB.
 */
export const ROOM_LAYERS: Record<FacilityRoomId, { src: string; volume: number; layer: "base" | "secondary" }[]> = {
  // Spacious, darker: the building's ventilation hum only; distant machinery now and then (ROOM_OCCASIONAL).
  warehouse: [{ src: VENTILATION, volume: 0.08, layer: "base" }],
  // The busiest room: the production hum, the line's electric motors, the conveyor trays rattling along the belt.
  production: [
    { src: FAC + "production_machinery_loop.wav", volume: 0.35, layer: "base" },
    { src: FAC + "production_motors_loop.wav", volume: 0.13, layer: "secondary" },
    { src: FAC + "conveyor_rattle_loop.wav", volume: 0.15, layer: "secondary" },
  ],
  // Quiet and controlled: the sealed-room tone, with benchtop instrument fans just under it.
  qualityLab: [
    { src: SEALED_ROOM, volume: 0.5, layer: "base" },
    { src: FAC + "lab_instrument_loop.wav", volume: 0.12, layer: "secondary" },
  ],
};

/** Occasional layer-2 events: one sound, now and then (random gap in seconds), while that room is open. */
export const ROOM_OCCASIONAL: Partial<Record<FacilityRoomId, { cue: SoundCue; everyS: [number, number] }>> = {
  // Heavy plant machinery somewhere else on site, low-passed as if through walls — never in the lab.
  warehouse: { cue: { src: FAC + "warehouse_distant_machinery.wav", volume: 0.18 }, everyS: [32, 55] },
};

/** How far the room layers dip (×) while the evidence-collected cue plays, and for how long (ms). */
export const COLLECT_DUCK = { factor: 0.55, ms: 1400 };

/** Restrained interaction cues (null = asset not available yet; the cue is wired but silent). */
export const ACT5_CUES: Record<string, SoundCue | null> = {
  /** Facility walkthrough — an evidence panel opens (a sheet set down). */
  evidenceOpen: { src: PAPER_SETTLE, volume: 0.16 },
  /** A new piece of evidence collected — the supplied collect sound (its warmest variation, top end softened), quiet. */
  evidenceRecorded: { src: FAC + "evidence_collected.wav", volume: 0.2 },
  /** Closing a panel: deliberately silent unless a soft close asset is added. */
  evidenceClose: null,
  /** A room's investigation completed. */
  roomComplete: null,
  /** Recovery Meeting — the decision panel appears (papers on the table). */
  optionsAppear: { src: PAPER_SETTLE, volume: 0.12 },
  /** A recovery strategy / sponsor response is chosen. */
  choiceMade: { src: PAPER_FOLDER, volume: 0.15 },
  /** Dialogue advance: no suitable soft UI asset exists, so silent (see MISSING_ACT5_ASSETS). */
  dialogueAdvance: null,
  /** Readiness recommendation chosen. */
  recommendationChosen: { src: PAPER_SETTLE, volume: 0.2 },
  // Walkthrough motion (ambientMotion.ts cues) — fired in sync with the animation, inside that room only.
  forkliftDrive: { src: FAC + "forklift_drive.wav", volume: 0.22 }, // 5 s, matches each 5 s move
  forkliftForksUp: { src: FAC + "forklift_hydraulic.wav", volume: 0.16 },
  forkliftForksDown: { src: FAC + "forklift_hydraulic.wav", volume: 0.12 },
  dissolutionHead: { src: FAC + "dissolution_drive.wav", volume: 0.1 }, // each 6 s rise-and-lower, very low
  fumeHoodSashUp: null,
  fumeHoodSashDown: null,
};
export type Act5Cue = keyof typeof ACT5_CUES;

// One-shots still sounding, so a room change or leaving the walkthrough can stop them (stopActiveSounds).
const active = new Set<HTMLAudioElement>();

/** Plays a one-shot sound (no-op while muted or before audio is allowed). Returns the element. */
export function playSound(c: SoundCue | null, muted: boolean): HTMLAudioElement | null {
  if (!c || muted || typeof window === "undefined") return null;
  try {
    const a = new Audio(c.src);
    a.volume = c.volume;
    active.add(a);
    a.addEventListener("ended", () => active.delete(a), { once: true });
    a.play().catch(() => active.delete(a)); // blocked before any gesture: silently skipped
    return a;
  } catch {
    return null;
  }
}

/** Fades out and stops every one-shot still sounding (a room change, or leaving the walkthrough). */
export function stopActiveSounds(fadeMs = 600) {
  for (const a of active) {
    const from = a.volume, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / fadeMs));
      a.volume = from * (1 - k);
      if (k < 1) requestAnimationFrame(step);
      else a.pause();
    };
    requestAnimationFrame(step);
  }
  active.clear();
}

// The last element each cue started, so a cue can't stack on top of itself.
const lastPlayed = new Map<string, HTMLAudioElement>();
/** Plays a one-shot cue (no-op when the asset isn't available or the game is muted). A cue still sounding
 *  isn't started a second time on top of itself. Returns the element. */
export function playCue(cue: Act5Cue, muted: boolean): HTMLAudioElement | null {
  const prev = lastPlayed.get(cue);
  if (prev && !prev.paused && !prev.ended) return null;
  const a = playSound(ACT5_CUES[cue], muted);
  if (a) lastPlayed.set(cue, a);
  return a;
}

/** Assets a finished Act 5 soundscape still needs (licensed recordings; suggested public/ paths). */
export const MISSING_ACT5_ASSETS: Record<string, string> = {
  fumeHoodSash: "public/assets/sfx/facility/fume_hood_sash.wav — glass sash sliding on its runners (≈1.2 s)",
  evidenceClose: "public/assets/sfx/ui/panel_close_soft.wav — soft paper/card close",
  roomComplete: "public/assets/sfx/ui/room_complete_soft.wav — restrained completion cue",
  dialogueAdvance: "public/assets/sfx/ui/dialogue_advance_soft.wav — very soft, short tick",
};

// ---------------------------------------------------------------------------------------------------
// Recovery montage ("In the days that followed…")
// ---------------------------------------------------------------------------------------------------

/**
 * The montage's music: the supplied "Clicky Bass Pulse" loop (two 4-bar phrases at 100 BPM, cut to exactly
 * 19.2 s so it loops seamlessly) — a restrained pulse of work getting done, under the rooms' own sound.
 * (The other supplied loop, "Fat Bass Pulse — Distorted Elements, Funky", is louder, constant and distorted:
 * too much for a quiet recovery montage. Its original is kept in assets-src/sfx/epidemic/.)
 */
export const MONTAGE_MUSIC: SoundCue = { src: FAC + "montage_pulse_loop.wav", volume: 0.45 };

/** Each montage shot's events, at the second the object moves in the shot's own timeline (montageShots.ts). */
export const MONTAGE_CUES: Record<FacilityRoomId, [number, SoundCue][]> = {
  // 1–4 s the dock shutter rolls up · 4.1 forklift drives in · 7.1 lowers the crate · 8.6 reverses · 10.4 shutter down
  warehouse: [
    [1.0, { src: FAC + "shutter_motor.wav", volume: 0.2 }],
    [4.1, { src: FAC + "forklift_move_short.wav", volume: 0.2 }],
    [7.1, { src: FAC + "forklift_hydraulic.wav", volume: 0.14 }],
    [8.6, { src: FAC + "forklift_move_short.wav", volume: 0.16 }],
    [10.4, { src: FAC + "shutter_motor.wav", volume: 0.18 }],
  ],
  // The filtration rework: cartridge 1 and 2 lifted (3.35, 6.2), the flange cap (10.0), the pipe spool (12.1).
  production: [
    [3.35, { src: FAC + "hoist_lift.wav", volume: 0.16 }],
    [6.2, { src: FAC + "hoist_lift.wav", volume: 0.15 }],
    [10.0, { src: FAC + "hoist_lift.wav", volume: 0.12 }],
    [12.1, { src: FAC + "hoist_lift.wav", volume: 0.15 }],
  ],
  // The dissolution tester's head goes down (2.2) and cycles again (5.0). (The fume-hood sash has no sound yet.)
  qualityLab: [
    [2.2, { src: FAC + "dissolution_drive.wav", volume: 0.12 }],
    [5.0, { src: FAC + "dissolution_drive.wav", volume: 0.1 }],
  ],
};
