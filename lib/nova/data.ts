import scenesRaw from "@/data/scenes.json";
import dialogueRaw from "@/data/dialogue.json";
import choicesRaw from "@/data/choices.json";
import charactersRaw from "@/data/characters.json";
import gameStateRaw from "@/data/game_state.json";
import assetsRaw from "@/data/assets.json";
import toolScreensRaw from "@/data/tool_screens.json";
import riskInvestigationRaw from "@/data/risk_investigation.json";
import type {
  Scene,
  DialogueBlock,
  ChoiceBlock,
  Character,
  GameState,
  ToolScreenBlock,
  RiskInvestigationBank,
} from "./types";

// ---------------------------------------------------------------------------
// Scope: this build loads Act 1 + Act 2 + Act 3 content, plus a staged
// opening slice of Act 4. Per project instructions we filter scenes.json
// down to act === one of BUILT_ACTS — currently Act 1's six canonical beats
// (ACT1_SCENE01-06) plus bridge scenes (e.g. ACT1_SCENE02R, ACT1_SCENE02B,
// ACT1_SCENE03B, ACT1_SCENE06B), Act 2's six canonical beats
// (ACT2_SCENE01-06), and Act 3's seven beats (ACT3_SCENE01-07) plus its
// ACT3_SCENE06B bridge scene. This filter is dynamic, so any scene added to
// the data with a matching act is picked up automatically without an engine
// change.
//
// Act 4 itself is opened one wave at a time rather than all at once (the
// same staged approach Act 3 was built with, tracked as "Stage A/B/C..." at
// the time) — BUILT_SCENE_OVERRIDES below names the individual Act 4 scene
// ids that are live even though "Act 4" as a whole isn't yet in BUILT_ACTS.
// Currently: the Opening Curveball Wave (ACT4_SCENE01 + its Ellis Fragment
// #4 bridge, ACT4_SCENE01B), Change Control (ACT4_SCENE02), and THE BIG
// CURVEBALL (ACT4_SCENE03, dialogue/choices content keyed as "BIG-01"). All
// four are plain dialogue+choice scenes needing no new engine mechanic —
// same shape as everything else this build already runs. What's still not
// added: the Main Wave (ACT4_SCENE04) and Late Wave (ACT4_SCENE06), each of
// which hands off to a pool of conditionally-triggered events (events.json)
// that needs a new "checkpoint" mechanic to evaluate and sequence, and the
// Monthly Status Reports (ACT4_SCENE05/05B/05C), which need a new
// honesty-vs-actual-state delayed-consequence mechanic. All of that content
// is itself already written (needsWriting: false throughout) — only the
// engine support for those three pieces is still missing.
// ---------------------------------------------------------------------------

const BUILT_ACTS = new Set(["Act 1", "Act 2", "Act 3"]);

const BUILT_SCENE_OVERRIDES = new Set([
  "ACT4_SCENE01",
  "ACT4_SCENE01B",
  "ACT4_SCENE02",
  "ACT4_SCENE03",
]);

const allScenes = scenesRaw as unknown as Record<string, Scene>;

export const BUILT_SCENES: Record<string, Scene> = Object.fromEntries(
  Object.entries(allScenes).filter(
    ([id, scene]) => BUILT_ACTS.has(scene.act) || BUILT_SCENE_OVERRIDES.has(id)
  )
);

export const BUILT_SCENE_IDS = new Set(Object.keys(BUILT_SCENES));

const dialogueBlocks = dialogueRaw as unknown as Record<string, DialogueBlock>;
const choiceBlocks = choicesRaw as unknown as Record<string, ChoiceBlock>;

/** Index of every choice block by its sourceScene, built once at module
 * load. A scene with a single trailing choicesId (almost every scene)
 * gets a one-entry array here; a scene with sequential choices (an
 * insertAfterLine-anchored one plus the scene's own choicesId) gets
 * several — see GameRoot's choice-sequence logic for how those combine. */
