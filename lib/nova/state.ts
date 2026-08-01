import type {
  GameState,
  Flags,
  Character,
  DialogueLine,
  ToolScreenBlock,
  RiskInvestigationBank,
} from "./types";
import { getCharacter, getDefaultGameState } from "./data";

const SAVE_KEY = "projectNova.saveGame.v1";

/** Relationship score at/above which a "neutral" beat is shown as "warm"
 * instead, for characters whose portrait set has a warm variant. Generic
 * mood-shading rule, not specific to any one character or act. */
export const WARM_RELATIONSHIP_THRESHOLD = 65;

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------

export function hasSavedGame(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SAVE_KEY) !== null;
}

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as GameState;
    // Backfill fields added after some saves were already written, so an
    // older save doesn't crash a newer build of the engine.
    if (state.currentBackground === undefined) state.currentBackground = null;
    if (!state.toolProgress) state.toolProgress = {};
    if (!state.toolPlacements) state.toolPlacements = {};
    if (!state.toolSelections) state.toolSelections = {};
    return state;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSavedGame(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SAVE_KEY);
}

export function newGameState(): GameState {
  return getDefaultGameState();
}

// ---------------------------------------------------------------------------
// Effects / flags — generic key-driven mutation, no story-specific hardcoding
// ---------------------------------------------------------------------------

/**
 * Applies a choice option's `effects` object additively.
 * Keys of the form `${characterId}Trust` are routed to
 * state.relationships[characterId]; every other key is routed to
 * state.projectMetrics[key] if that key exists there. Unknown keys are
 * logged and skipped rather than throwing, so new content data can add
 * metrics without an engine change.
 */
export function applyEffects(
  state: GameState,
  effects: Record<string, number> | undefined
): GameState {
  if (!effects || Object.keys(effects).length === 0) return state;
  const next: GameState = {
    ...state,
    projectMetrics: { ...state.projectMetrics },
    relationships: { ...state.relationships },
  };

  for (const [key, value] of Object.entries(effects)) {
    const trustMatch = key.match(/^(.+)Trust$/);
    const characterId = trustMatch?.[1];
    if (characterId && characterId in next.relationships) {
      next.relationships[characterId] += value;
      continue;
    }
    if (key in next.projectMetrics) {
      next.projectMetrics[key] += value;
      continue;
    }
    console.warn(`[nova-engine] applyEffects: unrecognised effect key "${key}"`);
  }

  return next;
}

/** Merges a choice option's `flags` object into state.flags. */
export function applyFlags(state: GameState, flags: Flags | undefined): GameState {
  if (!flags || Object.keys(flags).length === 0) return state;
  return { ...state, flags: { ...state.flags, ...flags } };
}

/** Applies a scene's own `flagsSet` array (flags that become true simply by
 * reaching/completing the scene, independent of any choice). */
export function applySceneFlagsSet(
  state: GameState,
  flagsSet: string[] | undefined
): GameState {
  if (!flagsSet || flagsSet.length === 0) return state;
  const nextFlags = { ...state.flags };
  for (const flag of flagsSet) {
    // Defensive: scenes.json can contain descriptive/conditional notes here
    // for later acts (e.g. "flag_x (conditional on y)") — only set clean
    // boolean flag names.
    if (/^[a-zA-Z0-9_]+$/.test(flag)) {
      nextFlags[flag] = true;
    }
  }
  return { ...state, flags: nextFlags };
}

// ---------------------------------------------------------------------------
// Dialogue line visibility
// ---------------------------------------------------------------------------

/**
 * Evaluates a single condition term against flags. Two negation
 * conventions show up in the content, both meaning "this flag is false or
 * absent" rather than a separately-stored flag:
 *  - infix "_not_" (e.g. "automation_not_marked_must", "camilleTrust_not_
 *    high") — derived by replacing the first "_not_" with "_" to get the
 *    positive flag's name.
 *  - prefix "not_" on a term inside an "_and_" compound (see
 *    isLineVisible) — e.g. "not_daniel_power_recognized".
 * Neither is ever a real stored flag; both are evaluated at render time.
 */
