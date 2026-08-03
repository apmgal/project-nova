"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getScene,
  getDialogue,
  getChoicesForScene,
  getToolScreen,
  getToolScreenByType,
  getRiskInvestigation,
  isSceneAvailable,
} from "@/lib/nova/data";
import {
  hasSavedGame,
  loadGame,
  saveGame,
  clearSavedGame,
  newGameState,
  applyEffects,
  applyFlags,
  applySceneFlagsSet,
  isLineVisible,
  splitAroundToolMarker,
  isToolMarkerLine,
  hasReachedToolScreen,
  markToolScreenReached,
  placeToolCard,
  isToolComplete,
  placePriorityCard,
  isPriorityToolComplete,
  isCbsComplete,
  getDescopedTaskId,
  descopeTask,
  toggleHire,
  isHiringComplete,
  validateMilestonePlacement,
  placeMilestone,
  toggleCriticalPathGuess,
  benefitFieldId,
  substituteTemplate,
  computeWeeksRemaining,
  resetTool,
  submitTool,
  setArtefactStatus,
} from "@/lib/nova/state";
import type {
  ChoiceBlock,
  ChoiceOption,
  DialogueLine,
  GameState,
  RiskInvestigationQuestion,
  Scene,
  ToolScreenBlock,
} from "@/lib/nova/types";
import TitleScreen from "./TitleScreen";
import DialogueTranscript from "./DialogueTranscript";
import AnnouncementCard from "./AnnouncementCard";
import ChoiceButtons from "./ChoiceButtons";
import ToolScreen from "./ToolScreen";
import PriorityBoard from "./PriorityBoard";
import WBSBlueprint from "./WBSBlueprint";
import CBSReview from "./CBSReview";
import TeamSelector from "./TeamSelector";
import GanttBoard from "./GanttBoard";
import BenefitsBuilder from "./BenefitsBuilder";
import HUD from "./HUD";
import RiskInvestigationPanel from "./RiskInvestigationPanel";
import DebugDrawer from "./DebugDrawer";
import ArtefactsDrawer from "./ArtefactsDrawer";
import EndOfContent from "./EndOfContent";
import NarrativeScene from "./narrative/NarrativeScene";
import { RECEPTION_INTRO_SCENE } from "@/data/narrative/receptionIntro";

/**
 * HUD activation window: starts at ACT3_SCENE06B ("Baseline Approved",
 * the deployment countdown's explicit start point per design) and covers
 * every scene from there through the end of Act 4, retiring once Act 5
 * begins. Act 3's earlier planning scenes (before baseline approval) and
 * Act 5+ don't show it. The scene id is a genuine one-off narrative
 * anchor (the design names this exact bridge scene), not a stand-in for
 * broader content the engine should infer.
 */
const HUD_START_SCENE_ID = "ACT3_SCENE06B";
const HUD_ALWAYS_ON_ACTS = new Set(["Act 4"]);

/** Sentinel id pushed into toolProgress[toolId] once the player has
 * correctly identified the critical path AND explicitly continued past
 * the reveal — a gantt_placement tool isn't "complete" on guess
 * correctness alone (that's derived live from toolSelections and could
 * flip true mid-tap), it's complete once the player has actually seen
 * and confirmed the answer. Reuses toolProgress's existing "list of
 * resolved ids" shape rather than inventing new state. */
const CRITICAL_PATH_CONFIRMED_MARKER = "critical_path_confirmed";

function isHudActiveForScene(scene: Scene): boolean {
  if (HUD_ALWAYS_ON_ACTS.has(scene.act)) return true;
  return scene.act === "Act 3" && (scene.sceneId === HUD_START_SCENE_ID || scene.sceneId === "ACT3_SCENE07");
}

interface EndInfo {
  reason: "act2-complete" | "unbuilt-branch";
  targetScene: string;
}

