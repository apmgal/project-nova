import scenesRaw from "@/data/scenes.json";
import dialogueRaw from "@/data/dialogue.json";
import choicesRaw from "@/data/choices.json";
import charactersRaw from "@/data/characters.json";
import gameStateRaw from "@/data/game_state.json";
import assetsRaw from "@/data/assets.json";
import toolScreensRaw from "@/data/tool_screens.json";
import riskInvestigationRaw from "@/data/risk_investigation.json";
import eventsRaw from "@/data/events.json";
import type {
  Scene,
  DialogueBlock,
  ChoiceBlock,
  Character,
  GameState,
  ToolScreenBlock,
  RiskInvestigationBank,
  EventEntry,
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
// #4 bridge, ACT4_SCENE01B), Change Control (ACT4_SCENE02), THE BIG
// CURVEBALL (ACT4_SCENE03, dialogue/choices content keyed as "BIG-01"), and
// four Event Library checkpoint waves (see EVENT_WAVE_MEMBERS/
// GAP_WAVE_SPECS/computeEventQueue in state.ts, and Scene.eventWaveId/
// getEvent below) interleaved with three real Monthly Status Report tool
// screens (ACT4_SCENE05/05B/05C, all the same StatusReportBuilder
// component) — ACT4_SCENE04 (MAIN_WAVE) before report #1, ACT4_SCENE05_MID
// (MID_WAVE_1) between reports #1/#2, ACT4_SCENE05B_MID (MID_WAVE_2, plus
// the EV-06 RAID follow-up) between reports #2/#3, and ACT4_SCENE06 as a
// pure post-report-#3 transition with no event wave of its own anymore —
// see the "Act 4 event redistribution" entry in DESIGN_NOTES.md for why.
// That's the whole of Act 4 as currently written — ACT4_SCENE06's own
// nextScenes points at ACT5_SCENE01, which isn't part of any BUILT_ACTS/
// OVERRIDES entry, so reaching it correctly shows end-of-built-content
// rather than a broken scene, exactly like every other staged
// boundary in this build.
// ---------------------------------------------------------------------------

const BUILT_ACTS = new Set(["Act 1", "Act 2", "Act 3"]);

const BUILT_SCENE_OVERRIDES = new Set([
  "ACT4_SCENE01",
  "ACT4_SCENE01B",
  "ACT4_SCENE02",
  "ACT4_SCENE03",
  "ACT4_SCENE04",
  "ACT4_SCENE05",
  "ACT4_SCENE05_MID",
  "ACT4_SCENE05B",
  "ACT4_SCENE05B_MID",
  "ACT4_SCENE05C",
  "ACT4_SCENE06",
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
const events = eventsRaw as unknown as Record<string, EventEntry>;

export function getEvent(eventId: string): EventEntry | null {
  return events[eventId] ?? null;
}

/** Suffix marking a synthesized "lead-in" scene id (e.g. "EV-06__frame")
 * for an event whose precedingDialogueId needs its own beat before the
 * event's real dialogueId/choicesId content — see
 * synthesizeEventFrameScene below and resolveEventQueueEntryScene in
 * state.ts, which is the only other place this suffix is ever produced or
 * consumed. Never appears in any authored data file. */
export const EVENT_FRAME_SUFFIX = "__frame";

/** Builds a full Scene-shaped object on the fly from an events.json entry,
 * so the Event Library's queued events can flow through GameRoot's
 * existing dialogue/choice/goToScene machinery completely unchanged —
 * exactly like every authored scene, just assembled from events.json
 * instead of scenes.json. nextScenes is deliberately left empty: routing
 * for a queued event is decided entirely by GameRoot's queue-advance logic
 * (see isActiveQueuedEventScene/advanceEventQueue), which never actually
 * reads it. */
function synthesizeEventScene(eventId: string): Scene | null {
  const event = getEvent(eventId);
  if (!event) return null;
  return {
    sceneId: eventId,
    title: event.teaserTitle ?? event.title,
    act: event.act === "Act 3→4" ? "Act 4" : event.act,
    location: null,
    charactersInvolved: event.participants ?? [],
    dialogueId: event.dialogueId ?? null,
    choicesId: event.choicesId ?? null,
    // See EventEntry.toolId — lets a queued event carry a real tool screen
    // (currently just "EV-06-RAID", the RAID mini-artefact follow-up)
    // instead of only ever dialogue/choices.
    toolId: event.toolId ?? null,
    nextScenes: [],
  };
}

/** The synthesized lead-in beat for an event with EITHER a
 * precedingDialogueId OR a leadInPanelId — see EVENT_FRAME_SUFFIX. Its
 * nextScenes can be a plain static pointer (unlike the real event scene's)
 * since "after the lead-in comes the event itself" is always true, never
 * queue-dependent. The two lead-in kinds are mutually exclusive
 * (precedingDialogueId takes priority if an event somehow has both, which
 * no authored event currently does — see EventEntry.leadInPanelId). */
function synthesizeEventFrameScene(eventId: string): Scene | null {
  const event = getEvent(eventId);
  if (!event || (!event.precedingDialogueId && !event.leadInPanelId)) return null;
  // No "— lead-in" suffix — that was internal/authoring language leaking
  // into the player-facing header. Same teaser-first title as the real
  // event scene (see synthesizeEventScene) since the whole point of a
  // lead-in is that the player doesn't know yet which real event is about
  // to unfold.
  const title = event.teaserTitle ?? event.title;
  const base = {
    sceneId: `${eventId}${EVENT_FRAME_SUFFIX}`,
    title,
    act: "Act 4",
    location: null,
    charactersInvolved: event.participants ?? [],
    choicesId: null,
    nextScenes: [eventId],
  };
  if (event.precedingDialogueId) {
    return { ...base, dialogueId: event.precedingDialogueId, leadInPanelId: null };
  }
  return { ...base, dialogueId: null, leadInPanelId: event.leadInPanelId };
}

function isEventSceneId(sceneId: string): boolean {
  if (sceneId.endsWith(EVENT_FRAME_SUFFIX)) {
    const baseId = sceneId.slice(0, -EVENT_FRAME_SUFFIX.length);
    return Boolean(events[baseId]?.precedingDialogueId) || Boolean(events[baseId]?.leadInPanelId);
  }
  return Boolean(events[sceneId]);
}

export function getScene(sceneId: string): Scene | null {
  const built = BUILT_SCENES[sceneId];
  if (built) return built;
  if (sceneId.endsWith(EVENT_FRAME_SUFFIX)) {
    return synthesizeEventFrameScene(sceneId.slice(0, -EVENT_FRAME_SUFFIX.length));
  }
  return synthesizeEventScene(sceneId);
}

/** True if a scene id is part of the content this build ships — every
 * BUILT_ACTS/BUILT_SCENE_OVERRIDES scene (see above), plus every Event
 * Library event scene (and its synthesized lead-in, if it has one) —
 * those aren't gated by BUILT_ACTS/OVERRIDES at all, since which of them
 * actually gets reached is already fully gated by isEventEligible/
 * computeEventQueue only ever routing to eligible ones. */
export function isSceneAvailable(sceneId: string): boolean {
  return BUILT_SCENE_IDS.has(sceneId) || isEventSceneId(sceneId);
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
  if (state.eventQueue === undefined) state.eventQueue = null;
  if (state.eventQueueIndex === undefined) state.eventQueueIndex = 0;
  if (state.eventQueueExitScene === undefined) state.eventQueueExitScene = null;
  if (!state.decisions) state.decisions = {};
  if (!state.statusReports) state.statusReports = [];
  if (!state.eventsResolved) state.eventsResolved = [];
  return state;
}