function evaluateConditionTerm(term: string, flags: Flags): boolean {
  if (term.startsWith("not_")) {
    return !flags[term.slice(4)];
  }
  const negationMarker = "_not_";
  const markerIndex = term.indexOf(negationMarker);
  if (markerIndex !== -1) {
    const positiveFlag =
      term.slice(0, markerIndex) + "_" + term.slice(markerIndex + negationMarker.length);
    return !flags[positiveFlag];
  }
  return Boolean(flags[term]);
}

/**
 * A dialogue line's `condition` can be a single flag/negation term, or a
 * compound of several joined with "_and_" (e.g. "daniel_power_recognized_
 * and_camille_power_recognized", "not_daniel_power_recognized_and_camille_
 * power_recognized") — every term must hold for the line to show. This
 * lets content author N-way mutually-exclusive variants (covering every
 * combination of a small set of flags) without the engine needing to know
 * anything about which flags or how many.
 */
export function isLineVisible(condition: string | undefined, flags: Flags): boolean {
  if (!condition) return true;
  return condition.split("_and_").every((term) => evaluateConditionTerm(term, flags));
}

// ---------------------------------------------------------------------------
// Tool marker detection — derives where a tool sits in a scene's dialogue
// ---------------------------------------------------------------------------

/**
 * Content convention (consistent across every tool scene in the data,
 * built or not yet built): a scene with a toolId marks exactly where the
 * tool belongs with a bracketed narrator line, e.g. "[Player builds the
 * SWOT.]", "[Player tags PESTLE factors...]", "[Player builds the
 * stakeholder power/interest grid.]". Detecting this line lets the engine
 * split a scene's single dialogue block into pre-tool/post-tool halves
 * automatically, instead of requiring content to also maintain a separate
 * postToolDialogueId field in scenes.json — which is easy to lose (or
 * simply never populate) on a content re-export, whereas the marker line
 * is already part of the canonical script itself.
 */