/** True once hydrated on the client. localStorage (and thus save data) is
 * only ever readable there — useSyncExternalStore is the React-blessed way
 * to gate on that without setting state from inside an effect. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * Splits a scene's dialogue into pre-tool and post-tool halves. Every
 * tool scene's script marks exactly where the tool belongs with a
 * bracketed "[Player ...]" narrator line (e.g. "[Player builds the
 * SWOT.]") — the engine derives the split from that marker automatically
 * rather than requiring a separate postToolDialogueId field, which is
 * easy to lose on a content re-export (postToolDialogueId is still
 * honored as an explicit override if a scene sets it). Scenes whose tool
 * hasn't been built yet (no toolId) still get the marker line stripped
 * from what's displayed — combinedLines (preLines+postLines) is the same
 * flat stream either way, since only atToolBreak's own `scene.toolId`
 * check decides whether that boundary actually pauses for a tool screen.
 * Also surfaces the marker line's own text (if any) so a choice's
 * insertAfterLine can target the marker's position directly — the
 * position where a tool interstitial (or its investigation step) belongs
 * — for scenes whose tool hasn't been built yet, or whose "tool" is
 * really a choice sequence like ACT2_SCENE04's Risk Register.
 */
function computeSceneLines(
  scene: Scene,
  flags: GameState["flags"]
): { preLines: DialogueLine[]; postLines: DialogueLine[]; markerText: string | null } {
  const rawLines = (getDialogue(scene.dialogueId)?.lines ?? []).filter((line) =>
    isLineVisible(line.condition, flags)
  );

  if (scene.postToolDialogueId) {
    const postLines = (getDialogue(scene.postToolDialogueId)?.lines ?? []).filter((line) =>
      isLineVisible(line.condition, flags)
    );
    return { preLines: rawLines, postLines, markerText: null };
  }

  const markerLine = rawLines.find(isToolMarkerLine);
  const split = splitAroundToolMarker(rawLines);
  return { ...split, markerText: markerLine?.text ?? null };
}

/** Whether a tool screen's completion condition is met, branching on its
 * `type` — the one place the engine needs to know all 7 tool shapes exist,
 * everything else (rendering, placement handlers) branches independently.
 * A standalone function (not a closure inside the component) so
 * TypeScript's narrowing of its params works reliably. */
function computeToolComplete(state: GameState, toolScreen: ToolScreenBlock | null): boolean {
  if (!toolScreen) return true;
  const toolId = toolScreen.toolId;
  switch (toolScreen.type) {
    case "priority_assignment":
    case "power_interest_grid":
      return isPriorityToolComplete(state, toolId, toolScreen.cards?.length ?? 0);
    case "cost_review_with_descope":
      return isCbsComplete(state, toolScreen);
    case "pick_n_of_m_swipeable":
      return isHiringComplete(state, toolId, toolScreen.maxHires ?? toolScreen.candidates?.length ?? 0);
    case "gantt_placement": {
      // Placement uses the same "every key placed" shape as
      // priority_assignment. But that alone isn't "complete" here — the
      // scene's real payoff is the critical-path puzzle that follows, so
      // completion also requires the explicit post-reveal confirmation
      // marker (see CRITICAL_PATH_CONFIRMED_MARKER), not just a correct
      // live guess (which could momentarily be true mid-tap).
      const milestoneCount = toolScreen.milestones?.length ?? 0;
      if (!isPriorityToolComplete(state, toolId, milestoneCount)) return false;
      return (state.toolProgress[toolId] ?? []).includes(CRITICAL_PATH_CONFIRMED_MARKER);
    }
    case "proof_chain_builder":
      return isToolComplete(
        state,
        toolId,
        (toolScreen.benefits?.length ?? 0) * (toolScreen.fieldsPlayerBuilds?.length ?? 2)
      );
    case "sort_into_buckets":
    default:
      return isToolComplete(state, toolId, toolScreen.cards?.length ?? 0);
  }
}

/** On resume, a tool scene the player already reached (toolProgress has an
 * entry for it, even an empty one) should skip straight back to its action
 * phase instead of replaying dialogue from line one. An "announcement"
 * scene (see AnnouncementCard) always fast-forwards straight past every
 * line — its whole point is showing them all at once, with its action
 * available immediately, rather than being click-revealed. Also used by
 * goToScene for every fresh scene transition, not just resume, so the
 * fast-forward applies the instant the player arrives, not just on reload. */
