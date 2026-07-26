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
   * When set, this scene's action phase (after dialogue finishes) is an
   * interactive ToolScreen instead of choices or a plain Continue button. */
  toolId?: string | null;
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
// Tool screens (tool_screens.json) — generic "sort cards into buckets"
// interactions. Reused across PESTLE/SWOT now and other boards later; the
// engine never branches on toolId or bucket/card names.
// ---------------------------------------------------------------------------

export interface ToolCard {
  id: string;
  text: string;
  correctBucket: string;
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
  onComplete: {
    nextScene: string;
  };
}