const CHOICES_BY_SOURCE_SCENE: Record<string, ChoiceBlock[]> = {};
for (const block of Object.values(choiceBlocks)) {
  (CHOICES_BY_SOURCE_SCENE[block.sourceScene] ??= []).push(block);
}

const characters = charactersRaw as unknown as Record<string, Character>;
const toolScreens = toolScreensRaw as unknown as Record<string, ToolScreenBlock>;
const riskInvestigations = riskInvestigationRaw as unknown as Record<string, RiskInvestigationBank>;
const backgroundAssets = (assetsRaw as { backgrounds?: Record<string, string> })
  .backgrounds ?? {};
const ambientSoundAssets = (assetsRaw as { ambientSounds?: Record<string, string> })
  .ambientSounds ?? {};

export function getScene(sceneId: string): Scene | null {
  return BUILT_SCENES[sceneId] ?? null;
}

/** True if a scene id is part of the content this build ships — see
 * BUILT_ACTS/BUILT_SCENE_OVERRIDES above for exactly what that covers. */
export function isSceneAvailable(sceneId: string): boolean {
  return BUILT_SCENE_IDS.has(sceneId);
}

export function getDialogue(dialogueId: string | null): DialogueBlock | null {
  if (!dialogueId) return null;
  return dialogueBlocks[dialogueId] ?? null;
}

export function getChoiceBlock(choiceId: string | null): ChoiceBlock | null {
  if (!choiceId) return null;
  return choiceBlocks[choiceId] ?? null;
}

/** Every choice block whose sourceScene matches sceneId — the scene's own
 * choicesId block plus any insertAfterLine-anchored siblings. */
export function getChoicesForScene(sceneId: string): ChoiceBlock[] {
  return CHOICES_BY_SOURCE_SCENE[sceneId] ?? [];
}

export function getCharacter(characterId: string): Character | null {
  return characters[characterId] ?? null;
}

export function getToolScreen(toolId: string | null | undefined): ToolScreenBlock | null {
  if (!toolId) return null;
  return toolScreens[toolId] ?? null;
}

/** First tool screen matching a given `type` (e.g. "gantt_placement") —
 * used where a consumer needs to reach a specific tool's data (like the
 * HUD reading the Milestone Gantt for its Current Objective line) without
 * hardcoding that tool's id. Returns null if no tool of that type exists
 * (or hasn't been built yet). */
export function getToolScreenByType(type: string): ToolScreenBlock | null {
  return Object.values(toolScreens).find((t) => t.type === type) ?? null;
}

export function getRiskInvestigation(
  riskInvestigationId: string | null | undefined
): RiskInvestigationBank | null {
  if (!riskInvestigationId) return null;
  return riskInvestigations[riskInvestigationId] ?? null;
}

/** Resolves a background key (e.g. "reception") to its placeholder asset
 * filename from assets.json. Returns null for an unknown/unset key. */
export function getBackgroundFile(key: string | null): string | null {
  if (!key) return null;
  return backgroundAssets[key] ?? null;
}

/** Resolves an ambient sound key (e.g. "reception") to its filename from
 * assets.json. Returns null for an unknown/unset key — including "none",
 * which has no entry by design (it means silence, not a missing asset). */
export function getAmbientSoundFile(key: string | null): string | null {
  if (!key) return null;
  return ambientSoundAssets[key] ?? null;
}

export function getDefaultGameState(): GameState {
  // Deep clone so callers can freely mutate their own copy.
  const state = JSON.parse(JSON.stringify(gameStateRaw)) as GameState;
  // game_state.json predates these fields — backfill defensively rather
  // than requiring the content team to edit the schema file by hand.
  if (state.currentBackground === undefined) state.currentBackground = null;
  if (state.currentAmbient === undefined) state.currentAmbient = null;
  if (!state.toolProgress) state.toolProgress = {};
  if (!state.toolPlacements) state.toolPlacements = {};
  if (!state.toolSelections) state.toolSelections = {};
  if (!state.toolSubmitted) state.toolSubmitted = {};
  if (!state.artefacts) state.artefacts = {};
  return state;
}
