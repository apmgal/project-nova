// Types for the reusable "narrative scene" engine — a lightweight, purely
// presentational cinematic-scene player (full-screen background, positioned
// character portraits, bottom dialogue box, background music) used for
// story beats that play *before* a player enters the main management-sim
// engine (lib/nova/data.ts + GameRoot's scene machine). Deliberately kept
// separate from that engine's Scene/DialogueBlock types: those are wired
// to save state, flags, choices and tool screens, whereas a narrative
// scene is a straight linear beat with a single onComplete exit. Future
// scenes (stakeholder meetings, boardroom discussions, office
// conversations) are just new NarrativeSceneScript objects — no engine
// changes required.

export type ScenePosition = "left" | "center" | "right";

export interface NarrativeCharacter {
  /** Stable id, referenced by a line's `speaker`. */
  id: string;
  /** Display name shown in the dialogue box's name plate. */
  name: string;
  /** Portrait image path (production asset under /assets/characters/). */
  portraitSrc: string;
  /** Where on stage this character stands. */
  position: ScenePosition;
}

export interface NarrativeLine {
  /** Character id from the scene's `characters` list, or "narrator" for
   * unattributed scene-setting text (rendered without a name plate). */
  speaker: string;
  text: string;
  /** Optional voice-over clip for this line. Purely additive — a missing
   * file or an absent field both just mean "no voice", the text still
   * displays and advances normally either way. */
  voiceSrc?: string;
}

export interface NarrativeMusic {
  src: string;
  /** Target (post fade-in) volume, 0-1. Defaults to a sensible ambient
   * level if omitted. */
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface SceneBackgroundOverlay {
  src: string;
  alt?: string;
  /** Percentage-based placement against the background's own box (e.g.
   * "26%"), so it lines up with a fixed feature in that specific photo
   * (a wall panel, a sign). Width drives the box; height follows from
   * the overlay image's own aspect ratio. */
  top: string;
  left: string;
  width: string;
  /** Source image's width ÷ height. Width drives the overlay's box;
   * this gives it a defined height (needed for next/image's `fill`
   * mode) without SceneBackground having to know anything about a
   * specific piece of art. */
  aspectRatio: number;
}

export interface NarrativeSceneScript {
  id: string;
  background: {
    src: string;
    alt?: string;
    /** Decorative art composited onto the backdrop itself — e.g. a
     * wall-mounted logo — rendered with the same blur/brightness/fade
     * treatment as the background so it reads as part of the same photo
     * rather than a sticker placed on top of it. */
    overlay?: SceneBackgroundOverlay;
  };
  /** Omit entirely for a silent scene. */
  music?: NarrativeMusic | null;
  characters: NarrativeCharacter[];
  lines: NarrativeLine[];
}
