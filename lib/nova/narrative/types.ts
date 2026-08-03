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

export interface CharacterExpressionArt {
  /** Base portrait for this expression. */
  src: string;
  /** This expression's blink variant. Omit if no blink art exists for
   * it — CharacterPortrait simply never blinks while this expression is
   * active rather than faking one, per "use the available blink image
   * where one exists." */
  blinkSrc?: string;
}

export interface NarrativeCharacter {
  /** Stable id, referenced by a line's `speaker`. */
  id: string;
  /** Display name shown in the dialogue box's name plate. */
  name: string;
  /** Where on stage this character stands. */
  position: ScenePosition;
  /** Expression name -> art. Every character needs at least a
   * "neutral" entry (used before any line sets one explicitly, and as
   * the fallback if a line references an expression this character
   * doesn't have). Dialogue lines pick from these same keys via
   * NarrativeLine.expression — adding a new character or a new
   * expression for an existing one is purely new image files plus a
   * new entry here, no changes to CharacterPortrait itself. */
  expressions: Record<string, CharacterExpressionArt>;
}

export interface SceneVisual {
  src: string;
  alt?: string;
  /** Source image's width ÷ height, so the inset panel gets a sized box
   * (needed for next/image's `fill` mode) without the rendering
   * component having to know anything about a specific screenshot. */
  aspectRatio: number;
  /** Small caption under the panel, e.g. "Group Tax SharePoint". */
  label?: string;
  /** Render at a larger max-width than the default inset size — for a
   * screenshot (like a dense tracker or dashboard) where the default size
   * makes its contents hard to read. Omit/false for the normal size. */
  large?: boolean;
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
  /** Optional on-screen insert (a SharePoint page, a tracker, a
   * dashboard, a document — anything the characters are pointing at)
   * shown only while this exact line is active. Absent on the next line
   * means it's gone again — sequencing "show A, then show B" is just
   * "put A on line N and B on line N+1". */
  visual?: SceneVisual;
  /** Expression key (from the speaking character's `expressions` map)
   * to switch them to for this line. Omitted means "keep whatever
   * expression they were last shown in" — a character defaults to
   * "neutral" the first time they appear if their very first line
   * doesn't set one. Unknown keys fall back to "neutral" rather than
   * rendering nothing. */
  expression?: string;
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

