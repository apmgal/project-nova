import type { GameState, Flags, Character, DialogueLine } from "./types";
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

export function isLineVisible(condition: string | undefined, flags: Flags): boolean {
  if (!condition) return true;
  return Boolean(flags[condition]);
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

/** Background asset filenames (from assets.json) that are real art rather
 * than a placeholder name. Same pattern as portraits' KNOWN_REAL_ASSETS —
 * an unlisted filename falls back to a labeled placeholder rectangle. */
const KNOWN_REAL_BACKGROUND_ASSETS = new Set(["bg_reception.jpg", "bg_marcus_office.jpg"]);

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
  if (file && KNOWN_REAL_BACKGROUND_ASSETS.has(file)) {
    return { src: `/assets/backgrounds/${file}`, key, file };
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
