import type { OfficeJourneyScript } from "@/lib/nova/narrative/types";
import { RECEPTION_INTRO_SCENE } from "./receptionIntro";

// ---------------------------------------------------------------------------
// Office Journey: Reception → Mike Elloian's (Sponsor's) office. Plays once,
// immediately after Reception Intro's last line and before ACT1_SCENE01
// (Arrival & Handover) begins — the player's first "walk" through the
// building, with no controls of their own. Uses the reusable OfficeJourney
// component/types; this file is purely content, the same relationship
// receptionIntro.ts has to NarrativeScene.
//
// Priya's line below is a placeholder per direction — swap in real
// dialogue later, no component changes needed either way.
//
// footstepsSrc/ambience are intentionally omitted: no footstep or office-
// ambience audio assets exist in the repo yet. OfficeJourney treats an
// absent src as a silent no-op, so the walk still plays correctly (camera
// push + crossfades + Priya's conversation all work today) — wire in
// `footstepsSrc: "/assets/sfx/footsteps_loop.mp3"` etc. on each walk leg,
// and an `ambience: { src: ... }` on the script, the moment those files
// exist. No other change needed.
// ---------------------------------------------------------------------------

export const OFFICE_JOURNEY_TO_SPONSOR: OfficeJourneyScript = {
  id: "office_journey_reception_to_sponsor",
  // Same track Reception Intro was already playing — the two SceneAudio
  // instances overlap-fade (Reception's own exit fade-out, this journey's
  // fade-in) into what reads as one continuous cue picking back up,
  // rather than a hard cut to silence.
  music: {
    src: "/assets/music/Reception_theme01.mp3",
    volume: 0.3,
    fadeInMs: 1200,
    fadeOutMs: 1400,
  },
  ambience: null,
  // Crossfades FROM Reception's own backdrop into Hallway A, instead of
  // fading in from black, so leaving the desk reads as one continuous shot.
  fromBackgroundSrc: RECEPTION_INTRO_SCENE.background.src,
  legs: [
    {
      type: "walk",
      background: {
        src: "/assets/backgrounds/bg_hallway_a.png",
        alt: "Office hallway leading away from reception",
      },
      durationMs: 3500,
    },
    {
      type: "conversation",
      character: {
        id: "priya",
        name: "Priya",
        position: "center",
        expressions: {
          // Single reference photo covers every expression key, same
          // pattern assets.json already uses for Priya elsewhere (and
          // for Camille/Vaughn) — no per-expression art exists for her.
          neutral: { src: "/assets/characters/priya.jpg" },
          warm: { src: "/assets/characters/priya.jpg" },
        },
      },
      lines: [
        {
          speaker: "priya",
          text: "[PLACEHOLDER — Priya's hallway line goes here.]",
        },
      ],
    },
    {
      type: "walk",
      background: {
        src: "/assets/backgrounds/bg_hallway_b.png",
        alt: "Office hallway deeper into the building, past the portfolio dashboard and coffee station",
      },
      durationMs: 3500,
    },
    {
      type: "walk",
      // Brief arrival beat — crossfades into the Sponsor's office itself
      // before handing off to ACT1_SCENE01 (which renders with the
      // engine's normal plain dialogue chrome, no background of its own;
      // see the scope note this feature shipped with).
      background: {
        src: "/assets/backgrounds/bg_marcus_office.jpg",
        alt: "Mike Elloian's office",
      },
      durationMs: 1800,
      kenBurns: { scaleTo: 1.1 * 1.02, durationMs: 1800 },
    },
  ],
};
