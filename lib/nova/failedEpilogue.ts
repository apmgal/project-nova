import type { TeamsMessage } from "@/lib/nova/finale";

/**
 * The "Not satisfactory" epilogue (PROTOTYPE, /prototype/inspection-film): what follows the Final
 * Determination when the inspection outcome is "unsatisfactory" (buildDetermination → evaluateQualityGate,
 * unchanged). Report → the dark office → Mike's Teams message → the facility exterior → one closing card →
 * Decision Analysis.
 *
 *   1. The office, late evening — the "No News" office, now dark: the laptop's glow, rain-grey windows.
 *      Room tone only; a slow push towards the desk. A Teams message from Mike, read at the player's pace.
 *      When it's closed the laptop screen dims and the room holds in silence.
 *   2. The facility at dusk — the score dials up for the departure; a held frame, then a slow pull-back,
 *      a long fade to black.
 *   3. One closing card — PROJECT NOVA / Not Satisfactory / the sentence / Review Your Decisions.
 *
 * The other outcomes keep their existing hand-off (EndingHandoff). Nothing here changes scoring, the
 * determination or the decision data.
 */

/** Part one, in seconds from the moment the epilogue starts (on black, after the report has faded). */
export const EPILOGUE_OFFICE = {
  /** The room is heard before it is seen. */
  roomTone: 0.3,
  officeIn: 0.8,
  /** Length of the slow push towards the desk (it runs on, eased, while the player reads). */
  pushDuration: 26,
  /** ~3 s after the office has fully appeared: the message arrives. */
  message: 5.2,
} as const;

/** Part two, in seconds from the moment the player closes the message. */
export const EPILOGUE_AFTER = {
  /** The Teams card has gone; the laptop screen dims. */
  screenDim: 0.6,
  screenDimFade: 2.6,
  /** The dimmed room held (~2 s past the dim; no dialogue, the music still low), then it fades away. */
  officeOut: 4.6,
  officeFade: 2.2,
  /** The facility departure: up from black, a beat on the closer frame, then a slow retreat to the full
   *  picture (~11 s, eased), held briefly, then a long fade to black. ~15 s on screen. */
  exteriorIn: 6.6,
  pullBack: 7.4,
  pullBackDuration: 11.0,
  exteriorOut: 19.6,
  exteriorFade: 3.8,
  /** The closing card. */
  closingTitle: 24.6,
  closingOutcome: 26.1,
  closingSentence: 27.5,
  closingAction: 30.0,
} as const;

/**
 * The score: ONE continuous cue from the office's first frame to the closing card — never paused or restarted.
 * Gain levels (0–1) and ramp times (s) for each beat; the cue loops inside the same buffer if a read runs long.
 */
export const EPILOGUE_MUSIC = {
  /**
   * main_menu_theme.mp3 (≈130 s) is long enough to cover the whole epilogue; on a very long read it loops the
   * whole track (loopEnd 0 = end of the file).
   */
  loopStart: 0,
  loopEnd: 0,
  /** The office: as quiet as the report's opening (the report plays this theme at 0.12 → 0.26). */
  office: { level: 0.1, ramp: 4.0 },
  /** Toned down under Mike's message (the Teams note stays clear), and kept down through the dim office. */
  message: { level: 0.035, ramp: 1.2 },
  afterMessage: { level: 0.04, ramp: 2.0 },
  officeOut: { level: 0.045, ramp: 2.0 },
  /** Only the facility departure dials it up — back to the report's full level, slowly. */
  exterior: { level: 0.28, ramp: 7.0 },
  exteriorOut: { level: 0.2, ramp: 3.0 },
  /** At the closing card the cue fades away over this long (s), then the source is stopped. */
  resolve: 10.0,
} as const;

/** Mike's message — the existing Teams card, character id "marcus" (Mike Elloian, the programme sponsor). */
export const MIKE_MESSAGE: TeamsMessage & { role: string } = {
  id: "marcus",
  from: "Mike Elloian",
  role: "Project Sponsor",
  initials: "ME",
  colour: "#7c2d12",
  text:
    "I've seen the determination. We won't be proceeding with commissioning as planned.\n\n" +
    "I'll update the board and the wider team tomorrow. Thanks for everything you've done to get us here.",
  ack: "Close",
};

export const EPILOGUE_CLOSING = {
  title: "Project Nova",
  outcome: "Not Satisfactory",
  sentence: "The facility did not receive clearance to proceed with commissioning.",
  action: "Review Your Decisions",
} as const;

export const EPILOGUE_ASSETS = {
  /** The office late in the evening (supplied still): the laptop's glow, the rest of the room dark. */
  office: "/assets/cinematics/epilogue/office_evening.jpg",
  /** The facility at blue hour (supplied still, 1672×941): the departure shot. */
  exterior: "/assets/cinematics/epilogue/facility_departure.jpg",
  sounds: {
    /** ES Ambience Office … (supplied), sealed-room filter — a quiet, empty room. */
    roomTone: "/assets/sfx/inspection/room_quiet_loop.wav",
    /** The existing Teams note (from the supplied Teams call recording), as in "No News". */
    ping: "/assets/sfx/finale/teams_ping.wav",
    /**
     * Building / ventilation hum: the low band (28–230 Hz) of the supplied ES office ambience, levelled and
     * looped (no voices left in it). Under the office, and very faintly under the exterior.
     */
    buildingHum: "/assets/sfx/epilogue/plant_room_tone_loop.wav",
    /** The same theme as the Final Determination report before it (FINALE_ASSETS.sounds.music). One Web Audio cue. */
    music: "/assets/music/main_menu_theme.mp3",
  },
  volumes: { roomTone: 0.6, ping: 0.4, humOffice: 0.05, humExterior: 0.035 },
} as const;
