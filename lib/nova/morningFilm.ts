/**
 * "The Morning of the Inspection" — FILM version (PROTOTYPE, preview route /prototype/inspection-film).
 * Not wired into the game yet. Built from three photographic stills (public/assets/cinematics/morning/)
 * with slow, eased 2.5D camera moves, subtle light, and a soundtrack cut only from the supplied
 * Epidemic Sound recordings (~27.6 s, then ~1.6 s of hand-off into Whitfield's opening — WhitfieldOpening.tsx,
 * placeholder lines for now). The earlier Three.js version (/prototype/inspection-morning) is kept, unused.
 */

/** Seconds from the start (which begins on black — the car is heard before anything is seen). */
export const MORNING_FILM_TIMELINE = {
  /** The exterior fades up from black. */
  fadeIn: [3.0, 3.8] as const,
  /** Shot 1 — the facility at dawn: glide (slowing as the engine stops), push to the entrance (settled by
   *  ~9.2), then an almost-still hold on the facility until the fade. */
  shot1: [3.0, 10.7] as const,
  /** Location break (~1.85 s): fade out 0.5 s, black 0.85 s, the room fades up 0.45 s. */
  fadeOut: [10.2, 10.7] as const,
  roomIn: [11.55, 12.0] as const,
  /** Shot 2 — the inspection room: a still establishing beat, then a drift that starts gently with the door
   *  opening and comes to rest just before it shuts; a held beat; a restrained push. */
  shot2: [11.55, 19.35] as const,
  roomDrift: [12.95, 15.6] as const,
  /** Shot 3 — the dossier: a minimal push onto "COMMISSIONING READINESS", then still from ~22.45. */
  shot3: [19.35, 23.35] as const,
  /** Shot 4 — hard cut to black; the title appears on the impact. */
  black: 23.35,
  titleIn: 23.35,
  titleOut: 26.35,
  end: 27.55,

  /** Sound (see MORNING_FILM_ASSETS.sounds for the source of each file). */
  car: 1.0, // after 1 s of silence: approaches (loudest ~4 s), slows, idles, engine off ~6.2 s
  activity: 3.0, // facility activity: through the lobby glass; over the black it becomes the activity heard through the room wall
  carDoor: 6.55, // car door opens 6.70, slams 8.26
  doorOpen: 12.85, // after the room has been seen empty for ~0.85 s: the handle turns, the door opens (to ~14.0)
  footsteps: 14.35, // seven steps: 14.38, 14.96, 15.53 | 16.18, 16.71, 17.22, 17.79 — stop at the table
  doorClose: 15.635, // pulled shut: latch bolt 15.72, door home 15.85 (= doorClose + DOOR_SHUT_OFFSET)
  paper: 20.25, // ~1.58 s, faded naturally → ends ~21.83
  quiet: 22.3, // the last faint room sound fades out (baked into the end of the activity file) → ~1.5 s near-silence
  impact: 23.35, // exactly with the title
} as const;

/** Where the door lands in its frame (latch home) inside door_close.wav. The ambience drop is keyed to it. */
export const DOOR_SHUT_OFFSET = 0.215;
/** How far the outside activity drops when the door shuts: −18 dB. */
export const SEALED_LEVEL = 0.126;

export const MORNING_FILM_ASSETS = {
  images: {
    exterior: "/assets/cinematics/morning/exterior.jpg",
    room: "/assets/cinematics/morning/room.jpg",
    dossier: "/assets/cinematics/morning/dossier.jpg",
  },
  /**
   * Trimmed/levelled copies of the supplied Epidemic Sound recordings only (originals untouched in
   * assets-src/sfx/epidemic/). No generated or synthesised sound is used.
   */
  sounds: {
    car: "/assets/sfx/inspection/car_arrival.wav", // ES Car Fiat Panda 2003 Arriving Slow — 18.6 s → end
    carDoor: "/assets/sfx/inspection/car_door.wav", // ES Car … Seat Belt Get Out Slam Door — open + slam
    activity: "/assets/sfx/inspection/facility_activity.wav", // ES Ambience Office Quiet … — 107–126.9 s, filtered
    doorOpen: "/assets/sfx/inspection/door_open.wav", // ES Doors Wood Hotel Room Door Handle Open — 0.1–1.25 s
    footsteps: "/assets/sfx/inspection/footsteps.wav", // ES Footsteps Human Heels Walking Concrete 01 — whole
    doorClose: "/assets/sfx/inspection/door_close.wav", // ES Doors Wood Back Door Close — whole
    paper: "/assets/sfx/inspection/paper_dossier.wav", // ES Paper Handle Folder Grab Open … — 0.1–1.68 s, faded
    impact: "/assets/sfx/inspection/title_impact.wav", // ES Designed Boom Impact Dark Cinematic Heavy Hit — 0–3.8 s
    // Hand-off (WhitfieldOpening)
    roomQuiet: "/assets/sfx/inspection/room_quiet.wav", // ES Ambience Office … — 140–146 s, sealed-room filter
    // Inspection (InspectionSequence)
    roomLoop: "/assets/sfx/inspection/room_quiet_loop.wav", // ES Ambience Office … — 140–151 s, same filter, seamless loop
    paperSettle: "/assets/sfx/inspection/paper_settle.wav", // ES Paper … — 2.55–3.4 s: a file set down on the table
  },
} as const;

/** The hand-off into Whitfield's opening, in seconds after the film ends (on black). */
export const WHITFIELD_HANDOFF = {
  roomQuiet: 0.0,
  dialogueIn: 1.6,
} as const;
