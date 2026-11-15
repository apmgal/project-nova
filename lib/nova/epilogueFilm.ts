import type { DeterminationKind, TeamsMessage } from "@/lib/nova/finale";
import {
  EPILOGUE_AFTER,
  EPILOGUE_ASSETS,
  EPILOGUE_CLOSING,
  EPILOGUE_MUSIC,
  EPILOGUE_OFFICE,
  MIKE_MESSAGE,
} from "@/lib/nova/failedEpilogue";

/**
 * The epilogue films (PROTOTYPE, /prototype/inspection-film). One player (FailedInspectionEpilogue) plays any of
 * them: office → Mike's Teams message (waits for the player) → facility exterior → one closing card → Decision
 * Analysis. Each film is data: its two stills and how the camera moves on them, its timings, its music cue and
 * levels, Mike's message and the closing card.
 *
 *   - NOT_SATISFACTORY_FILM: the existing "Not satisfactory" epilogue, built from failedEpilogue.ts unchanged.
 *   - CONDITIONAL_FILM: "Subject to conditions" — the same structure, warmer: the office at sunset, the facility
 *     at sunset with a slow push towards the lit entrance (the failed film retreats from the buildings).
 *   - SATISFACTORY_FILM: "Satisfactory" — the same structure, brightest: the office in the morning, the campus in
 *     golden morning light with a rising, widening reveal.
 *
 * Nothing here changes scoring or the determination.
 */

type Level = { level: number; ramp: number };
type Move = { from: string; to: string; ease: string; origin: string };
type Frame = { src: string; aspect: number; fx: number; fy: number; filter?: string; overlay?: string };

export type EpilogueFilm = {
  id: "not_satisfactory" | "conditional" | "satisfactory";
  office: Frame & {
    /** The slow push on the office still (runs on, eased, while the player reads). */
    move: Move;
    /** A lit laptop screen in the still: brightened as the message lands, dimmed once it is closed. */
    screen?: { clip: string; deskShadow: string };
  };
  exterior: Frame & { move: Move };
  /** Part one, seconds from the start of the epilogue. */
  timing: { roomTone: number; officeIn: number; pushDuration: number; message: number };
  /** Part two, seconds from the moment the player closes the message. `move` / `moveDuration`: the exterior's camera. */
  after: {
    musicReturn: number;
    screenDim: number; screenDimFade: number;
    officeOut: number; officeFade: number;
    exteriorIn: number; move: number; moveDuration: number; exteriorOut: number; exteriorFade: number;
    closingTitle: number; closingOutcome: number; closingSentence: number; closingAction: number;
  };
  music: {
    src: string;
    /** The in-buffer loop for a long read (loopEnd 0 = the end of the file). */
    loopStart: number; loopEnd: number;
    /** Equal-power blend across the loop seam (s), for a loop on a musical boundary that isn't an exact repeat. */
    crossfade?: number;
    /** Where in the track the cue begins (s; default 0). */
    offset?: number;
    /** Loop only while Mike's message is open; once it is closed the cue plays straight on. */
    loopOnlyWhileReading?: boolean;
    office: Level; message: Level; afterMessage: Level; officeOut: Level; exterior: Level; exteriorOut: Level;
    resolve: number;
  };
  sounds: { roomTone: string; ping: string; buildingHum: string };
  volumes: { roomTone: number; ping: number; humOffice: number; humExterior: number };
  message: TeamsMessage & { role: string };
  closing: { title: string; outcome: string; sentence: string; action: string };
};

