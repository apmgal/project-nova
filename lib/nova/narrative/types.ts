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

export interface NarrativeSceneScript {
  id: string;
  background: {
    src: string;
    alt?: string;
  };
  /** Omit entirely for a silent scene. */
  music?: NarrativeMusic | null;
  characters: NarrativeCharacter[];
  lines: NarrativeLine[];
}