export function isToolMarkerLine(line: DialogueLine): boolean {
  return line.speaker === "narrator" && /^\[Player\b/.test(line.text.trim());
}

/**
 * Splits an already-visibility-filtered line list around its tool marker
 * line (dropped from both halves — it's a structural cue, never actually
 * displayed). If no marker is found, everything is "pre-tool" and the
 * tool is treated as an interstitial at the very end of dialogue, same as
 * a scene with no dialogue at all before its tool.
 */
export function splitAroundToolMarker(lines: DialogueLine[]): {
  preLines: DialogueLine[];
  postLines: DialogueLine[];
} {
  const markerIndex = lines.findIndex(isToolMarkerLine);
  if (markerIndex === -1) return { preLines: lines, postLines: [] };
  return {
    preLines: lines.slice(0, markerIndex),
    postLines: lines.slice(markerIndex + 1),
  };
}

// ---------------------------------------------------------------------------
// Portrait resolution
// ---------------------------------------------------------------------------

const KNOWN_REAL_ASSETS = new Set([
  "marcus_neutral.jpg",
  "marcus_displeased.jpg",
  "marcus_pleased.jpg",
  "camille.jpg",
  "priya.jpg",
  "vaughn.jpg",
]);

export interface ResolvedPortrait {
  src: string | null;
  emotionUsed: string;
  character: Character;
}

/**
 * Picks the portrait image for a speaking character.
 *
 * Rule: use the dialogue line's explicit `emotion` tag if the character has
 * that portrait defined. If the line is emotionally neutral (no emotion, or
 * "neutral") and the player's relationship score with that character has
 * crossed WARM_RELATIONSHIP_THRESHOLD, upgrade to the "warm" portrait when
 * one exists — a generic, data-driven way for goodwill to visibly show on
 * screen without hardcoding any particular scene's mood.
 */
export function resolvePortrait(
  characterId: string,
  emotion: string | null,
  relationshipScore: number | undefined
): ResolvedPortrait | null {
  const character = getCharacter(characterId);
  if (!character || !character.portraits) return null;
  const portraits = character.portraits;

  let emotionUsed = emotion ?? "neutral";

  const isNeutralBeat = !emotion || emotion === "neutral";
  if (
    isNeutralBeat &&
    portraits.warm &&
    relationshipScore !== undefined &&
    relationshipScore >= WARM_RELATIONSHIP_THRESHOLD
  ) {
    emotionUsed = "warm";
  }

  const file =
    portraits[emotionUsed] ?? portraits["neutral"] ?? Object.values(portraits)[0];

  if (!file || !KNOWN_REAL_ASSETS.has(file)) {
    return { src: null, emotionUsed, character };
  }

  return { src: `/assets/characters/${file}`, emotionUsed, character };
}

/** Small, legible-on-dark palette for inline speaker-name coloring in the
 * transcript. Not tied to any specific character — see speakerColor. */
const SPEAKER_COLOR_PALETTE = [
  "#f0c98a", // amber
  "#7fb8e8", // sky
  "#a8d0a0", // sage
  "#e0a15a", // warm gold
  "#c9a8e0", // lavender
  "#e8a8b8", // dusty rose
];

/** Deterministic accent color per character id, so any speaker (including
 * ones added to future acts) gets a stable, distinct name color without
 * hardcoding a lookup table. */
export function speakerColor(characterId: string): string {
  let hash = 0;
  for (let i = 0; i < characterId.length; i++) {
    hash = (hash * 31 + characterId.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_COLOR_PALETTE[hash % SPEAKER_COLOR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Backgrounds — carried-forward backdrop, generic across every scene
// ---------------------------------------------------------------------------

/**
 * Folds a `baseline` background forward through `lines` up to (and
 * including) `uptoIndexInclusive`, applying each visible line's own
 * `background` field in order. Lines without the field, or hidden by a
 * failed condition, leave the running value untouched — this is how a
 * backdrop "carries forward" across lines and scene boundaries without
 * ever needing to be explicitly reset.
 *
 * Used two ways: pass the full dialogue array with uptoIndex = last index
 * to compute the backdrop in effect at the END of a scene (the baseline the
 * next scene inherits); pass it with uptoIndex = the currently displayed
 * line to compute what should be on screen right now.
 */
export function foldBackground(
  baseline: string | null,
  lines: DialogueLine[],
  flags: Flags,
  uptoIndexInclusive: number
): string | null {
  let background = baseline;
  for (let i = 0; i <= uptoIndexInclusive && i < lines.length; i++) {
    const line = lines[i];
    if (!isLineVisible(line.condition, flags)) continue;
    if (line.background) background = line.background;
  }
  return background;
}

/**
 * Real background files that actually exist on disk under
 * /public/assets/backgrounds, keyed by extension-agnostic stem. assets.json
 * (content) and the real files (art) have drifted on file extension more
 * than once — content says .png, disk has .jpg — so comparing by stem and
 * always serving the file that's ACTUALLY on disk avoids ever constructing
 * a broken <img> src, regardless of what extension the content export
 * claims. An unlisted stem falls back to a labeled placeholder rectangle,
 * same pattern as portraits' KNOWN_REAL_ASSETS.
 */
const REAL_BACKGROUND_FILES_BY_STEM: Record<string, string> = {
  bg_reception: "bg_reception.jpg",
  bg_marcus_office: "bg_marcus_office.jpg",
};

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

/** Derives an assets.json backgrounds key from a tool screen's
 * `backgroundAsset` filename hint, by convention "bg_<key>.<ext>" (e.g.
 * "bg_warehouse_week1.png" -> "warehouse_week1"). Best-effort: if the
 * filename doesn't start with "bg_", returns the stem as-is. */
export function deriveBackgroundKeyFromAssetFilename(filename: string): string {
  return stripExtension(filename).replace(/^bg_/, "");
}

export interface ResolvedBackground {
  src: string | null;
  key: string;
  file: string | null;
}

/** Resolves a background key to a real image src if one exists, else null
 * (caller renders a placeholder). */
export function resolveBackground(
  key: string | null,
  file: string | null
): ResolvedBackground | null {
  if (!key) return null;
  const realFile = file ? REAL_BACKGROUND_FILES_BY_STEM[stripExtension(file)] : undefined;
  if (realFile) {
    return { src: `/assets/backgrounds/${realFile}`, key, file };
  }
  return { src: null, key, file };
}

// ---------------------------------------------------------------------------
// Tool screen progress — generic "sort into buckets" persistence
// ---------------------------------------------------------------------------

/** True once the player has reached a tool screen's action phase (even
 * with zero cards placed yet). Used to skip replaying dialogue on resume. */
export function hasReachedToolScreen(
  state: GameState,
  toolId: string | null | undefined
): boolean {
  if (!toolId) return false;
  return state.toolProgress[toolId] !== undefined;
}

/** Marks a tool screen as reached (dialogue finished, action phase shown)
 * without placing any cards yet. Idempotent. */
export function markToolScreenReached(state: GameState, toolId: string): GameState {
  if (state.toolProgress[toolId] !== undefined) return state;
  return { ...state, toolProgress: { ...state.toolProgress, [toolId]: [] } };
}

/** Records a correctly-placed card. Idempotent for a card already placed. */
export function placeToolCard(state: GameState, toolId: string, cardId: string): GameState {
  const existing = state.toolProgress[toolId] ?? [];
  if (existing.includes(cardId)) return state;
  return {
    ...state,
    toolProgress: { ...state.toolProgress, [toolId]: [...existing, cardId] },
  };
}

export function isToolComplete(
  state: GameState,
  toolId: string,
  totalCards: number
): boolean {
  return (state.toolProgress[toolId]?.length ?? 0) >= totalCards;
}

// ---------------------------------------------------------------------------
// Priority-assignment tool progress — generic "assign every card to a
// bucket at a real cost" persistence (e.g. MoSCoW). Every bucket is valid;
// nothing here is specific to Must/Should/Could/Won't or to budget.
// ---------------------------------------------------------------------------

/** Re-checks a priority tool's overcommitRule (if it has one) against the
 * current bucket distribution and sets/clears its reactionFlag to match —
 * live off the FINAL distribution, not sticky from the first time the
 * threshold was crossed, so moving cards back out of the bucket un-fires
 * it again before the player finishes. */
function applyOvercommitRule(
  state: GameState,
  toolScreen: ToolScreenBlock,
  placements: Record<string, string>
): GameState {
  const rule = toolScreen.overcommitRule;
  if (!rule) return state;
  const count = Object.values(placements).filter((bucket) => bucket === rule.bucket).length;
  const shouldBeSet = count >= rule.minCount;
  if (Boolean(state.flags[rule.reactionFlag]) === shouldBeSet) return state;
  return { ...state, flags: { ...state.flags, [rule.reactionFlag]: shouldBeSet } };
}

/**
 * Places (or re-places) a card into a bucket for a priority_assignment
 * tool. Unlike placeToolCard, every bucket is a valid destination — there
 * is no wrong-bucket rejection. Refunds the card's cost in its previous
 * bucket (if any) before charging its cost in the new one, so re-placing
 * a card doesn't stack both costs. Applies the new bucket's flagsByBucket
 * (positive flags only), then re-evaluates the tool's overcommitRule
 * against the resulting distribution.
 */
export function placePriorityCard(
  state: GameState,
  toolScreen: ToolScreenBlock,
  cardId: string,
  bucket: string
): GameState {
  const card = (toolScreen.cards ?? []).find((c) => c.id === cardId);
  if (!card) return state;

  const toolId = toolScreen.toolId;
  const currentPlacements = state.toolPlacements[toolId] ?? {};
  const previousBucket = currentPlacements[cardId];
  if (previousBucket === bucket) return state;

  // costByBucket is optional — a tool like the stakeholder power/interest
  // grid has no cost at all (every quadrant is free), same shape as
  // MoSCoW's cards otherwise.
  const budgetKey = toolScreen.budgetVariable ?? "budgetRemaining";
  let budget = state.projectMetrics[budgetKey] ?? 0;
  if (card.costByBucket) {
    if (previousBucket) budget += card.costByBucket[previousBucket] ?? 0;
    budget -= card.costByBucket[bucket] ?? 0;
  }

  const nextFlags = { ...state.flags };
  const flagsForBucket = card.flagsByBucket?.[bucket];
  if (flagsForBucket) {
    for (const [key, value] of Object.entries(flagsForBucket)) {
      if (value) nextFlags[key] = true; // only positive flags are ever set
    }
  }

  const nextPlacements = { ...currentPlacements, [cardId]: bucket };

  let next: GameState = {
    ...state,
    projectMetrics: { ...state.projectMetrics, [budgetKey]: budget },
    flags: nextFlags,
    toolPlacements: { ...state.toolPlacements, [toolId]: nextPlacements },
  };

  next = applyOvercommitRule(next, toolScreen, nextPlacements);
  return next;
}

export function isPriorityToolComplete(
  state: GameState,
  toolId: string,
  totalCards: number
): boolean {
  return Object.keys(state.toolPlacements[toolId] ?? {}).length >= totalCards;
}

// ---------------------------------------------------------------------------
// Risk investigation — "pick maxQuestions of the bank's questions" progress.
// Deliberately stateless beyond the flags themselves: whether a question
// has been asked is just whether its flagOnAsk is true, so there's nothing
// extra to persist or backfill on older saves.
// ---------------------------------------------------------------------------

/** How many of a risk investigation bank's questions have been asked so
 * far, derived purely from which flagOnAsk flags are currently true. */
export function countAskedQuestions(bank: RiskInvestigationBank, flags: Flags): number {
  return bank.questions.filter((q) => Boolean(flags[q.flagOnAsk])).length;
}

/** True once the player has asked as many questions as the bank allows
 * (or more, defensively, though the UI never lets that happen). */
export function isRiskInvestigationComplete(bank: RiskInvestigationBank, flags: Flags): boolean {
  return countAskedQuestions(bank, flags) >= bank.maxQuestions;
}

// ---------------------------------------------------------------------------
// Template substitution — {token} placeholders in dialogue text, filled in
// from live game state at render time (e.g. "Week {currentWeek}." or
// EV-R1's "{chosenSupplier}"). Generic string-replace, no engine knowledge
// of what any particular token means — callers build the values map.
// ---------------------------------------------------------------------------

export function substituteTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
}

// ---------------------------------------------------------------------------
// cost_review_with_descope (CBS) — auto-summed cost review; cut exactly one
// task if the total exceeds descopeThreshold. The cut choice lives in
// toolProgress[toolId] as a single-entry array (reuses the same "list of
// resolved ids" shape as sort_into_buckets, just capped at one), so
// changing your mind before continuing swaps the entry rather than
// stacking cuts. Only ONE descoped_<taskId> flag is ever true at a time —
// switching the pick clears the old one, since this is a live in-progress
// decision, not a past narrative choice.
// ---------------------------------------------------------------------------

/** The currently-chosen task to cut, if any. */
export function getDescopedTaskId(state: GameState, toolId: string): string | undefined {
  return state.toolProgress[toolId]?.[0];
}

/** Sum of every task's cost except the (optionally) cut one. */
export function computeCbsTotal(toolScreen: ToolScreenBlock, cutTaskId: string | undefined): number {
  const costs = toolScreen.costsByTask ?? {};
  return Object.entries(costs).reduce(
    (sum, [taskId, cost]) => (taskId === cutTaskId ? sum : sum + cost),
    0
  );
}

export function isCbsComplete(state: GameState, toolScreen: ToolScreenBlock): boolean {
  const cutTaskId = getDescopedTaskId(state, toolScreen.toolId);
  const threshold = toolScreen.descopeThreshold ?? Infinity;
  return computeCbsTotal(toolScreen, cutTaskId) <= threshold;
}

/** Cuts a task (or changes an earlier cut to a different task). Clears any
 * previously-set descoped_<taskId> flag for a task that's no longer the
 * pick, and sets the new one — see module note above. */
export function descopeTask(
  state: GameState,
  toolScreen: ToolScreenBlock,
  taskId: string
): GameState {
  const toolId = toolScreen.toolId;
  const previous = getDescopedTaskId(state, toolId);
  if (previous === taskId) return state;

  const nextFlags = { ...state.flags };
  if (previous) delete nextFlags[`descoped_${previous}`];
  nextFlags[`descoped_${taskId}`] = true;

  return {
    ...state,
    flags: nextFlags,
    toolProgress: { ...state.toolProgress, [toolId]: [taskId] },
  };
}

// ---------------------------------------------------------------------------
// pick_n_of_m_swipeable (Team Selection) — browse via swipe (no state
// change), toggle hire/un-hire independently, capped at maxHires. Selection
// lives in toolSelections (a live toggle set, unlike toolProgress's
// append-only history) because un-hiring must be able to fully reverse a
// candidate's effects/flags, not just leave them accumulated.
// ---------------------------------------------------------------------------

/**
 * Toggles a candidate's hired state. Hiring applies budgetEffect/
 * otherEffects and sets flagOnHire true; un-hiring reverses both. A no-op
 * if trying to hire past maxHires (the UI already greys the button out,
 * this is just the defensive backstop).
 */
export function toggleHire(
  state: GameState,
  toolScreen: ToolScreenBlock,
  candidateId: string
): GameState {
  const candidate = (toolScreen.candidates ?? []).find((c) => c.id === candidateId);
  if (!candidate) return state;

  const toolId = toolScreen.toolId;
  const currentlyHired = state.toolSelections[toolId] ?? [];
  const isHired = currentlyHired.includes(candidateId);
  const maxHires = toolScreen.maxHires ?? Infinity;

  if (!isHired && currentlyHired.length >= maxHires) return state;

  const sign = isHired ? -1 : 1;
  const effects: Record<string, number> = { ...(candidate.otherEffects ?? {}) };
  if (candidate.budgetEffect) effects.budgetRemaining = candidate.budgetEffect;
  const signedEffects = Object.fromEntries(
    Object.entries(effects).map(([key, value]) => [key, value * sign])
  );

  let next = applyEffects(state, signedEffects);
  if (candidate.flagOnHire) {
    next = {
      ...next,
      flags: { ...next.flags, [candidate.flagOnHire]: !isHired },
    };
  }

  const nextSelection = isHired
    ? currentlyHired.filter((id) => id !== candidateId)
    : [...currentlyHired, candidateId];

  return {
    ...next,
    toolSelections: { ...next.toolSelections, [toolId]: nextSelection },
  };
}

export function isHiringComplete(state: GameState, toolId: string, maxHires: number): boolean {
  return (state.toolSelections[toolId]?.length ?? 0) === maxHires;
}

// ---------------------------------------------------------------------------
// gantt_placement (Milestone Timeline) — place fixed-duration bars on a
// week axis, subject to hard dependency rules written as prose in the
// data ("X cannot start before [BOTH] Y [and Z] end[s]"). Placements reuse
// toolPlacements' existing milestoneId -> string shape (the week number
// stringified) rather than inventing a new GameState field.
// ---------------------------------------------------------------------------

/** Parses a dependencyRules[].rule prose string into a structured
 * milestoneId + prerequisite id list. Generic pattern match, not tied to
 * any specific milestone name — new rules of the same shape need no
 * engine change. Returns null if the sentence doesn't match the
 * convention (defensive; such a rule is simply not enforced). */
function parseDependencyRule(
  rule: string
): { milestoneId: string; prerequisiteIds: string[] } | null {
  const match = rule.match(/^(\S+)\s+cannot start before\s+(?:BOTH\s+)?(.+?)\s+ends?$/i);
  if (!match) return null;
  return {
    milestoneId: match[1],
    prerequisiteIds: match[2].split(/\s+and\s+/i).map((s) => s.trim()),
  };
}

/** Checks a proposed milestone placement against every dependencyRule that
 * applies to it. Returns an error message if it violates one ("Error:
 * Dependency", matching the data's own wrongPlacementBehavior note), or
 * null if the placement is valid. Doesn't mutate state — the caller only
 * calls placeMilestone once this returns null, same bounce-back-without-
 * penalty pattern as every other tool's wrong placement. */
export function validateMilestonePlacement(
  toolScreen: ToolScreenBlock,
  placements: Record<string, string>,
  milestoneId: string,
  startWeek: number
): string | null {
  for (const { rule } of toolScreen.dependencyRules ?? []) {
    const parsed = parseDependencyRule(rule);
    if (!parsed || parsed.milestoneId !== milestoneId) continue;
    for (const prerequisiteId of parsed.prerequisiteIds) {
      const prerequisiteStart = placements[prerequisiteId];
      if (prerequisiteStart === undefined) return "Error: Dependency";
      const prerequisite = toolScreen.milestones?.find((m) => m.id === prerequisiteId);
      const prerequisiteEnd = Number(prerequisiteStart) + (prerequisite?.durationWeeks ?? 0);
      if (startWeek < prerequisiteEnd) return "Error: Dependency";
    }
  }
  return null;
}

/** Places (or re-places) a milestone's starting week. Assumes the caller
 * already validated via validateMilestonePlacement. */
export function placeMilestone(
  state: GameState,
  toolScreen: ToolScreenBlock,
  milestoneId: string,
  startWeek: number
): GameState {
  const toolId = toolScreen.toolId;
  const nextPlacements = {
    ...(state.toolPlacements[toolId] ?? {}),
    [milestoneId]: String(startWeek),
  };
  return { ...state, toolPlacements: { ...state.toolPlacements, [toolId]: nextPlacements } };
}

/**
 * Computes the critical path — the chain of milestones with zero slack
 * that actually determines the project's finish date — from the player's
 * real placements, not the dependency graph's shape alone. Fully generic:
 * built from parseDependencyRule's structured output plus each
 * milestone's placed end time (start + durationWeeks); no milestone id is
 * ever hardcoded, so it stays correct no matter how the player arranged
 * the timeline (e.g. it correctly swaps to a different prerequisite if
 * the player placed it to finish later than its sibling).
 *
 * Algorithm: find whichever milestone finishes last overall (the true
 * project end); walk backward through its prerequisites, at each step
 * following whichever prerequisite finishes latest (the one actually
 * gating the next milestone's start), until a milestone with no
 * prerequisites is reached. Milestones off this backward walk — including
 * ones with no dependency edges at all — have slack and aren't returned.
 *
 * Returned in end-to-start order (the final milestone first). Returns []
 * if any milestone isn't placed yet — callers should gate on
 * isPriorityToolComplete first.
 */
export function computeCriticalPath(
  toolScreen: ToolScreenBlock,
  placements: Record<string, string>
): string[] {
  const milestones = toolScreen.milestones ?? [];
  if (milestones.length === 0) return [];

  const endTime = (id: string): number | null => {
    const milestone = milestones.find((m) => m.id === id);
    const start = placements[id];
    if (!milestone || start === undefined) return null;
    return Number(start) + milestone.durationWeeks;
  };

  if (milestones.some((m) => endTime(m.id) === null)) return [];

  const prerequisitesOf = new Map<string, string[]>();
  for (const { rule } of toolScreen.dependencyRules ?? []) {
    const parsed = parseDependencyRule(rule);
    if (parsed) prerequisitesOf.set(parsed.milestoneId, parsed.prerequisiteIds);
  }

  let current = milestones[0].id;
  let latestEnd = endTime(current) ?? -Infinity;
  for (const m of milestones) {
    const end = endTime(m.id) ?? -Infinity;
    if (end > latestEnd) {
      latestEnd = end;
      current = m.id;
    }
  }

  const path: string[] = [];
  let cursor: string | undefined = current;
  while (cursor) {
    path.push(cursor);
    const prerequisites = prerequisitesOf.get(cursor) ?? [];
    if (prerequisites.length === 0) break;
    let next: string | undefined;
    let nextEnd = -Infinity;
    for (const prerequisiteId of prerequisites) {
      const end = endTime(prerequisiteId) ?? -Infinity;
      if (end > nextEnd) {
        nextEnd = end;
        next = prerequisiteId;
      }
    }
    cursor = next;
  }
  return path;
}

/** True if the player's guessed set of milestone ids exactly matches the
 * computed critical path (order-independent — the player taps bars in
 * whatever order, only the final set matters). */
export function isCriticalPathGuessCorrect(guessedIds: string[], criticalPath: string[]): boolean {
  if (guessedIds.length !== criticalPath.length) return false;
  const guessedSet = new Set(guessedIds);
  return criticalPath.every((id) => guessedSet.has(id));
}

/**
 * Toggles a milestone in/out of the player's live critical-path guess.
 * Lives in toolSelections (the same live, reversible toggle-set shape as
 * Team Selection's hire toggle) rather than toolProgress, since changing
 * your mind mid-guess should fully remove a milestone, not just leave it
 * accumulated in a history.
 */
export function toggleCriticalPathGuess(
  state: GameState,
  toolScreen: ToolScreenBlock,
  milestoneId: string
): GameState {
  const toolId = toolScreen.toolId;
  const current = state.toolSelections[toolId] ?? [];
  const next = current.includes(milestoneId)
    ? current.filter((id) => id !== milestoneId)
    : [...current, milestoneId];
  return { ...state, toolSelections: { ...state.toolSelections, [toolId]: next } };
}

// ---------------------------------------------------------------------------
// HUD — Deployment Countdown. Purely a display-derivation layer over
// existing projectMetrics/toolPlacements; introduces no new stored
// variables of its own (per design: weeksRemaining is derived, never
// persisted).
// ---------------------------------------------------------------------------

/** weeksRemaining = round(scheduleHealth / 100 * 24). Not clamped — a bad
 * scheduleHealth can push this negative or past 24; the HUD displays
 * whatever comes out, it never gates progression. */
export function computeWeeksRemaining(scheduleHealth: number): number {
  return Math.round((scheduleHealth / 100) * 24);
}

export type MetricBand = "green" | "yellow" | "red";

/** Generic threshold banding for a 0-100-ish score, reused across every
 * HUD metric (Budget/Schedule/Risk/Quality/Benefits). `higherIsBetter`
 * flips which end reads as red — e.g. scheduleHealth: higher is better,
 * riskExposure: lower is better — so the same two thresholds work for
 * both without the caller pre-inverting anything. */
export function metricBand(
  value: number,
  higherIsBetter: boolean,
  greenAt = 60,
  redBelow = 30
): MetricBand {
  const score = higherIsBetter ? value : 100 - value;
  if (score >= greenAt) return "green";
  if (score < redBelow) return "red";
  return "yellow";
}

/**
 * "Current Objective" — whichever Gantt milestone(s) the current week
 * falls inside. If more than one bar covers the week (Utilities/Training
 * can overlap others), joins all of their names. If the week falls in a
 * gap covered by no bar, shows the nearest upcoming milestone instead. If
 * every milestone's window has already passed, says so.
 */
export function computeCurrentObjective(
  toolScreen: ToolScreenBlock | null,
  placements: Record<string, string>,
  currentWeek: number
): string {
  const milestones = toolScreen?.milestones ?? [];
  const placed = milestones
    .map((m) => {
      const start = placements[m.id];
      return start === undefined ? null : { ...m, start: Number(start) };
    })
    .filter((m): m is (typeof milestones)[number] & { start: number } => m !== null);

  const active = placed.filter((m) => currentWeek >= m.start && currentWeek < m.start + m.durationWeeks);
  if (active.length > 0) return active.map((m) => m.text).join(", ");

  const upcoming = placed
    .filter((m) => m.start > currentWeek)
    .sort((a, b) => a.start - b.start);
  if (upcoming.length > 0) return `Next: ${upcoming[0].text}`;

  return placed.length > 0 ? "Deployment complete" : "";
}

// ---------------------------------------------------------------------------
// proof_chain_builder (Benefits Register) — builds Measure/Evidence per
// benefit. Reuses placeToolCard/isToolComplete's existing "list of
// resolved ids" persistence with a composite id (benefitId:field), rather
// than inventing new state shape — Owner/When Measurable are dialogue-
// revealed, not player-built, so they need no persistence at all.
// ---------------------------------------------------------------------------

export function benefitFieldId(benefitId: string, field: string): string {
  return `${benefitId}:${field}`;
}