/** "Not satisfactory" — exactly the existing epilogue (values from failedEpilogue.ts and its component). */
export const NOT_SATISFACTORY_FILM: EpilogueFilm = {
  id: "not_satisfactory",
  office: {
    src: EPILOGUE_ASSETS.office,
    aspect: 1536 / 1024, fx: 0.42, fy: 0.55,
    move: { from: "scale(1.02)", to: "scale(1.1) translate3d(1.2%, -0.6%, 0)", ease: "cubic-bezier(0.22, 0.1, 0.3, 1)", origin: "40% 60%" },
    screen: {
      clip: "polygon(26.4% 44%, 47% 41.8%, 50% 64.8%, 33.7% 71.8%)",
      deskShadow: "radial-gradient(ellipse 24% 17% at 42% 76%, rgba(3,5,9,0.55) 0%, rgba(3,5,9,0) 100%)",
    },
  },
  exterior: {
    src: EPILOGUE_ASSETS.exterior,
    aspect: 1672 / 941, fx: 0.5, fy: 0.62,
    filter: "saturate(0.88) brightness(0.86) contrast(1.03)",
    overlay: "linear-gradient(180deg, rgba(10,16,30,0.42) 0%, rgba(10,16,30,0.12) 45%, rgba(10,16,30,0.28) 100%)",
    // The departure: a closer frame on the buildings, then an eased retreat to the whole picture.
    move: { from: "scale(1.2) translate3d(-1.2%, 1.6%, 0)", to: "scale(1.0) translate3d(0, 0, 0)", ease: "cubic-bezier(0.33, 0, 0.2, 1)", origin: "55% 52%" },
  },
  timing: { ...EPILOGUE_OFFICE },
  after: {
    musicReturn: 0.4,
    screenDim: EPILOGUE_AFTER.screenDim, screenDimFade: EPILOGUE_AFTER.screenDimFade,
    officeOut: EPILOGUE_AFTER.officeOut, officeFade: EPILOGUE_AFTER.officeFade,
    exteriorIn: EPILOGUE_AFTER.exteriorIn, move: EPILOGUE_AFTER.pullBack, moveDuration: EPILOGUE_AFTER.pullBackDuration,
    exteriorOut: EPILOGUE_AFTER.exteriorOut, exteriorFade: EPILOGUE_AFTER.exteriorFade,
    closingTitle: EPILOGUE_AFTER.closingTitle, closingOutcome: EPILOGUE_AFTER.closingOutcome,
    closingSentence: EPILOGUE_AFTER.closingSentence, closingAction: EPILOGUE_AFTER.closingAction,
  },
  music: { src: EPILOGUE_ASSETS.sounds.music, ...EPILOGUE_MUSIC },
  sounds: { roomTone: EPILOGUE_ASSETS.sounds.roomTone, ping: EPILOGUE_ASSETS.sounds.ping, buildingHum: EPILOGUE_ASSETS.sounds.buildingHum },
  volumes: { ...EPILOGUE_ASSETS.volumes },
  message: MIKE_MESSAGE,
  closing: { ...EPILOGUE_CLOSING },
};

/**
 * "Subject to conditions" — cautious optimism, unfinished business. Same architecture, same Teams card, same
 * closing card; a warmer office, a sunset exterior and a slow push towards the facility's lit entrance.
 */
