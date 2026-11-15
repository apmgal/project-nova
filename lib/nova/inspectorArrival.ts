/**
 * Act 5 inspector-arrival cinematic (components/nova/act5/InspectorArrival.tsx): ~10 s between the
 * readiness recommendation and the next scene. Everything replaceable lives here, so swapping the
 * placeholders for real assets is a data change only.
 *
 * Visual source, in priority order (the first one set is used; on load failure it falls back):
 *   1. `video`  — a pre-rendered MP4/WebM of the three shots (vehicle stops · door · footsteps + case).
 *   2. `three`  — the real-time Three.js cinematic (current default).
 *   3. `spline` — a Spline scene whose own timeline plays the three shots. React emits a Mouse Down
 *                 event on the object named `startObject` at the start of the shots window, so the
 *                 scene's animation is triggered at exactly the right moment (keep it paused until then).
 *   4. placeholder shots — clearly labelled frames drawn in React (last resort).
 *
 * Sounds: every cue is optional — a missing or blocked file is simply silent. `footsteps` falls back to
 * the existing footsteps loop until a dedicated clip is supplied.
 */

/** Seconds from the start of the cinematic (which begins on black, after the decision screen's fade). */
export const ARRIVAL_TIMELINE = {
  /** Black hold, then the vehicle is heard before it is seen. */
  vehicleSound: 2.0,
  /** Shots window: fade in from black … fade out to black. */
  shotsIn: 3.0,
  shotsOut: 7.6,
  /** Placeholder / reference cut points within the shots window. */
  shotDoor: 4.8,
  shotFootsteps: 6.1,
  /** Sound cues. */
  doorOpen: 5.0,
  doorClose: 5.79, // the thunk lands as the door shuts (arrivalScene: closes 5.62–5.80)
  footsteps: 6.2,
  footstepsDuration: 1.4,
  /** Title card. */
  titleIn: 8.1,
  titleOut: 9.6,
  end: 10.2,
} as const;

export const ARRIVAL_TITLE = "THE INSPECTION";

export interface ArrivalAssets {
  /** The Three.js cinematic (components/nova/act5/arrivalScene.ts) and its files. */
  three: { car: string; leatherNormal: string; backdrop: string } | null;
  video: { src: string; poster?: string; /** true if the video carries its own soundtrack (cue sounds are then skipped). */ includesAudio: boolean } | null;
  spline: { url: string; startObject: string } | null;
  sounds: {
    vehicle: string | null;
    door: string | null; // one clip for open + close is fine (played at doorOpen and doorClose)
    doorClose: string | null; // optional separate close clip
    footsteps: string | null;
    title: string | null; // optional low hit / swell under the title card
  };
}

/**
 * Current assets (paths relative to /public). The SFX are synthesised in-house (no external sound
 * library was reachable); swap in recorded Foley here when available — no component changes needed.
 */
export const ARRIVAL_ASSETS: ArrivalAssets = {
  three: {
    car: "/assets/cinematics/arrival/executive_car.glb",
    leatherNormal: "/assets/cinematics/arrival/leather_normal.webp",
    backdrop: "/assets/cinematics/arrival/facility_backdrop_blur.jpg",
  },
  video: null, // e.g. { src: "/assets/cinematics/inspector-arrival.mp4", includesAudio: false }
  spline: null, // e.g. { url: "https://prod.spline.design/<id>/scene.splinecode", startObject: "Arrival Start" }
  sounds: {
    vehicle: "/assets/sfx/arrival/vehicle_arrive.wav",
    door: "/assets/sfx/arrival/car_door_open.wav",
    doorClose: "/assets/sfx/arrival/car_door_close.wav",
    footsteps: "/assets/sfx/arrival/footsteps_wet.wav",
    title: "/assets/sfx/arrival/title_hit.wav",
  },
};

/** Saved once the cinematic has finished, so it never replays in this pass. */
export const INSPECTOR_ARRIVAL_SEEN_FLAG = "act5_inspector_arrival_seen";