function resolveInitialLineIndex(state: GameState, sceneId: string): number {
  const scene = getScene(sceneId);
  if (!scene) return 0;
  if (scene.displayStyle === "announcement") {
    const { preLines, postLines } = computeSceneLines(scene, state.flags);
    return preLines.length + postLines.length;
  }
  if (scene.toolId && hasReachedToolScreen(state, scene.toolId)) {
    const { preLines } = computeSceneLines(scene, state.flags);
    return preLines.length;
  }
  return 0;
}

export default function GameRoot() {
  const isClient = useIsClient();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [reactionText, setReactionText] = useState<string | null>(null);
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  // Choice blocks resolved so far *within the current scene* — lets a
  // scene with several sequential interstitial choices (e.g. a risk
  // workshop that raises three concerns in turn) know which ones have
  // already been answered and shouldn't block dialogue again. Reset
  // whenever the scene changes.
  const [resolvedChoiceIds, setResolvedChoiceIds] = useState<Set<string>>(new Set());
  // Which choices' risk-investigation interstitial (if they have one) the
  // player has already stepped through this scene — separate from
  // resolvedChoiceIds because the investigation and the choice itself are
  // two distinct steps in front of the same breakIndex. Reset alongside it.
  const [resolvedInvestigationIds, setResolvedInvestigationIds] = useState<Set<string>>(new Set());
  // Reception Intro Scene: a one-off cinematic prologue that plays before
  // the first real scene on every fresh "New Game" (never on Continue,
  // which always resumes wherever the player left off). Kept as its own
  // flag rather than folding it into gameState/currentScene, since it's
  // presentational scaffolding in front of the save-backed engine, not
  // part of it.
  const [showReceptionIntro, setShowReceptionIntro] = useState(false);

  function enterScene(state: GameState, sceneId: string): GameState {
    const scene = getScene(sceneId);
    let next: GameState = { ...state, currentScene: sceneId };
    next = applySceneFlagsSet(next, scene?.flagsSet);
    // The Missing Appendices scene is where the player first turns up the
    // (unfinished) PID — from here it's reachable any time from the
    // artefacts drawer, not just this scene.
    if (sceneId === "ACT1_SCENE05") {
      next = setArtefactStatus(next, "pid", "incomplete");
    }
    return next;
  }

  function handleNewGame() {
    setShowReceptionIntro(true);
  }

  function handleReceptionIntroComplete() {
    setShowReceptionIntro(false);
    let state = newGameState();
    state = enterScene(state, state.currentScene);
    saveGame(state);
    setGameState(state);
    setLineIndex(0);
    setReactionText(null);
    setEndInfo(null);
    setResolvedChoiceIds(new Set());
    setResolvedInvestigationIds(new Set());
  }

  function handleContinue() {
    const state = loadGame();
    if (!state) {
      handleNewGame();
      return;
    }
    setGameState(state);
    setLineIndex(resolveInitialLineIndex(state, state.currentScene));
    setReactionText(null);
    setEndInfo(null);
    setResolvedChoiceIds(new Set());
    setResolvedInvestigationIds(new Set());
  }

  function handleRestart() {
    clearSavedGame();
    setGameState(null);
    setEndInfo(null);
  }

  /** Transitions to nextSceneId — or shows the end-of-content screen if
   * that scene isn't part of this build. */
  function goToScene(baseState: GameState, nextSceneId: string | null) {
    if (!nextSceneId || !isSceneAvailable(nextSceneId)) {
      // Save progress at the last valid (built) scene before showing the
      // end-of-content screen, so a reload resumes here rather than at a
      // scene that doesn't exist in this build.
      saveGame(baseState);
      setGameState(baseState);
      setEndInfo({
        reason: nextSceneId?.startsWith("ACT3") ? "act2-complete" : "unbuilt-branch",
        targetScene: nextSceneId ?? "(none)",
      });
      return;
    }

    const next = enterScene(baseState, nextSceneId);
    saveGame(next);
    setGameState(next);
    setLineIndex(resolveInitialLineIndex(next, nextSceneId));
    setReactionText(null);
    setEndInfo(null);
    setResolvedChoiceIds(new Set());
    setResolvedInvestigationIds(new Set());
  }

  if (!isClient) {
    return <div className="flex flex-1 items-center justify-center bg-zinc-950" />;
  }

  if (!gameState) {
    if (showReceptionIntro) {
      return (
        <NarrativeScene script={RECEPTION_INTRO_SCENE} onComplete={handleReceptionIntroComplete} />
      );
    }
    return (
      <TitleScreen
        hasSave={hasSavedGame()}
        onNewGame={handleNewGame}
        onContinue={handleContinue}
      />
    );
  }

  if (endInfo) {
    return (
      <EndOfContent
        gameState={gameState}
        reason={endInfo.reason}
        targetScene={endInfo.targetScene}
        onRestart={handleRestart}
      />
    );
  }

  const scene = getScene(gameState.currentScene);
  if (!scene) {
    return (
      <EndOfContent
        gameState={gameState}
        reason="unbuilt-branch"
        targetScene={gameState.currentScene}
        onRestart={handleRestart}
      />
    );
  }

  // A scene with a toolId plays out in up to three phases: dialogueId's
  // lines, then the tool screen, then (if postToolDialogueId is set, or a
  // "[Player ...]" marker line is auto-detected) more dialogue, then the
  // final action. lineIndex is a single running index over the pre-tool +
  // post-tool lines combined; the tool screen is an interstitial that
  // blocks advancing past the boundary between them until it's complete.
  const { preLines, postLines, markerText } = computeSceneLines(scene, gameState.flags);
  const combinedLines = [...preLines, ...postLines];
  const toolBreakIndex = preLines.length;

  const toolScreen = scene.toolId ? getToolScreen(scene.toolId) : null;
  const toolType = toolScreen?.type;
  const toolIsPriority = toolType === "priority_assignment" || toolType === "power_interest_grid";
  // toolComplete: whether the activity's own requirements are met (every
  // card placed, hires locked in, etc.) — used only to enable the Submit
  // button. toolSubmitted: whether the player has actually tapped it.
  // These are deliberately different — completion alone used to
  // auto-advance the scene instantly; now the tool screen stays up (with
  // Submit visibly enabled) until the player chooses to move on.
  const toolComplete = computeToolComplete(gameState, toolScreen);
  const toolSubmitted = Boolean(toolScreen && gameState.toolSubmitted[toolScreen.toolId]);

  // Blocked at the tool interstitial: pre-tool dialogue is done, but the
  // player hasn't submitted the tool yet.
  const atToolBreak = Boolean(scene.toolId) && !toolSubmitted && lineIndex >= toolBreakIndex;

  // A scene can have more than one choice block: its own trailing
  // choicesId block, plus any insertAfterLine-anchored ones that fire
  // mid-dialogue (e.g. a risk workshop raising several concerns in
  // turn). Each is positioned at a breakIndex into combinedLines — the
  // line index at which dialogue pauses for it. A block only branches
  // scenes (goToScene) if nothing follows it in the sequence; otherwise
  // it's an interstitial that just applies effects/flags and lets
  // dialogue continue past it, exactly like a tool screen would.
  interface PositionedChoice {
    block: ChoiceBlock;
    breakIndex: number;
  }
  const sceneChoices = getChoicesForScene(scene.sceneId);
  const anchoredChoices: PositionedChoice[] = [];
  for (const block of sceneChoices) {
    if (!block.insertAfterLine) continue;
    if (markerText && block.insertAfterLine === markerText) {
      // Anchored to the scene's own tool-marker line rather than a
      // displayed line — the marker itself is never shown, so its
      // "position" is wherever the split landed (toolBreakIndex): fires
      // right where a tool interstitial (or, here, a risk investigation)
      // belongs, before any of the marker's own postLines reactions.
      anchoredChoices.push({ block, breakIndex: toolBreakIndex });
      continue;
    }
    const anchorIndex = combinedLines.findIndex((line) => line.text === block.insertAfterLine);
    if (anchorIndex === -1) continue;
    anchoredChoices.push({ block, breakIndex: anchorIndex + 1 });
  }
  const defaultChoiceBlock = scene.choicesId
    ? sceneChoices.find((block) => block.choiceId === scene.choicesId && !block.insertAfterLine)
    : undefined;
  const choiceSequence: PositionedChoice[] = [...anchoredChoices];
  if (defaultChoiceBlock) {
    // The scene's own choicesId block (no insertAfterLine) fires at its
    // natural dialogue-end position: right before whichever anchored
    // choice comes first if any exist (e.g. the contractor choice in a
    // risk workshop that precedes two later anchored concerns), or at
    // the very end of the scene's dialogue if it's the only choice.
    const breakIndex =
      anchoredChoices.length > 0
        ? Math.min(...anchoredChoices.map((c) => c.breakIndex)) - 1
        : combinedLines.length;
    choiceSequence.push({ block: defaultChoiceBlock, breakIndex });
  }
  choiceSequence.sort((a, b) => a.breakIndex - b.breakIndex);

  const pendingChoice = !atToolBreak
    ? choiceSequence.find(
        (choice) => !resolvedChoiceIds.has(choice.block.choiceId) && lineIndex >= choice.breakIndex
      )
    : undefined;
  const atChoiceBreak = Boolean(pendingChoice);
  // A choice is terminal — it branches scenes via option.nextScene, same
  // as every single-choice scene always has — only if it sits at the
  // very end of the scene's dialogue (nothing left to play after it).
  // Every ordinary single-choice scene's one choice always satisfies
  // this (its breakIndex defaults to combinedLines.length), so this is
  // 100% backward-compatible. A mid-dialogue anchored choice is instead
  // interstitial: applying an option marks it resolved and dialogue
  // keeps flowing toward whatever comes after — another choice, more
  // lines, or eventually the scene's plain Continue action.
  const isPendingChoiceTerminal =
    Boolean(pendingChoice) && pendingChoice?.breakIndex === combinedLines.length;

  // A pending choice can carry a riskInvestigationId — an extra step in
  // front of its own options where the player picks maxQuestions of a
  // question bank, sees each answer, then continues into the choice
  // itself. Skipped for choices without one (investigationBank is null),
  // exactly like before this mechanic existed.
  const investigationBank = pendingChoice
    ? getRiskInvestigation(pendingChoice.block.riskInvestigationId)
    : null;
  const atInvestigation = Boolean(
    pendingChoice &&
      investigationBank &&
      !resolvedInvestigationIds.has(pendingChoice.block.choiceId)
  );

  const inDialogue = !atToolBreak && !atChoiceBreak && lineIndex < combinedLines.length;
  // Lines revealed so far in this scene's transcript: up to and including
  // the currently displayed line while in dialogue, up to (not including)
  // the blocked line while waiting on the tool/a choice, or all of them
  // once the final action (choices/continue) has been reached.
  const revealedCount =
    atToolBreak || atChoiceBreak ? lineIndex : inDialogue ? lineIndex + 1 : combinedLines.length;

  function handleAskRiskQuestion(question: RiskInvestigationQuestion) {
    if (!gameState || gameState.flags[question.flagOnAsk]) return;
    const next = applyFlags(gameState, { [question.flagOnAsk]: true });
    setGameState(next);
    saveGame(next);
  }

  function handleDismissHudTutorial() {
    if (!gameState || gameState.flags.hud_tutorial_seen) return;
    const next = applyFlags(gameState, { hud_tutorial_seen: true });
    setGameState(next);
    saveGame(next);
  }

  function handleContinueInvestigation(choiceId: string) {
    setResolvedInvestigationIds((current) => new Set(current).add(choiceId));
  }

  function handleSelectChoice(option: ChoiceOption, choiceId: string) {
    if (!gameState) return;
    let next = applyEffects(gameState, option.effects);
    next = applyFlags(next, option.flags);
    next = {
      ...next,
      choiceHistory: [
        ...next.choiceHistory,
        {
          sceneId: gameState.currentScene,
          choiceId,
          optionText: option.text,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const isNoFailReaction = Boolean(option.reaction) && option.nextScene === null;
    if (isNoFailReaction) {
      // Re-present the same choice list; do not advance the scene, and
      // do not mark it resolved yet.
      setGameState(next);
      setReactionText(option.reaction ?? null);
      return;
    }

    if (!isPendingChoiceTerminal) {
      // Interstitial choice: effects/flags are applied, but this scene
      // isn't done — mark it resolved and let dialogue continue past it
      // instead of branching scenes.
      setGameState(next);
      setReactionText(null);
      setResolvedChoiceIds((current) => new Set(current).add(choiceId));
      saveGame(next);
      return;
    }

    goToScene(next, option.nextScene);
  }

  function handleAdvanceLine() {
    if (!gameState || !scene) return;
    const nextIndex = Math.min(lineIndex + 1, combinedLines.length);
    setLineIndex(nextIndex);

    if (
      nextIndex >= toolBreakIndex &&
      scene.toolId &&
      !hasReachedToolScreen(gameState, scene.toolId)
    ) {
      const marked = markToolScreenReached(gameState, scene.toolId);
      setGameState(marked);
      saveGame(marked);
    }
  }

  function handleContinueScene() {
    if (!gameState || !scene) return;
    goToScene(gameState, scene.nextScenes?.[0] ?? null);
  }

  function handleToolCardPlaced(cardId: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const toolId = scene.toolId;
    const next = placeToolCard(gameState, toolId, cardId);
    setGameState(next);
    saveGame(next);
    // No auto-advance here — once every card is correctly placed, the
    // Submit button below becomes enabled and the player has to actually
    // tap it (see handleSubmitTool) before the scene moves on.
  }

  // "Undo all" for whichever tool screen is currently showing — generic
  // across every tool type since resetTool itself dispatches on
  // toolScreen.type. Deliberately never auto-advances the scene the way
  // the placement handlers above do; resetting should always leave the
  // player right where they were, free to redo the activity.
  function handleResetTool() {
    if (!gameState || !toolScreen) return;
    const next = resetTool(gameState, toolScreen);
    setGameState(next);
    saveGame(next);
  }

  // The explicit "I'm done" action for whichever tool screen is currently
  // showing — generic across every tool type, mirroring handleResetTool.
  // Marks toolSubmitted (which is what actually gates atToolBreak/render),
  // then — same as every placement handler used to do the instant it saw
  // completion — jumps straight to the next scene if there's no post-tool
  // dialogue to reveal first. When post-tool lines ARE present, this
  // deliberately doesn't call goToScene: the next render sees
  // toolSubmitted flip true, atToolBreak clears, and the transcript
  // resumes revealing postLines from where lineIndex already sits (the
  // tool-break boundary) — the eventual Continue/choice action carries
  // the scene transition instead.
  function handleSubmitTool() {
    if (!gameState || !scene || !toolScreen || !toolComplete) return;
    let next = submitTool(gameState, toolScreen);
    // Finishing the Benefits Tracker is what actually completes the PID's
    // Benefits Plan in-fiction, so the drawer copy upgrades here too.
    if (toolScreen.toolId === "TOOL_ACT3_SCENE06_BENEFITS") {
      next = setArtefactStatus(next, "pid", "complete");
    }
    setGameState(next);
    saveGame(next);

    if (postLines.length === 0) {
      goToScene(next, toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null);
    }
  }

  function handlePriorityCardPlaced(cardId: string, bucket: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const next = placePriorityCard(gameState, toolScreen, cardId, bucket);
    setGameState(next);
    saveGame(next);
  }

  function handleDescopeTask(taskId: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const next = descopeTask(gameState, toolScreen, taskId);
    setGameState(next);
    saveGame(next);
  }

  function handleToggleHire(candidateId: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const next = toggleHire(gameState, toolScreen, candidateId);
    setGameState(next);
    saveGame(next);
  }

  function handleGanttPlace(milestoneId: string, startWeek: number): string | null {
    if (!gameState || !scene?.toolId || !toolScreen) return null;
    const placements = gameState.toolPlacements[scene.toolId] ?? {};
    const error = validateMilestonePlacement(toolScreen, placements, milestoneId, startWeek);
    if (error) return error;

    const next = placeMilestone(gameState, toolScreen, milestoneId, startWeek);
    setGameState(next);
    saveGame(next);

    // Deliberately no auto-advance here (unlike every other tool's
    // placement handler): placing the last milestone should hand the
    // player straight into the critical-path phase within this same
    // GanttBoard, not jump to the next scene. See handleConfirmCriticalPath
    // for where the actual transition happens.
    return null;
  }

  function handleToggleCriticalPathGuess(milestoneId: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const next = toggleCriticalPathGuess(gameState, toolScreen, milestoneId);
    setGameState(next);
    saveGame(next);
  }

  function handleConfirmCriticalPath() {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const toolId = scene.toolId;
    const next = placeToolCard(gameState, toolId, CRITICAL_PATH_CONFIRMED_MARKER);
    setGameState(next);
    saveGame(next);
    // No auto-advance here either — confirming the critical path just
    // flips computeToolComplete true (enabling the Submit button below);
    // the actual scene transition waits for handleSubmitTool.
  }

  function handleBuildBenefitField(benefitId: string, field: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const toolId = scene.toolId;
    const next = placeToolCard(gameState, toolId, benefitFieldId(benefitId, field));
    setGameState(next);
    saveGame(next);
  }

  // {token} placeholders (e.g. "Week {currentWeek}.") are substituted only
  // for display — combinedLines itself stays untouched so choice-anchor
  // matching and marker detection keep comparing against the literal
  // authored text.
  const templateValues = {
    currentWeek: String(computeWeeksRemaining(gameState.projectMetrics.scheduleHealth)),
  };
  const displayLines = combinedLines.map((line) => ({
    ...line,
    text: substituteTemplate(line.text, templateValues),
  }));

  const hudActive = isHudActiveForScene(scene);
  const ganttToolScreen = hudActive ? getToolScreenByType("gantt_placement") : null;
  const isAnnouncement = scene.displayStyle === "announcement";

  const actionContent =
    atToolBreak && toolScreen && toolIsPriority ? (
              <PriorityBoard
                toolScreen={toolScreen}
                placements={gameState.toolPlacements[toolScreen.toolId] ?? {}}
                onPlace={handlePriorityCardPlaced}
                pmConcept={scene.pmConcept}
                onReset={handleResetTool}
                canSubmit={toolComplete}
                onSubmit={handleSubmitTool}
              />
            ) : atToolBreak && toolScreen && toolType === "cost_review_with_descope" ? (
              <CBSReview
                toolScreen={toolScreen}
                cutTaskId={getDescopedTaskId(gameState, toolScreen.toolId)}
                onDescope={handleDescopeTask}
                pmConcept={scene.pmConcept}
                onReset={handleResetTool}
                canSubmit={toolComplete}
                onSubmit={handleSubmitTool}
              />
            ) : atToolBreak && toolScreen && toolType === "pick_n_of_m_swipeable" ? (
              <TeamSelector
                toolScreen={toolScreen}
                hiredIds={gameState.toolSelections[toolScreen.toolId] ?? []}
                onToggleHire={handleToggleHire}
                pmConcept={scene.pmConcept}
                onReset={handleResetTool}
                canSubmit={toolComplete}
                onSubmit={handleSubmitTool}
              />
            ) : atToolBreak && toolScreen && toolType === "gantt_placement" ? (
              <GanttBoard
                toolScreen={toolScreen}
                placements={gameState.toolPlacements[toolScreen.toolId] ?? {}}
                onPlace={handleGanttPlace}
                criticalPathGuesses={gameState.toolSelections[toolScreen.toolId] ?? []}
                onToggleCriticalPathGuess={handleToggleCriticalPathGuess}
                onConfirmCriticalPath={handleConfirmCriticalPath}
                pmConcept={scene.pmConcept}
                onReset={handleResetTool}
                canSubmit={toolComplete}
                onSubmit={handleSubmitTool}
              />
            ) : atToolBreak && toolScreen && toolType === "proof_chain_builder" ? (
              <BenefitsBuilder
                toolScreen={toolScreen}
                builtFieldIds={gameState.toolProgress[toolScreen.toolId] ?? []}
                onBuildField={handleBuildBenefitField}
                pmConcept={scene.pmConcept}
                onReset={handleResetTool}
                canSubmit={toolComplete}
                onSubmit={handleSubmitTool}
              />
            ) : atToolBreak && toolScreen && toolScreen.visualStyle === "warehouse_blueprint" ? (
              <WBSBlueprint
                toolScreen={toolScreen}
                placedCardIds={gameState.toolProgress[toolScreen.toolId] ?? []}
                onCorrectPlacement={handleToolCardPlaced}
                pmConcept={scene.pmConcept}
                onReset={handleResetTool}
                canSubmit={toolComplete}
                onSubmit={handleSubmitTool}
              />
            ) : atToolBreak && toolScreen ? (
              <ToolScreen
                toolScreen={toolScreen}
                placedCardIds={gameState.toolProgress[toolScreen.toolId] ?? []}
                onCorrectPlacement={handleToolCardPlaced}
                pmConcept={scene.pmConcept}
                onReset={handleResetTool}
                canSubmit={toolComplete}
                onSubmit={handleSubmitTool}
              />
            ) : atInvestigation && investigationBank && pendingChoice ? (
              <RiskInvestigationPanel
                bank={investigationBank}
                flags={gameState.flags}
                onAsk={handleAskRiskQuestion}
                onContinue={() => handleContinueInvestigation(pendingChoice.block.choiceId)}
              />
            ) : pendingChoice ? (
              <ChoiceButtons
                options={pendingChoice.block.options}
                reactionText={reactionText}
                onSelect={(option) => handleSelectChoice(option, pendingChoice.block.choiceId)}
              />
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={handleContinueScene}
                  className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Continue ▸
                </button>
              </div>
            );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
      <header className="relative z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-4 py-2">
        {isAnnouncement ? (
          <div />
        ) : (
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-500">
              {scene.act}
            </div>
            <div className="text-sm font-semibold text-zinc-100">{scene.title}</div>
          </div>
        )}
        <button
          onClick={handleRestart}
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        >
          Title
        </button>
      </header>

      {hudActive && (
        <HUD
          gameState={gameState}
          ganttToolScreen={ganttToolScreen}
          onDismissTutorial={handleDismissHudTutorial}
        />
      )}

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {/* min-h-full + justify-end keeps short scenes anchored to the
           bottom (the usual look — dialogue/tool sitting just above the
           header, not stranded at the top of an empty page). Once actual
           content is taller than the viewport (a long tool board, a long
           dialogue backlog), min-height just becomes a floor: the wrapper
           grows past 100% instead of clipping, justify-end has nothing
           left to push against, and this <main>'s own overflow-y-auto is
           what actually scrolls — previously that overflow lived on the
           parent, which also had overflow-hidden, so anything past the
           bottom of the viewport (e.g. a tall MoSCoW board's Submit
           button) was silently cut off with no way to reach it. */}
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end">
          {isAnnouncement ? (
            <AnnouncementCard lines={displayLines} actionContent={actionContent} />
          ) : (
            <DialogueTranscript
              sceneAct={scene.act}
              sceneTitle={scene.title}
              lines={displayLines}
              revealedCount={revealedCount}
              relationships={gameState.relationships}
              inDialogue={inDialogue}
              onAdvance={handleAdvanceLine}
              actionContent={actionContent}
            />
          )}
        </div>
      </main>

      <DebugDrawer gameState={gameState} onRestart={handleRestart} />
      <ArtefactsDrawer gameState={gameState} />
    </div>
  );
}