export const CONDITIONAL_FILM: EpilogueFilm = {
  id: "conditional",
  office: {
    // The office at sunset (supplied still, 1672×941): the facility through the windows, empty desks.
    src: "/assets/cinematics/epilogue/office_sunset.jpg",
    aspect: 1672 / 941, fx: 0.4, fy: 0.6,
    filter: "saturate(0.95) brightness(0.96)",
    // From the wide room, a very slow push towards the laptop (no screen effects: its screen is dark).
    move: { from: "scale(1.0)", to: "scale(1.07) translate3d(0.6%, -0.4%, 0)", ease: "cubic-bezier(0.22, 0.1, 0.3, 1)", origin: "38% 66%" },
  },
  exterior: {
    // The facility at sunset (supplied still, 1672×941): glazing lit, wet forecourt, the entrance at the centre.
    src: "/assets/cinematics/epilogue/facility_sunset.jpg",
    aspect: 1672 / 941, fx: 0.5, fy: 0.55,
    filter: "saturate(0.92) brightness(0.93) contrast(1.02)",
    overlay: "linear-gradient(180deg, rgba(14,18,30,0.22) 0%, rgba(14,18,30,0.04) 45%, rgba(14,18,30,0.2) 100%)",
    // The way ahead: from the wide view, a slow, restrained move in towards the lit entrance (≈55% 66% of the
    // picture), settling a little closer. A still can only scale — no 3D, no parallax.
    move: { from: "scale(1.0) translate3d(0, 0, 0)", to: "scale(1.12) translate3d(-0.4%, -0.6%, 0)", ease: "cubic-bezier(0.4, 0, 0.25, 1)", origin: "55% 66%" },
  },
  timing: { roomTone: 0.3, officeIn: 0.8, pushDuration: 26, message: 5.2 },
  after: {
    // The office holds ~2 s after the message closes before the music comes back.
    musicReturn: 2.0,
    screenDim: 0.6, screenDimFade: 2.6,
    officeOut: 4.6, officeFade: 2.2,
    // The exterior: up from black, the wide view held to be taken in, then ~10 s in towards the entrance,
    // ~2 s held closer, and a long fade. ~17 s on screen including the fades.
    exteriorIn: 6.6, move: 8.4, moveDuration: 10.0, exteriorOut: 20.4, exteriorFade: 3.6,
    closingTitle: 24.8, closingOutcome: 26.3, closingSentence: 27.7, closingAction: 30.2,
  },
  music: {
    /**
     * "Cold Conclusion" — August Wilhelmsson (supplied, Epidemic Sound; 100 BPM, ≈145 s; "hopeful, mysterious").
     * A quiet ambient opening (≈0–27 s), then a slow build from ≈27 s to ≈68 s. At a normal reading pace the
     * build arrives as the office fades and carries the facility shot; the closing card fades it before its peak.
     * While Mike's message is open the cue circles a four-bar stretch of the quiet opening (14.0 → 23.6 s,
     * 9.6 s = 4 bars, crossfaded), so a long read never runs into the build; closing the message lets it play on.
     * The cue begins 10 s into the track, so the message lands inside that loop and, closed at a normal pace,
     * the build arrives within a few seconds of the facility shot. The opening is ≈15 dB quieter than the
     * build, hence the higher office levels.
     */
    src: "/assets/music/cold_conclusion_august_wilhelmsson.mp3",
    offset: 10, loopStart: 14.0, loopEnd: 23.6, crossfade: 0.25, loopOnlyWhileReading: true,
    office: { level: 0.6, ramp: 4.0 },
    message: { level: 0.22, ramp: 1.2 },
    afterMessage: { level: 0.45, ramp: 3.0 },
    officeOut: { level: 0.45, ramp: 3.0 },
    /** The track's own build supplies the warmth; the gain eases to where the build sits comfortably. */
    exterior: { level: 0.4, ramp: 7.0 },
    exteriorOut: { level: 0.3, ramp: 3.0 },
    resolve: 10.0,
  },
  sounds: {
    roomTone: EPILOGUE_ASSETS.sounds.roomTone,
    ping: EPILOGUE_ASSETS.sounds.ping,
    buildingHum: EPILOGUE_ASSETS.sounds.buildingHum,
  },
  volumes: { roomTone: 0.5, ping: 0.4, humOffice: 0.04, humExterior: 0.03 },
  message: {
    ...MIKE_MESSAGE,
    text:
      "We've received conditional clearance. It's a step forward, but there are still findings we need to close before commissioning can proceed.\n\n" +
      "I'll work with Camille and Priya to agree the outstanding actions. Let's make sure we finish this properly.",
  },
  closing: {
    title: "Project Nova",
    outcome: "Subject to Conditions",
    sentence: "Conditional clearance has been granted. Outstanding requirements must be satisfied before commissioning can proceed.",
    action: "Review Your Decisions",
  },
};

/**
 * "Satisfactory" — an earned milestone: relief → recognition → accomplishment → optimism. Same architecture,
 * same Teams card, same closing card; the office in morning light, then the campus in golden morning light with
 * the camera rising and widening to reveal it (the other films retreat from / approach the buildings).
 */
