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

// ---------------------------------------------------------------------------
// Office Journey — a reusable "walk between two points, illusion of
// movement, no player controls" system. Distinct from NarrativeSceneScript
// (a single background + a cast that's on stage the whole time) because a
// journey moves through several backgrounds in one continuous beat, with
// footsteps/camera-push active while walking and paused the moment someone
// starts talking. Every future office-to-office transition (a boardroom,
// a lab, another meeting room) is just a new OfficeJourneyScript — no new
// component code, the same way a new NarrativeSceneScript is all a new
// dialogue beat needs.
// ---------------------------------------------------------------------------

export interface OfficeJourneyWalkLeg {
  type: "walk";
  /** Background for this leg, and — until the next walk leg — for any
   * conversation leg that follows it (a conversation never carries its
   * own background; it happens wherever the walk left off). */
  background: {
    src: string;
    alt?: string;
  };
  /** How long this leg plays before auto-advancing. Spec default: a
   * hallway leg runs ~3.5s. */
  durationMs?: number;
  /** Looping footstep audio while this leg plays. Omit for a silent
   * walk (e.g. while an asset doesn't exist yet) rather than pointing at
   * a file that isn't there — SceneAudio would swallow a missing file
   * silently anyway, but an explicit omission here is more honest about
   * what's actually wired up. */
  footstepsSrc?: string;
  footstepsVolume?: number;
  /** Overrides the walking "camera push" for this specific leg — the
   * spec's ~100%→104% zoom plus a slight drift, distinct from
   * SceneBackground's own slower ambient default (that default is tuned
   * for a static dialogue scene, not a leg that's meant to read as
   * forward motion). Omit to use OfficeJourney's own walking default. */
  kenBurns?: KenBurnsLegOverride;
}

export interface OfficeJourneyConversationLeg {
  type: "conversation";
  /** The one character who steps into frame for this leg. A journey's
   * conversation legs are deliberately single-character (a hallway
   * encounter, not a full scene) — a multi-character stop belongs in a
   * NarrativeSceneScript instead. */
  character: NarrativeCharacter;
  lines: NarrativeLine[];
}

export type OfficeJourneyLeg = OfficeJourneyWalkLeg | OfficeJourneyConversationLeg;

/** Subset of KenBurnsConfig a leg author actually needs to tune (duration
 * and zoom strength) without reaching into kenBurns.ts's full shape or
 * its `paused` flag, which OfficeJourney itself drives based on leg type. */
export interface KenBurnsLegOverride {
  scaleTo?: number;
  durationMs?: number;
}

export interface OfficeJourneyScript {
  id: string;
  /** Persistent background music for the whole journey — set this to the
   * same src the previous scene was already playing (e.g. the reception
   * theme) so the two SceneAudio instances overlap-fade into what reads
   * as one continuous track picking back up, rather than a hard cut into
   * silence and a fresh fade-in. Omit for a journey with no music of its
   * own (just footsteps/ambience). */
  music?: NarrativeMusic | null;
  /** Low-level room tone, layered under the music/footsteps for the
   * entire journey (doesn't restart between legs). Omit if no ambience
   * asset exists yet. */
  ambience?: {
    src: string;
    volume?: number;
  } | null;
  /** The background this journey's very first crossfade fades FROM,
   * instead of fading in from black — pass the previous scene's own
   * background src (e.g. Reception's) so "Reception → Hallway A" reads
   * as one continuous shot, matching how every later leg-to-leg
   * transition crossfades too. Omit to fade in from black (the very
   * first journey in the game, with nothing before it to crossfade
   * from). */
  fromBackgroundSrc?: string;
  legs: OfficeJourneyLeg[];
}
