/**
 * "The Morning of the Inspection" — PROTOTYPE cinematic (preview route /prototype/inspection-morning).
 * Not wired into the game. Dawn exterior → the empty inspection room → the inspection dossier →
 * "THE INSPECTION". Rendered live in Three.js (components/nova/act5/morning/: textures.ts, exterior.ts,
 * room.ts, morningScene.ts); this file holds the timing and the asset paths.
 */

/** Seconds from the start (which begins on black). */
export const MORNING_TIMELINE = {
  fadeIn: [0, 0.7] as const,
  /** Shot 1 — the facility at dawn: slow dolly with sideways drift. */
  shot1: [0, 3.5] as const,
  /** Shot 2 — the inspection room: dolly alongside the table towards the head (clean cut in). */
  shot2: [3.5, 7.5] as const,
  /** Shot 3 — the dossier: push, slight tilt, focus pull (deliberate cut in). */
  shot3: [7.5, 9.5] as const,
  /** Shot 4 — cut to black, then the title. */
  black: 9.5,
  titleIn: 9.85,
  titleOut: 11.45,
  end: 12.0,
  /** Sound cues. */
  wind: 0.0,
  distantVehicle: 0.3,
  roomTone: 3.5,
  doorClose: 5.8, // the latch lands as the door (in frame) shuts
  footsteps: 7.6, // four steps approach and stop (~9.0 s), then silence until the cut
  title: 9.85,
} as const;

export const MORNING_TITLE = "THE INSPECTION";

export const MORNING_ASSETS = {
  logo: "/assets/branding/helix_biopharma_logo.png",
  sounds: {
    wind: "/assets/sfx/morning/ambient_wind_dawn.wav",
    distantVehicle: "/assets/sfx/morning/distant_vehicle.wav",
    roomTone: "/assets/sfx/morning/room_tone.wav",
    doorClose: "/assets/sfx/morning/door_close_offscreen.wav",
    footsteps: "/assets/sfx/morning/footsteps_approach_stop.wav",
    title: "/assets/sfx/arrival/title_hit.wav",
  },
} as const;