export const SATISFACTORY_FILM: EpilogueFilm = {
  id: "satisfactory",
  office: {
    // The office in the morning (supplied still, 1672×941): sun through the windows, the facility beyond.
    src: "/assets/cinematics/epilogue/office_morning.jpg",
    aspect: 1672 / 941, fx: 0.4, fy: 0.6,
    filter: "saturate(0.96) brightness(0.97)",
    move: { from: "scale(1.0)", to: "scale(1.07) translate3d(0.6%, -0.4%, 0)", ease: "cubic-bezier(0.22, 0.1, 0.3, 1)", origin: "38% 66%" },
  },
  exterior: {
    // The campus in golden morning light (supplied still, 1672×941).
    src: "/assets/cinematics/epilogue/facility_morning.jpg",
    aspect: 1672 / 941, fx: 0.5, fy: 0.6,
    filter: "saturate(0.96) contrast(1.02)",
    overlay: "linear-gradient(180deg, rgba(10,18,34,0.16) 0%, rgba(10,18,34,0) 40%, rgba(10,18,34,0.12) 100%)",
    // The reveal: from a closer frame on the manufacturing buildings, the view widens while the framing rises
    // (the picture drifts down, more sky comes in) and settles on the whole campus. Scale and position only.
    move: { from: "scale(1.18) translate3d(-0.8%, -3.2%, 0)", to: "scale(1.0) translate3d(0, 0, 0)", ease: "cubic-bezier(0.35, 0, 0.2, 1)", origin: "55% 64%" },
  },
  timing: { roomTone: 0.3, officeIn: 0.8, pushDuration: 26, message: 5.2 },
  after: {
    musicReturn: 0.6,
    screenDim: 0.6, screenDimFade: 2.6,
    // ~2 s held on the office after the message closes, then over to the exterior.
    officeOut: 2.4, officeFade: 2.0,
    // Up from black on the closer frame, ~11 s rising/widening reveal, ~2 s held wide, then the fade.
    // ~17 s on screen including the fades.
    exteriorIn: 4.2, move: 5.0, moveDuration: 11.0, exteriorOut: 18.2, exteriorFade: 3.6,
    closingTitle: 22.4, closingOutcome: 23.9, closingSentence: 25.3, closingAction: 27.8,
  },
  music: {
    /**
     * "Yoda" — Experia (supplied, Epidemic Sound; 107 BPM, ≈122 s; "hopeful, euphoric"). It opens at its
     * gentlest and grows steadily (≈ −19 dB → −13 dB), so the levels keep it light in the office, under the
     * message, and bring it to its peak on the facility reveal. On a very long read the whole track loops.
     */
    src: "/assets/music/yoda_experia.mp3",
    loopStart: 0, loopEnd: 0,
    office: { level: 0.07, ramp: 4.0 },
    message: { level: 0.025, ramp: 1.2 },
    afterMessage: { level: 0.09, ramp: 2.5 },
    officeOut: { level: 0.13, ramp: 2.5 },
    /** The emotional high point: the wide reveal. */
    exterior: { level: 0.24, ramp: 8.0 },
    exteriorOut: { level: 0.19, ramp: 3.0 },
    resolve: 9.0,
  },
  sounds: {
    roomTone: EPILOGUE_ASSETS.sounds.roomTone,
    ping: EPILOGUE_ASSETS.sounds.ping,
    buildingHum: EPILOGUE_ASSETS.sounds.buildingHum,
  },
  volumes: { roomTone: 0.5, ping: 0.4, humOffice: 0.035, humExterior: 0.025 },
  message: {
    ...MIKE_MESSAGE,
    text:
      "We've received the final determination. Satisfactory — the facility is cleared to proceed with commissioning.\n\n" +
      "It's been a demanding few months, but we've reached an important milestone. Thank you for everything you've done to get us here.\n\n" +
      "I'll update the Board and coordinate the next steps with the team.",
  },
  closing: {
    title: "Project Nova",
    outcome: "Satisfactory",
    sentence: "The facility has received clearance to proceed with commissioning.",
    action: "Review Your Decisions",
  },
};

/** The epilogue film for a determination. */
export function epilogueFilmFor(kind: DeterminationKind): EpilogueFilm {
  return kind === "unsatisfactory" ? NOT_SATISFACTORY_FILM : kind === "conditional" ? CONDITIONAL_FILM : SATISFACTORY_FILM;
}
