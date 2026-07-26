import scenesRaw from "@/data/scenes.json";
import dialogueRaw from "@/data/dialogue.json";
import choicesRaw from "@/data/choices.json";
import charactersRaw from "@/data/characters.json";
import gameStateRaw from "@/data/game_state.json";
import assetsRaw from "@/data/assets.json";
import toolScreensRaw from "@/data/tool_screens.json";
import type {
  Scene,
  DialogueBlock,
  ChoiceBlock,
  Character,
  GameState,
  ToolScreenBlock,
} from "./types";

// ---------------------------------------------------------------------------
// Scope: this build only loads Act 1 + Act 2 content. Per project
// instructions we filter scenes.json down to act === "Act 1" or "Act 2" —
// currently Act 1's six canonical beats (ACT1_SCENE01-06) plus whatever
// bridge scenes the data defines (e.g. ACT1_SCENE02R, ACT1_SCENE02B,
// ACT1_SCENE03B, ACT1_SCENE06B), and Act 2's six canonical beats
// (ACT2_SCENE01-06). This filter is dynamic, so any scene added to the data
// with act: "Act 1" or "Act 2" is picked up automatically without an engine
// change. Acts 3-6 are present in the underlying JSON files but are never
// read past this filter.
// ---------------------------------------------------------------------------

const BUILT_ACTS = new Set(["Act 1", "Act 2"]);

const allScenes = scenesRaw as unknown as Record<string, Scene>;

export const BUILT_SCENES: Record<string, Scene> = Object.fromEntries(
  Object.entries(allScenes).filter(([, scene]) => BUILT_ACTS.has(scene.act))
);

export const BUILT_SCENE_IDS = new Set(Object.keys(BUILT_SCENES));

const dialogueBlocks = dialogueRaw as unknown as Record<string, DialogueBlock>;
const choiceBlocks = choicesRaw as unknown as Record<string, ChoiceBlock>;
const characters = charactersRaw as unknown as Record<string, Character>;
const toolScreens = toolScreensRaw as unknown as Record<string, ToolScreenBlock>;
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

export function getCharacter(characterId: string): Character | null {
  return characters[characterId] ?? null;
}

export function getToolScreen(toolId: string | null | undefined): ToolScreenBlock | null {
  if (!toolId) return null;
  return toolScreens[toolId] ?? null;
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
  return state;
}
