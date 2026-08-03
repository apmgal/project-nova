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
// Scope: this build loads Act 1 + Act 2 + Act 3 content. Per project
// instructions we filter scenes.json down to act === one of BUILT_ACTS —
// currently Act 1's six canonical beats (ACT1_SCENE01-06) plus bridge
// scenes (e.g. ACT1_SCENE02R, ACT1_SCENE02B, ACT1_SCENE03B, ACT1_SCENE06B),
// Act 2's six canonical beats (ACT2_SCENE01-06), and Act 3's seven beats
// (ACT3_SCENE01-07) plus its ACT3_SCENE06B bridge scene. This filter is
// dynamic, so any scene added to the data with a matching act is picked up
// automatically without an engine change. Acts 4-6 are present in the
// underlying JSON files but are never read past this filter — their
// content (patches to BIG-01/EV-07/EV-14/ACT6_SCENE03 etc.) is prepared in
// the data ahead of time but has no built scenes yet, same "flag exists,
// consequence designed later" pattern used for the Act 2 risk flags before
// Act 4 existed.
// ---------------------------------------------------------------------------

const BUILT_ACTS = new Set(["Act 1", "Act 2", "Act 3"]);

const allScenes = scenesRaw as unknown as Record<string, Scene>;

export const BUILT_SCENES: Record<string, Scene> = Object.fromEntries(
  Object.entries(allScenes).filter(([, scene]) => BUILT_ACTS.has(scene.act))
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

export function getScene(sceneId: string): Scene | null {
  return BUILT_SCENES[sceneId] ?? null;
}

/** True if a scene id is part of the Act 1/Act 2 content this build ships. */
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

export function getDefaultGameState(): GameState {
  // Deep clone so callers can freely mutate their own copy.
  const state = JSON.parse(JSON.stringify(gameStateRaw)) as GameState;
  // game_state.json predates these fields — backfill defensively rather
  // than requiring the content team to edit the schema file by hand.
  if (state.currentBackground === undefined) state.currentBackground = null;
  if (!state.toolProgress) state.toolProgress = {};
  if (!state.toolPlacements) state.toolPlacements = {};
  if (!state.toolSelections) state.toolSelections = {};
  if (!state.toolSubmitted) state.toolSubmitted = {};
  if (!state.artefacts) state.artefacts = {};
  return state;
}
