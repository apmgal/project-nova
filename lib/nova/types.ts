// Generic types for the Project NOVA narrative engine.
// These describe the shape of the JSON content in /data — nothing here is
// specific to Act 1 story content. The engine reads whatever the JSON gives it.

export type Flags = Record<string, boolean>;

export interface ProjectMetrics {
  budgetRemaining: number;
  scheduleHealth: number;
  riskExposure: number;
  regulatoryReadiness: number;
  benefitsRealisationScore: number;
  boardConfidence: number;
  stakeholderGoodwill: number;
  teamMorale: number;
  [key: string]: number;
}

export interface Relationships {
  [characterId: string]: number;
}

export interface GameState {
  currentScene: string;
  projectMetrics: ProjectMetrics;
  relationships: Relationships;
  reputation: { tags: string[] };
  flags: Flags;
  choiceHistory: ChoiceHistoryEntry[];
  /** Key into assets.json's `backgrounds` map for whatever backdrop is
   * currently in effect, carried forward across lines/scenes until a line
   * explicitly sets a new one. Persisted so a reload can show the right
   * backdrop before the resumed scene's first line even renders. */
  currentBackground: string | null;
  /** Per-tool-screen record of which card ids have been correctly placed
   * so far, keyed by toolId. An entry existing (even empty) means the
   * player has reached that tool screen's action phase. */
  toolProgress: Record<string, string[]>;
  /** Per-tool-screen record of which bucket each card currently sits in,
   * keyed by toolId then cardId. Used by "priority_assignment" tools
   * (e.g. MoSCoW) where every bucket is a valid placement and a card can
   * be moved between buckets — unlike toolProgress's simple placed/not
   * list for "sort_into_buckets" tools, this needs to remember WHICH
   * bucket, so a re-placement can refund the old bucket's cost. */
  toolPlacements: Record<string, Record<string, string>>;
}

export interface ChoiceHistoryEntry {
  sceneId: string;
  choiceId: string;
  optionText: string;
  timestamp: string;
}

export interface Scene {
  sceneId: string;
  title: string;
  act: string;
  screenRange?: string;
  screenType?: string;
  location: string | null;
  charactersInvolved: string[];
  pmConcept?: string;
  contentSummary?: string;
  worldMemoryBeat?: string | null;
  variablesTouched?: string[];
  dialogueId: string | null;
  choicesId: string | null;
  /** References a tool_screens.json entry (e.g. PESTLE/SWOT sort screens).
   * When set, dialogueId's lines play first, then this interactive
   * ToolScreen, then (if postToolDialogueId is set) more dialogue, then
   * choices or a plain Continue button. */
  toolId?: string | null;
  /** Dialogue block shown after the tool screen completes, before this
   * scene's final action (choices/Continue). Only meaningful alongside
   * toolId — lets a reaction line follow the interactive tool instead of
   * every line being forced to play before it. */
  postToolDialogueId?: string | null;
  trigger?: { previousScene: string | null };
  nextScenes: string[];
  needsWriting?: boolean;
  flagsSet?: string[];
  note?: string;
}

export interface DialogueLine {
  speaker: string;
  emotion: string | null;
  text: string;
  condition?: string;
  /** Key into assets.json's `backgrounds` map. Only present on lines that
   * change the backdrop; absent lines keep whatever was last shown. */
  background?: string;
}

export interface DialogueBlock {
  dialogueId: string;
  sourceScene: string;
  lines: DialogueLine[];
  needsWriting?: boolean;
}

export interface ChoiceOption {
  text: string;
  effects?: Record<string, number>;
  flags?: Flags;
  nextScene: string | null;
  reaction?: string;
}

export interface ChoiceBlock {
  choiceId: string;
  sourceScene: string;
  options: ChoiceOption[];
  needsWriting?: boolean;
  engineNote?: string;
}

export interface Character {
  id: string;
  name: string;
  role?: string;
  portraits: Record<string, string> | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tool screens (tool_screens.json) — generic bucket-assignment interactions.
// Two `type`s share this shape:
//   - "sort_into_buckets" (PESTLE/SWOT): each card has exactly one
//     correctBucket; wrong placements bounce back with no penalty.
//   - "priority_assignment" (MoSCoW): every bucket is a valid placement —
//     each card has a costByBucket instead, and an optional flagsByBucket.
// The engine never branches on toolId or bucket/card names, only on which
// of these optional fields a card/block happens to have.
// ---------------------------------------------------------------------------

export interface ToolCard {
  id: string;
  text: string;
  /** sort_into_buckets only: the one bucket this card is correct in. */
  correctBucket?: string;
  /** priority_assignment only: cost (usually deducted from budgetVariable)
   * for placing this card in each bucket. Re-placing into a different
   * bucket refunds the old bucket's cost before charging the new one. */
  costByBucket?: Record<string, number>;
  /** priority_assignment only: flags to set (true only — never false) when
   * this card lands in a given bucket. Re-evaluated on every placement, so
   * moving a card out of a bucket doesn't retroactively unset flags it
   * already caused — only overcommitRule's flag is live/reactive. */
  flagsByBucket?: Record<string, Flags>;
  championedBy?: string;
}

export interface ToolScreenBlock {
  toolId: string;
  sourceScene: string;
  type: string;
  instructions?: string;
  buckets: string[];
  cards: ToolCard[];
  wrongPlacementBehavior?: {
    penalty?: string;
    reaction?: string;
  };
  selectionBehavior?: string;
  selectedCardStyle?: string;
  completionCondition?: string;
  /** priority_assignment only: which ProjectMetrics key placements deduct
   * from/refund to. Defaults to "budgetRemaining" if unset. */
  budgetVariable?: string;
  /** priority_assignment only: a rule the engine checks after every
   * placement — if `bucket` ends up holding `minCount` or more cards, it
   * sets `reactionFlag` true (and clears it again if the player moves
   * cards back out below the threshold), for dialogue to key a reaction
   * line off. `trigger`/`condition`/`note` are documentation only. */
  overcommitRule?: {
    condition?: string;
    bucket: string;
    minCount: number;
    trigger?: string;
    reactionFlag: string;
    note?: string;
  };
  onComplete: {
    nextScene: string;
  };
}
