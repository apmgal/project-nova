"use client";

import { useState, useSyncExternalStore } from "react";
import { Pause, Volume2, VolumeX } from "lucide-react";
import WarehouseInterlude from "@/components/prototype/warehouse/WarehouseInterlude";
import { backupSaveBeforeFirstJump, restoreDevJumpBackup } from "@/lib/nova/devActJump";
import {
  getScene,
  getDialogue,
  getChoicesForScene,
  getToolScreen,
  getToolScreenByType,
  getRiskInvestigation,
  isSceneAvailable,
  getBackgroundFile,
  getAmbientSoundFile,
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
  markCharactersMet,
  markFieldGuideSeen,
  isLineVisible,
  splitAroundToolMarker,
  isToolMarkerLine,
  hasReachedToolScreen,
  markToolScreenReached,
  placeToolCard,
  isToolComplete,
  placePriorityCard,
  isPriorityToolComplete,
  isCbsClassificationComplete,
  computeCbsClassifications,
  setCbsClassification,
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
  foldBackground,
  resolveBackground,
  PANORAMA_GROUPS,
  BACKGROUND_KEN_BURNS_OVERRIDES,
  foldAmbient,
  foldFootsteps,
  resolveAmbientSound,
  FOOTSTEPS_SFX_SRC,
  ambientVolumeForBackground,
  footstepsVolumeForBackground,
  computeEventQueue,
  resolveEventQueueEntryScene,
  isActiveQueuedEventScene,
  supplierTemplateValues,
  applyDecisions,
  submitStatusReport,
  effectiveDialogueFlags,
  reportMismatchTemplateValues,
  applyReadinessIntervention,
  isReadinessInterventionSequenceComplete,
  budgetReconciliationTemplateValues,
  benefitsRegisterTemplateValues,
} from "@/lib/nova/state";
import { endingConditionFlags } from "@/lib/nova/endings";
import { DEV_MODE, useDevPlaytestHistory } from "@/lib/nova/devHistory";
import DevPlaytestNav from "./DevPlaytestNav";
import type {
  ChoiceBlock,
  ChoiceOption,
  DialogueLine,
  GameState,
  RiskInvestigationQuestion,
  Scene,
  StatusReportRecord,
  ToolScreenBlock,
  CbsClassification,
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
import StatusReportBuilder from "./StatusReportBuilder";
import RaidUpdateCard from "./RaidUpdateCard";
import ReadinessChecklist from "./ReadinessChecklist";
import AuditTrailBuilder from "./AuditTrailBuilder";
import InspectionEvidenceExhibit from "./InspectionEvidenceExhibit";
import CharacterPanel from "./CharacterPanel";
import FieldGuidePanel from "./FieldGuidePanel";
import ProjectArtefactsPanel from "./ProjectArtefactsPanel";
import HUD from "./HUD";
import RiskInvestigationPanel from "./RiskInvestigationPanel";
import EmailInboxPanel from "./EmailInboxPanel";
import TeamsThreadPanel from "./TeamsThreadPanel";
import SharePointBrowserPanel from "./SharePointBrowserPanel";
import SocialFeedPanel from "./SocialFeedPanel";
import DebugDrawer from "./DebugDrawer";
import ArtefactsDrawer from "./ArtefactsDrawer";
import PauseOverlay from "./PauseOverlay";
import EndOfContent from "./EndOfContent";
import ProjectReflectionEnding from "./ProjectReflectionEnding";
import RecoverySequence from "./act5/RecoverySequence";
import RecoveryMontage from "./act5/RecoveryMontage";
import ReadinessRecommendation from "./act5/ReadinessRecommendation";
import InspectorArrival from "./act5/InspectorArrival";
import { INSPECTOR_ARRIVAL_SEEN_FLAG } from "@/lib/nova/inspectorArrival";
import {
  READINESS_RECOMMENDATION_KEY,
  RECOVERY_MONTAGE_SEEN_FLAG,
  RECOVERY_OUTCOME_KEY,
  RECOVERY_STRATEGY_KEY,
  SPONSOR_UPDATE_KEY,
  evaluateRecovery,
  recoveryConditionFlags,
  recoveryStrategyEffects,
} from "@/lib/nova/act5Recovery";
import NarrativeScene from "./narrative/NarrativeScene";
import SceneBackground from "./narrative/SceneBackground";
import PanoramaBackground from "./narrative/PanoramaBackground";
import SceneAudio from "./narrative/SceneAudio";
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
  return (
    scene.act === "Act 3" &&
    (scene.sceneId === HUD_START_SCENE_ID || scene.sceneId === "ACT3_SCENE07")
  );
}

interface EndInfo {
  /** "story-complete": the player finished ACT6_SCENE03, the genuine,
   * intentional end of the story (its own `nextScenes` is deliberately
   * empty) — shows ProjectReflectionEnding. "unbuilt-branch": every other
   * case of nowhere-to-go (a dialogue choice or scene pointing at
   * something outside this build's currently-loaded scene set) — shows
   * the generic EndOfContent cutoff screen. Both arrive via the exact
   * same "nextSceneId resolved to nothing usable" code path in
   * goToRealScene; this field is what tells them apart downstream. */
  reason: "unbuilt-branch" | "story-complete";
  targetScene: string;
}

/** True once hydrated on the client. localStorage (and thus save data) is
 * only ever readable there — useSyncExternalStore is the React-blessed way
 * to gate on that without setting state from inside an effect. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
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
  flags: GameState["flags"],
): {
  preLines: DialogueLine[];
  postLines: DialogueLine[];
  markerText: string | null;
} {
  const rawLines = (getDialogue(scene.dialogueId)?.lines ?? []).filter((line) =>
    isLineVisible(line.condition, flags),
  );

  if (scene.postToolDialogueId) {
    const postLines = (
      getDialogue(scene.postToolDialogueId)?.lines ?? []
    ).filter((line) => isLineVisible(line.condition, flags));
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
function computeToolComplete(
  state: GameState,
  toolScreen: ToolScreenBlock | null,
): boolean {
  if (!toolScreen) return true;
  const toolId = toolScreen.toolId;
  switch (toolScreen.type) {
    case "priority_assignment":
    case "power_interest_grid":
      return isPriorityToolComplete(
        state,
        toolId,
        toolScreen.cards?.length ?? 0,
      );
    case "cost_review_with_descope":
      return isCbsClassificationComplete(state, toolScreen);
    case "pick_n_of_m_swipeable":
      return isHiringComplete(
        state,
        toolId,
        toolScreen.maxHires ?? toolScreen.candidates?.length ?? 0,
      );
    case "gantt_placement": {
      // Placement uses the same "every key placed" shape as
      // priority_assignment. But that alone isn't "complete" here — the
      // scene's real payoff is the critical-path puzzle that follows, so
      // completion also requires the explicit post-reveal confirmation
      // marker (see CRITICAL_PATH_CONFIRMED_MARKER), not just a correct
      // live guess (which could momentarily be true mid-tap).
      const milestoneCount = toolScreen.milestones?.length ?? 0;
      if (!isPriorityToolComplete(state, toolId, milestoneCount)) return false;
      return (state.toolProgress[toolId] ?? []).includes(
        CRITICAL_PATH_CONFIRMED_MARKER,
      );
    }
    case "proof_chain_builder":
      return isToolComplete(
        state,
        toolId,
        (toolScreen.benefits?.length ?? 0) *
          (toolScreen.fieldsPlayerBuilds?.length ?? 2),
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
    const { preLines, postLines } = computeSceneLines(
      scene,
      dialogueFlagsFor(state),
    );
    return preLines.length + postLines.length;
  }
  if (scene.toolId && hasReachedToolScreen(state, scene.toolId)) {
    const { preLines } = computeSceneLines(scene, dialogueFlagsFor(state));
    return preLines.length;
  }
  return 0;
}

/** effectiveDialogueFlags plus the Act 6 ending system's synthetic overlay
 * (see lib/nova/endings.ts's endingConditionFlags doc comment for why this
 * lives here rather than being folded into effectiveDialogueFlags itself —
 * a state.ts<->endings.ts circular import). Used at every call site that
 * used to call effectiveDialogueFlags directly, so live render and the
 * resume-time fast-forward in resolveInitialLineIndex never disagree with
 * each other about how many lines a scene has. */
function dialogueFlagsFor(state: GameState) {
  return { ...effectiveDialogueFlags(state), ...endingConditionFlags(state), ...recoveryConditionFlags(state) };
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
  const [resolvedChoiceIds, setResolvedChoiceIds] = useState<Set<string>>(
    new Set(),
  );
  // Which choices' risk-investigation interstitial (if they have one) the
  // player has already stepped through this scene — separate from
  // resolvedChoiceIds because the investigation and the choice itself are
  // two distinct steps in front of the same breakIndex. Reset alongside it.
  const [resolvedInvestigationIds, setResolvedInvestigationIds] = useState<
    Set<string>
  >(new Set());
  // Which artefact's full-size viewer ArtefactsDrawer is showing. Lifted up
  // here (rather than local to the drawer) so SharePointBrowserPanel's
  // DocumentDiscoveredCard can jump straight to the viewer when the player
  // picks "Open" on a newly-found artefact, not just when they open the
  // drawer list themselves.
  const [viewingArtefactId, setViewingArtefactId] = useState<string | null>(
    null,
  );
  // Reception Intro Scene: a one-off cinematic prologue that plays before
  // the first real scene on every fresh "New Game" (never on Continue,
  // which always resumes wherever the player left off). Kept as its own
  // flag rather than folding it into gameState/currentScene, since it's
  // presentational scaffolding in front of the save-backed engine, not
  // part of it.
  const [showReceptionIntro, setShowReceptionIntro] = useState(false);
  // Act 5 recovery montage: the hands-off 3D sequence between Mike E.'s call and ACT5_SCENE01.
  // Presentational, like the interludes; nothing is saved while it plays.
  const [recoveryMontage, setRecoveryMontage] = useState(false);
  // Act 5 readiness recommendation: the cinematic decision screen after the montage, before ACT5_SCENE01.
  const [readinessScreen, setReadinessScreen] = useState(false);
  // Warehouse interlude: the 3D Spline warehouse shown between the end of
  // Act 4 and ACT5_SCENE01. Same idea as showReceptionIntro — presentational
  // scaffolding in front of the save-backed engine. Holds the pending
  // transition so Continue can finish it exactly as it would have run.
  const [warehouseInterlude, setWarehouseInterlude] = useState<{
    baseState: GameState;
    nextSceneId: string;
  } | null>(null);
  // Pause: a visual freeze + Resume button, plus pausing (not muting —
  // see SceneAudio's own `paused` prop) whatever ambient/footsteps audio
  // is currently playing. Progress already autosaves on every state
  // change, so this doesn't need to do anything beyond reassure the
  // player it's safe to stop for a moment.
  const [paused, setPaused] = useState(false);
  // Mute: the other independent axis SceneAudio exposes — rides its
  // `volume` prop down to 0 (a ramp, not a hard cut) rather than
  // `paused`'s real .pause(), so muting never freezes playback position.
  // Session-only (not part of GameState/game_state.json): a device/
  // session sound preference, not save data.
  const [muted, setMuted] = useState(false);

  // Temporary DEV_MODE-only playtesting nav — see lib/nova/devHistory.ts
  // for the full rationale. Calling the hook unconditionally (rather than
  // only when DEV_MODE) keeps this a valid hook call per React's rules;
  // the hook itself no-ops internally whenever `enabled` is false.
  const devHistory = useDevPlaytestHistory({
    enabled: DEV_MODE,
    gameState,
    lineIndex,
    setGameState,
    setLineIndex,
    resetEphemeralUI: () => {
      setReactionText(null);
      setEndInfo(null);
      setResolvedChoiceIds(new Set());
      setResolvedInvestigationIds(new Set());
      setViewingArtefactId(null);
    },
  });

  function enterScene(state: GameState, sceneId: string): GameState {
    // Carry the outgoing scene's ending backdrop forward as the new
    // scene's baseline, so a scene whose own first line doesn't set a
    // background just keeps showing wherever the last one left off
    // (foldBackground's whole point — see lib/nova/state.ts). Skipped
    // when sceneId === state.currentScene: that's the one-time bootstrap
    // call from handleReceptionIntroComplete, where "the outgoing scene"
    // and "the scene being entered" are the same scene and there's
    // nothing to fold yet.
    let currentBackground = state.currentBackground;
    // Same carry-forward for the ambient sound bed as the backdrop above —
    // needed because some ambience (the SharePoint browsing loop) starts
    // in one scene and is only meant to cut off on a specific line in a
    // later one (see foldAmbient's own doc comment).
    let currentAmbient = state.currentAmbient;
    // charactersMet folds in on the same guard, but reads the OUTGOING
    // scene (prevScene), not the one being entered — a character counts
    // as "met" once the player has actually left the scene they appeared
    // in, not the instant that scene loads (which used to mark someone
    // "already met" before a single line of their scene had even played —
    // see the "Persistent character panel" entry in DESIGN_NOTES.md).
    // Same bootstrap skip as the carry-forward above: nothing's been left
    // yet on the very first scene.
    let next: GameState = state;
    if (state.currentScene !== sceneId) {
      const prevScene = getScene(state.currentScene);
      const prevLines = prevScene
        ? (getDialogue(prevScene.dialogueId)?.lines ?? [])
        : [];
      currentBackground = foldBackground(
        currentBackground,
        prevLines,
        state.flags,
        prevLines.length - 1,
      );
      currentAmbient = foldAmbient(
        currentAmbient,
        prevLines,
        state.flags,
        prevLines.length - 1,
      );
      next = markCharactersMet(next, prevScene?.charactersInvolved ?? []);
      next = markFieldGuideSeen(next, prevScene?.pmConcept);
    }
    const scene = getScene(sceneId);
    next = {
      ...next,
      currentScene: sceneId,
      currentBackground,
      currentAmbient,
    };
    next = applySceneFlagsSet(next, scene?.flagsSet);
    // ACT1_SCENE05 ("The Missing Appendices") is where the player finds
    // Ellis's unfinished Benefits_Plan_DRAFT_v3 — a pure narrative beat with
    // no investigation-panel structure to hang a revealsArtefactId off of
    // (unlike q_drive_pid in risk_investigation.json), so the reveal is
    // wired here instead, the one place a scene transition is guaranteed to
    // run exactly once on entry.
    if (sceneId === "ACT1_SCENE05") {
      next = setArtefactStatus(next, "benefitsRegister", "incomplete");
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
    devHistory.reset();
  }

  function handleContinue() {
    setRecoveryMontage(false);
    setReadinessScreen(false);
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
    devHistory.reset();
  }

  /** Dev-only act jump (DevPlaytestNav, `next dev` only): keeps all
   * progress and moves to the act's first scene through the normal
   * transition, after backing up the real save once. Any half-finished
   * event wave is cleared so the jump can't land inside a stale queue. */
  function handleDevJumpToScene(sceneId: string) {
    if (!gameState) return;
    backupSaveBeforeFirstJump();
    setWarehouseInterlude(null);
    goToRealScene(
      { ...gameState, eventQueue: null, eventQueueIndex: 0, eventQueueExitScene: null },
      sceneId,
    );
  }

  function handleDevRestoreSave() {
    if (restoreDevJumpBackup()) {
      setWarehouseInterlude(null);
      handleContinue();
    }
  }

  function handleRestart() {
    setRecoveryMontage(false);
    setReadinessScreen(false);
    clearSavedGame();
    setGameState(null);
    setEndInfo(null);
    devHistory.reset();
  }

  /** Transitions to nextSceneId — or shows the end-of-content screen if
   * that scene isn't part of this build. This is the ONLY place that
   * decides whether a transition should instead be intercepted by the
   * Event Library checkpoint system (see isActiveQueuedEventScene /
   * EVENT_WAVE_MEMBERS in lib/nova/state.ts) — every call site (choice
   * selection, tool submission, plain Continue) just says "I'm done, go
   * here next" the same way it always has; whether "here next" actually
   * means the next queued event, or the wave's real exit scene, is
   * resolved entirely inside this function. */
  function goToScene(baseState: GameState, nextSceneId: string | null) {
    // We're leaving a queued event's own scene (never its lead-in beat,
    // if it has one — see isActiveQueuedEventScene) — whatever
    // nextSceneId the caller computed is exactly the event's own mostly-
    // null/placeholder static data, authored for this system, not a real
    // destination. Ignore it and advance the queue instead.
    if (isActiveQueuedEventScene(baseState)) {
      advanceEventQueue(baseState);
      return;
    }

    // The scene we're leaving is a wave's entry point and no queue has
    // been spun up for it yet this visit — evaluate every member's
    // eligibility against live state right now (matching each event's own
    // "at trigger" semantics) and, if anything qualifies, route into the
    // first eligible one instead of nextSceneId. An empty queue (nothing
    // eligible this playthrough) just falls through to nextSceneId below,
    // completely normally.
    const leavingScene = getScene(baseState.currentScene);
    if (leavingScene?.eventWaveId && !baseState.eventQueue) {
      const queue = computeEventQueue(leavingScene.eventWaveId, baseState);
      if (queue.length > 0) {
        const withQueue: GameState = {
          ...baseState,
          eventQueue: queue,
          eventQueueIndex: 0,
          eventQueueExitScene: nextSceneId,
        };
        goToRealScene(withQueue, resolveEventQueueEntryScene(queue[0]));
        return;
      }
    }

    goToRealScene(baseState, nextSceneId);
  }

  /** The current queued event is done — move to the next one, or (once
   * the queue's exhausted) clear it and fall through to wherever the wave
   * scene's own nextScenes originally pointed, exactly as if the wave
   * scene itself had just finished a normal (non-waved) dialogue. */
  function advanceEventQueue(state: GameState) {
    const queue = state.eventQueue ?? [];
    // The entry the player is LEAVING right now (isActiveQueuedEventScene
    // already confirmed state.currentScene === this eventId) — record it
    // as resolved before moving on, regardless of whether the queue has
    // more entries or is about to clear. This is the single choke point
    // every queued event's own scene passes through, so it's the one
    // place that needs to know about eventsResolved at all.
    const justFinished = queue[state.eventQueueIndex];
    const withResolved: GameState = justFinished
      ? {
          ...state,
          eventsResolved: [...new Set([...state.eventsResolved, justFinished])],
        }
      : state;

    const nextIndex = withResolved.eventQueueIndex + 1;
    if (nextIndex < queue.length) {
      const withIndex: GameState = {
        ...withResolved,
        eventQueueIndex: nextIndex,
      };
      goToRealScene(withIndex, resolveEventQueueEntryScene(queue[nextIndex]));
      return;
    }
    const cleared: GameState = {
      ...withResolved,
      eventQueue: null,
      eventQueueIndex: 0,
      eventQueueExitScene: null,
    };
    goToScene(cleared, state.eventQueueExitScene);
  }

  /** The actual state-transition mechanics — every genuinely new
   * destination (a wave's first event, each subsequent queued event, the
   * wave's exit scene once the queue empties, and every ordinary scene
   * transition outside a wave entirely) ends up here exactly once. */
  function goToRealScene(
    baseState: GameState,
    nextSceneId: string | null,
    skipWarehouseInterlude = false,
  ) {
    setRecoveryMontage(false); // presentational; never carried into another scene visit
    setReadinessScreen(false);
    if (!nextSceneId || !isSceneAvailable(nextSceneId)) {
      // Save progress at the last valid (built) scene before showing the
      // end-of-content screen, so a reload resumes here rather than at a
      // scene that doesn't exist in this build.
      saveGame(baseState);
      setGameState(baseState);
      // The one intentional dead end in the whole scene graph — every
      // other nextScenes-empty/unresolvable case really is an unbuilt
      // branch. Checked by which scene we're LEAVING (baseState.currentScene
      // is still ACT6_SCENE03 here; enterScene is never reached on this path).
      setEndInfo({
        reason: baseState.currentScene === "ACT6_SCENE03" ? "story-complete" : "unbuilt-branch",
        targetScene: nextSceneId ?? "(none)",
      });
      return;
    }

    // Insert the warehouse interlude immediately before Act 5, Scene 1.
    // Progress is saved as-is first (still on the outgoing scene), so a
    // reload mid-interlude resumes safely from the last real scene.
    // Not when we're leaving the Recovery Meeting (which sits between the
    // interlude and ACT5_SCENE01) — otherwise the rooms would replay.
    if (
      nextSceneId === "ACT5_SCENE01" &&
      !skipWarehouseInterlude &&
      baseState.currentScene !== "ACT5_SCENE00_RECOVERY"
    ) {
      saveGame(baseState);
      setGameState(baseState);
      setWarehouseInterlude({ baseState, nextSceneId });
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
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-950" />
    );
  }

  if (!gameState) {
    if (showReceptionIntro) {
      return (
        <NarrativeScene
          script={RECEPTION_INTRO_SCENE}
          onComplete={handleReceptionIntroComplete}
          muted={muted}
        />
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

  if (warehouseInterlude) {
    return (
      <WarehouseInterlude
        onContinue={() => {
          const { baseState } = warehouseInterlude;
          setWarehouseInterlude(null);
          // Recovery Meeting first; its nextScenes continues to ACT5_SCENE01.
          // Arriving from the facility visit always starts the meeting fresh: answers saved by an
          // earlier pass (e.g. replayed via a dev jump) would otherwise make RecoverySequence resume
          // past the meeting and the call, straight into the montage. Both are chosen again there.
          const {
            [RECOVERY_STRATEGY_KEY]: _strategy,
            [SPONSOR_UPDATE_KEY]: _sponsor,
            [RECOVERY_OUTCOME_KEY]: _outcome,
            [READINESS_RECOMMENDATION_KEY]: _recommendation,
            ...decisions
          } = baseState.decisions ?? {};
          void _strategy; void _sponsor; void _outcome; void _recommendation;
          const flags = { ...baseState.flags, [RECOVERY_MONTAGE_SEEN_FLAG]: false, [INSPECTOR_ARRIVAL_SEEN_FLAG]: false };
          goToRealScene({ ...baseState, decisions, flags }, "ACT5_SCENE00_RECOVERY", true);
        }}
      />
    );
  }

  if (endInfo) {
    return (
      <>
        {DEV_MODE && (
          <DevPlaytestNav
            gameState={gameState}
            history={devHistory}
            onJumpToScene={handleDevJumpToScene}
            onRestoreSave={handleDevRestoreSave}
          />
        )}
        {endInfo.reason === "story-complete" ? (
          <ProjectReflectionEnding gameState={gameState} onRestart={handleRestart} />
        ) : (
          <EndOfContent
            gameState={gameState}
            reason={endInfo.reason}
            targetScene={endInfo.targetScene}
            onRestart={handleRestart}
          />
        )}
      </>
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

  // Act 5 Recovery Meeting → strategy decision → sponsor call: a scene-specific
  // layout (components/nova/act5/RecoverySequence.tsx) on top of the same state,
  // save and portrait systems. Choices land in GameState.decisions.
  if (scene.sceneId === "ACT5_SCENE00_RECOVERY" && readinessScreen) {
    return (
      <>
        {DEV_MODE && (
          <DevPlaytestNav
            gameState={gameState}
            history={devHistory}
            onJumpToScene={handleDevJumpToScene}
            onRestoreSave={handleDevRestoreSave}
          />
        )}
        <ReadinessRecommendation
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          // Recorded once, together with the move on to this scene's next scene (ACT5_SCENE01).
          onChoose={(id) => {
            const next = applyDecisions(gameState, { [READINESS_RECOMMENDATION_KEY]: id });
            setReadinessScreen(false);
            goToScene(next, scene.nextScenes?.[0] ?? null);
          }}
        />
      </>
    );
  }

  if (scene.sceneId === "ACT5_SCENE00_RECOVERY" && recoveryMontage) {
    return (
      <>
        {DEV_MODE && (
          <DevPlaytestNav
            gameState={gameState}
            history={devHistory}
            onJumpToScene={handleDevJumpToScene}
            onRestoreSave={handleDevRestoreSave}
          />
        )}
        <RecoveryMontage
          introText="In the days that followed..."
          // Ends on black, then the story continues to this scene's nextScenes (ACT5_SCENE01).
          // Ends on black, then the readiness recommendation. Remembered in the save, so a refresh on
          // the decision screen returns to it rather than replaying the montage.
          onComplete={() => {
            const next = applyFlags(gameState, { [RECOVERY_MONTAGE_SEEN_FLAG]: true });
            saveGame(next);
            setGameState(next);
            setRecoveryMontage(false);
            setReadinessScreen(true);
          }}
        />
      </>
    );
  }

  if (scene.sceneId === "ACT5_SCENE00_RECOVERY") {
    return (
      <>
        {DEV_MODE && (
          <DevPlaytestNav
            gameState={gameState}
            history={devHistory}
            onJumpToScene={handleDevJumpToScene}
            onRestoreSave={handleDevRestoreSave}
          />
        )}
        <RecoverySequence
          key={scene.sceneId}
          gameState={gameState}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onDecision={(key, value) => {
            let next = applyDecisions(gameState, { [key]: value });
            // The recovery strategy's effects apply once — only when it's first chosen in this pass
            // (a resumed meeting never re-asks it) — and the outcome is classified on the metrics
            // straight after, for the Final Readiness Review.
            if (key === RECOVERY_STRATEGY_KEY && !gameState.decisions?.[RECOVERY_STRATEGY_KEY]) {
              next = applyEffects(next, recoveryStrategyEffects(value));
              next = applyDecisions(next, { [RECOVERY_OUTCOME_KEY]: evaluateRecovery(next) });
            }
            saveGame(next);
            setGameState(next);
          }}
          // After the call (or straight away when resuming past it): the recovery montage — or, if it has
          // already played in this pass, straight to the readiness recommendation.
          onComplete={() =>
            gameState.flags?.[RECOVERY_MONTAGE_SEEN_FLAG] ? setReadinessScreen(true) : setRecoveryMontage(true)
          }
        />
      </>
    );
  }

  // Act 5 inspector arrival: a short cinematic right after the readiness recommendation, before
  // ACT5_SCENE01's own dialogue starts. Plays once per pass (a saved flag); a refresh during it replays
  // only the cinematic. Purely presentational — no metrics or decisions change here.
  if (
    scene.sceneId === "ACT5_SCENE01" &&
    gameState.decisions?.[READINESS_RECOMMENDATION_KEY] &&
    !gameState.flags?.[INSPECTOR_ARRIVAL_SEEN_FLAG] &&
    lineIndex === 0
  ) {
    return (
      <>
        {DEV_MODE && (
          <DevPlaytestNav
            gameState={gameState}
            history={devHistory}
            onJumpToScene={handleDevJumpToScene}
            onRestoreSave={handleDevRestoreSave}
          />
        )}
        <InspectorArrival
          key="inspector-arrival"
          muted={muted}
          onComplete={() => {
            const next = applyFlags(gameState, { [INSPECTOR_ARRIVAL_SEEN_FLAG]: true });
            saveGame(next);
            setGameState(next);
          }}
        />
      </>
    );
  }

  // A scene with a toolId plays out in up to three phases: dialogueId's
  // lines, then the tool screen, then (if postToolDialogueId is set, or a
  // "[Player ...]" marker line is auto-detected) more dialogue, then the
  // final action. lineIndex is a single running index over the pre-tool +
  // post-tool lines combined; the tool screen is an interstitial that
  // blocks advancing past the boundary between them until it's complete.
  const { preLines, postLines, markerText } = computeSceneLines(
    scene,
    dialogueFlagsFor(gameState),
  );
  const combinedLines = [...preLines, ...postLines];
  const toolBreakIndex = preLines.length;

  const toolScreen = scene.toolId ? getToolScreen(scene.toolId) : null;
  const toolType = toolScreen?.type;
  const toolIsPriority =
    toolType === "priority_assignment" || toolType === "power_interest_grid";
  // toolComplete: whether the activity's own requirements are met (every
  // card placed, hires locked in, etc.) — used only to enable the Submit
  // button. toolSubmitted: whether the player has actually tapped it.
  // These are deliberately different — completion alone used to
  // auto-advance the scene instantly; now the tool screen stays up (with
  // Submit visibly enabled) until the player chooses to move on.
  const toolComplete = computeToolComplete(gameState, toolScreen);
  const toolSubmitted = Boolean(
    toolScreen && gameState.toolSubmitted[toolScreen.toolId],
  );

  // Blocked at the tool interstitial: pre-tool dialogue is done, but the
  // player hasn't submitted the tool yet.
  const atToolBreak =
    Boolean(scene.toolId) && !toolSubmitted && lineIndex >= toolBreakIndex;

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
    const anchorIndex = combinedLines.findIndex(
      (line) => line.text === block.insertAfterLine,
    );
    if (anchorIndex === -1) continue;
    anchoredChoices.push({ block, breakIndex: anchorIndex + 1 });
  }
  const defaultChoiceBlock = scene.choicesId
    ? sceneChoices.find(
        (block) => block.choiceId === scene.choicesId && !block.insertAfterLine,
      )
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
        (choice) =>
          !resolvedChoiceIds.has(choice.block.choiceId) &&
          lineIndex >= choice.breakIndex,
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
    Boolean(pendingChoice) &&
    pendingChoice?.breakIndex === combinedLines.length;

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
    !resolvedInvestigationIds.has(pendingChoice.block.choiceId),
  );

  // An Event Library lead-in scene can carry a leadInPanelId instead of
  // dialogue (see Scene.leadInPanelId, synthesizeEventFrameScene in
  // data.ts) — the whole scene IS the panel, no dialogue lines, no
  // resolved-tracking needed (unlike atInvestigation's choice-scoped
  // version) since leaving this synthesized scene is one-directional.
  const panelLeadInBank = getRiskInvestigation(scene.leadInPanelId);
  const atPanelLeadIn = Boolean(panelLeadInBank);

  const inDialogue =
    !atToolBreak && !atChoiceBreak && lineIndex < combinedLines.length;
  // Lines revealed so far in this scene's transcript: up to and including
  // the currently displayed line while in dialogue, up to (not including)
  // the blocked line while waiting on the tool/a choice, or all of them
  // once the final action (choices/continue) has been reached.
  const revealedCount =
    atToolBreak || atChoiceBreak
      ? lineIndex
      : inDialogue
        ? lineIndex + 1
        : combinedLines.length;

  function handleAskRiskQuestion(question: RiskInvestigationQuestion) {
    if (!gameState || gameState.flags[question.flagOnAsk]) return;
    let next = applyFlags(gameState, { [question.flagOnAsk]: true });
    if (question.revealsArtefactId) {
      next = setArtefactStatus(
        next,
        question.revealsArtefactId,
        question.revealsArtefactStatus ?? "incomplete",
      );
    }
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
    next = applyDecisions(next, option.decisions);
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

    const isNoFailReaction =
      Boolean(option.reaction) && option.nextScene === null;
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
    // The PID covers purpose/scope/stakeholders only (see lib/nova/
    // artefacts.ts). Its Objectives+Scope claims are actually finished by
    // four Act 3 activities in sequence — WBS (scope) -> CBS (cost) ->
    // Team (delivery resources) -> Milestones (schedule) — and since
    // scenes run strictly linearly, Milestones completing is proof the
    // other three already are too. No multi-condition check needed: this
    // is just the single point the last required definition input lands.
    if (toolScreen.toolId === "TOOL_ACT3_SCENE04_MILESTONES") {
      next = setArtefactStatus(next, "pid", "complete");
    }
    // Finishing the Benefits Register tool is what completes the Register
    // artefact in-fiction — Ellis's unfinished draft (revealed in
    // ACT1_SCENE05, see enterScene) becomes "Benefits Register — Approved."
    if (toolScreen.toolId === "TOOL_ACT3_SCENE06_BENEFITS") {
      next = setArtefactStatus(next, "benefitsRegister", "complete");
    }
    setGameState(next);
    saveGame(next);

    if (postLines.length === 0) {
      goToScene(
        next,
        toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null,
      );
    }
  }

  // The Monthly Status Report's own explicit submit action. Unlike every
  // other tool, this one gathers its whole submission (overall/dimension
  // RAGs, selected risks, accomplishments, upcoming activities) from
  // StatusReportBuilder's own local component state rather than
  // toolProgress/toolPlacements/toolSelections — there's no single
  // "correct" completion condition to check the way placement tools have,
  // so the builder gates its own Submit button and only calls this once
  // the player has actually filled in an overall status + all four RAG
  // dimensions. submitStatusReport appends the record (with a fresh
  // actualSnapshot) before submitTool flips the generic toolSubmitted
  // flag, mirroring handleSubmitTool's own advance-if-no-postLines logic.
  function handleSubmitStatusReport(
    submission: Omit<StatusReportRecord, "actualSnapshot">,
  ) {
    if (!gameState || !scene || !toolScreen) return;
    let next = submitStatusReport(gameState, submission);
    next = submitTool(next, toolScreen);
    setGameState(next);
    saveGame(next);

    if (postLines.length === 0) {
      goToScene(
        next,
        toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null,
      );
    }
  }

  // The RAID card's own explicit submit action — mirrors
  // handleSubmitStatusReport's pattern (self-contained local state, no
  // generic completion check). Owner/response are written to
  // GameState.decisions (raidKey_owner / raidKey_response); escalate to a
  // boolean flag (raidKey_escalated). Deliberately no numeric metric
  // effects — see the "Act 4 event redistribution" entry in
  // DESIGN_NOTES.md for why this stays inert for v1. goToScene's own
  // isActiveQueuedEventScene check (not toolScreen.onComplete) is what
  // actually routes this correctly back into the MID_WAVE_2 queue, since
  // this tool screen is itself a queued event scene ("EV-06-RAID").
  function handleSubmitRaidUpdate(submission: {
    owner: string;
    response: string;
    escalate: boolean;
  }) {
    if (!gameState || !scene || !toolScreen) return;
    const key = toolScreen.raidKey ?? toolScreen.toolId;
    let next = applyDecisions(gameState, {
      [`${key}_owner`]: submission.owner,
      [`${key}_response`]: submission.response,
    });
    next = applyFlags(next, { [`${key}_escalated`]: submission.escalate });
    next = submitTool(next, toolScreen);
    setGameState(next);
    saveGame(next);

    if (postLines.length === 0) {
      goToScene(
        next,
        toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null,
      );
    }
  }

  function handlePickReadiness(interventionId: string | null) {
    if (!gameState || !scene || !toolScreen) return;
    let next = applyReadinessIntervention(gameState, interventionId);

    // Sequential, not a one-shot pick: only advance once both "two days"
    // slots are resolved (or nothing genuine remains to spend the second
    // one on) — see isReadinessInterventionSequenceComplete's doc comment.
    // Otherwise just persist the update so ReadinessChecklist re-renders
    // with the board reflecting this pick before offering the next slot.
    if (!isReadinessInterventionSequenceComplete(next)) {
      setGameState(next);
      saveGame(next);
      return;
    }

    next = submitTool(next, toolScreen);
    setGameState(next);
    saveGame(next);

    if (postLines.length === 0) {
      goToScene(
        next,
        toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null,
      );
    }
  }

  function handleSubmitAuditTrail() {
    if (!gameState || !scene || !toolScreen) return;
    const next = submitTool(gameState, toolScreen);
    setGameState(next);
    saveGame(next);

    if (postLines.length === 0) {
      goToScene(
        next,
        toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null,
      );
    }
  }

  function handleContinueEvidenceExhibit() {
    if (!gameState || !scene || !toolScreen) return;
    const next = submitTool(gameState, toolScreen);
    setGameState(next);
    saveGame(next);

    if (postLines.length === 0) {
      goToScene(
        next,
        toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null,
      );
    }
  }

  function handlePriorityCardPlaced(cardId: string, bucket: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const next = placePriorityCard(gameState, toolScreen, cardId, bucket);
    setGameState(next);
    saveGame(next);
  }

  function handleClassifyCbsTask(
    taskId: string,
    classification: CbsClassification,
  ) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const next = setCbsClassification(
      gameState,
      toolScreen,
      taskId,
      classification,
    );
    setGameState(next);
    saveGame(next);
  }

  function handleToggleHire(candidateId: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const next = toggleHire(gameState, toolScreen, candidateId);
    setGameState(next);
    saveGame(next);
  }

  function handleGanttPlace(
    milestoneId: string,
    startWeek: number,
  ): string | null {
    if (!gameState || !scene?.toolId || !toolScreen) return null;
    const placements = gameState.toolPlacements[scene.toolId] ?? {};
    const error = validateMilestonePlacement(
      toolScreen,
      placements,
      milestoneId,
      startWeek,
    );
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
    const next = placeToolCard(
      gameState,
      toolId,
      CRITICAL_PATH_CONFIRMED_MARKER,
    );
    setGameState(next);
    saveGame(next);
    // No auto-advance here either — confirming the critical path just
    // flips computeToolComplete true (enabling the Submit button below);
    // the actual scene transition waits for handleSubmitTool.
  }

  function handleBuildBenefitField(benefitId: string, field: string) {
    if (!gameState || !scene?.toolId || !toolScreen) return;
    const toolId = scene.toolId;
    const next = placeToolCard(
      gameState,
      toolId,
      benefitFieldId(benefitId, field),
    );
    setGameState(next);
    saveGame(next);
  }

  // {token} placeholders (e.g. "Week {currentWeek}.") are substituted only
  // for display — combinedLines itself stays untouched so choice-anchor
  // matching and marker detection keep comparing against the literal
  // authored text.
  const templateValues = {
    currentWeek: String(
      computeWeeksRemaining(gameState.projectMetrics.scheduleHealth),
    ),
    ...supplierTemplateValues(gameState),
    ...reportMismatchTemplateValues(gameState),
    ...budgetReconciliationTemplateValues(gameState),
    ...benefitsRegisterTemplateValues(gameState),
  };
  const displayLines = combinedLines.map((line) => ({
    ...line,
    text: substituteTemplate(line.text, templateValues),
  }));

  // Backdrop currently in effect, right up to whatever's actually
  // revealed — folds forward from the scene's carried-in baseline
  // (see enterScene) through displayLines, the same array/indices
  // DialogueTranscript itself uses, so "what's on screen" and "what the
  // backdrop shows" can never disagree about how far the scene's got.
  const backgroundKey = foldBackground(
    gameState.currentBackground,
    displayLines,
    gameState.flags,
    revealedCount - 1,
  );
  const resolvedBackground = resolveBackground(
    backgroundKey,
    getBackgroundFile(backgroundKey),
  );
  // Reception <-> hallway are crops of one panoramic photo (see
  // PANORAMA_GROUPS) — checked ahead of resolvedBackground so that
  // transition renders as a single PanoramaBackground instance sliding
  // sideways (stable key below) rather than SceneBackground's normal
  // remount-and-fade between two separate images.
  const panorama = backgroundKey ? PANORAMA_GROUPS[backgroundKey] : undefined;

  // Ambient sound bed + footstep overlay, folded the same way as the
  // backdrop — including carrying forward across scene boundaries via
  // gameState.currentAmbient (see enterScene above), since some ambience
  // (the SharePoint browsing loop) starts in one scene and is only meant
  // to cut off on a specific line several scenes later.
  const ambientKey = foldAmbient(
    gameState.currentAmbient,
    displayLines,
    gameState.flags,
    revealedCount - 1,
  );
  const ambientSrc = resolveAmbientSound(
    ambientKey,
    getAmbientSoundFile(ambientKey),
  );
  const footstepsOn = foldFootsteps(
    false,
    displayLines,
    gameState.flags,
    revealedCount - 1,
  );
  // Both volumes are keyed off backgroundKey (see ambientVolumeForBackground's
  // doc comment) so they ramp louder-to-quieter across the reception ->
  // hallway -> stairs -> landing beats without needing a per-line volume
  // field — SceneAudio smoothly ramps to a changed volume prop rather than
  // jumping, so this reads as a fade as the player approaches Mike's office.
  const ambientVolume = ambientVolumeForBackground(backgroundKey);
  const footstepsVolume = footstepsVolumeForBackground(backgroundKey);

  const hudActive = isHudActiveForScene(scene);
  const ganttToolScreen = hudActive
    ? getToolScreenByType("gantt_placement")
    : null;
  const isAnnouncement = scene.displayStyle === "announcement";

  const actionContent =
    atPanelLeadIn &&
    panelLeadInBank &&
    panelLeadInBank.visualStyle === "teams_thread" ? (
      <TeamsThreadPanel
        bank={panelLeadInBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={handleContinueScene}
      />
    ) : atPanelLeadIn &&
      panelLeadInBank &&
      panelLeadInBank.visualStyle === "outlook_inbox" ? (
      <EmailInboxPanel
        bank={panelLeadInBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={handleContinueScene}
      />
    ) : atPanelLeadIn &&
      panelLeadInBank &&
      panelLeadInBank.visualStyle === "sharepoint_browser" ? (
      <SharePointBrowserPanel
        bank={panelLeadInBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={handleContinueScene}
        onOpenArtefact={setViewingArtefactId}
      />
    ) : atPanelLeadIn &&
      panelLeadInBank &&
      panelLeadInBank.visualStyle === "social_feed" ? (
      <SocialFeedPanel
        bank={panelLeadInBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={handleContinueScene}
      />
    ) : atToolBreak && toolScreen && toolIsPriority ? (
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
        classifications={computeCbsClassifications(gameState, toolScreen)}
        onClassify={handleClassifyCbsTask}
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
    ) : atToolBreak && toolScreen && toolType === "status_report_builder" ? (
      <StatusReportBuilder
        toolScreen={toolScreen}
        gameState={gameState}
        pmConcept={scene.pmConcept}
        onSubmitReport={handleSubmitStatusReport}
      />
    ) : atToolBreak && toolScreen && toolType === "raid_update_card" ? (
      <RaidUpdateCard
        toolScreen={toolScreen}
        onSubmitUpdate={handleSubmitRaidUpdate}
      />
    ) : atToolBreak && toolScreen && toolType === "readiness_checklist" ? (
      <ReadinessChecklist
        toolScreen={toolScreen}
        gameState={gameState}
        onPick={handlePickReadiness}
      />
    ) : atToolBreak && toolScreen && toolType === "audit_trail_builder" ? (
      <AuditTrailBuilder
        toolScreen={toolScreen}
        gameState={gameState}
        onSubmit={handleSubmitAuditTrail}
      />
    ) : atToolBreak &&
      toolScreen &&
      toolType === "inspection_evidence_exhibit" ? (
      <InspectionEvidenceExhibit
        toolScreen={toolScreen}
        gameState={gameState}
        onContinue={handleContinueEvidenceExhibit}
      />
    ) : atToolBreak &&
      toolScreen &&
      toolScreen.visualStyle === "warehouse_blueprint" ? (
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
    ) : atInvestigation &&
      investigationBank &&
      pendingChoice &&
      investigationBank.visualStyle === "outlook_inbox" ? (
      <EmailInboxPanel
        bank={investigationBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={() =>
          handleContinueInvestigation(pendingChoice.block.choiceId)
        }
      />
    ) : atInvestigation &&
      investigationBank &&
      pendingChoice &&
      investigationBank.visualStyle === "teams_thread" ? (
      <TeamsThreadPanel
        bank={investigationBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={() =>
          handleContinueInvestigation(pendingChoice.block.choiceId)
        }
      />
    ) : atInvestigation &&
      investigationBank &&
      pendingChoice &&
      investigationBank.visualStyle === "sharepoint_browser" ? (
      <SharePointBrowserPanel
        bank={investigationBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={() =>
          handleContinueInvestigation(pendingChoice.block.choiceId)
        }
        onOpenArtefact={setViewingArtefactId}
      />
    ) : atInvestigation && investigationBank && pendingChoice ? (
      <RiskInvestigationPanel
        bank={investigationBank}
        flags={gameState.flags}
        onAsk={handleAskRiskQuestion}
        onContinue={() =>
          handleContinueInvestigation(pendingChoice.block.choiceId)
        }
      />
    ) : pendingChoice ? (
      <ChoiceButtons
        // Same {token} substitution as displayLines above (e.g.
        // EV-R1's "Go back to {alternateSupplier}") — option
        // objects otherwise pass through untouched, so
        // handleSelectChoice still sees the real effects/flags/
        // nextScene regardless of what the button displays.
        options={pendingChoice.block.options.map((option) => ({
          ...option,
          text: substituteTemplate(option.text, templateValues),
        }))}
        reactionText={reactionText}
        onSelect={(option) =>
          handleSelectChoice(option, pendingChoice.block.choiceId)
        }
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
      {/* Backdrop for whatever location the scene's dialogue says we're
          currently in (see backgroundKey/resolvedBackground above) — z-0
          under the header/HUD/main content below, which already render at
          z-10. No src (an unmapped key, or no key set yet at all) just
          means no backdrop, same plain look every scene had before this.
          Panorama takes priority: a stable key ("panorama") keeps the
          SAME PanoramaBackground instance mounted across e.g.
          reception -> hallway, so it receives a new focusPercent and
          slides rather than remounting/fading like SceneBackground does.
          Leaving the group entirely (e.g. into marcus_office, not in
          PANORAMA_GROUPS) falls through to the normal branch below,
          which mounts fresh as usual. */}
      {panorama ? (
        <PanoramaBackground
          key="panorama"
          src={panorama.src}
          focusPercent={panorama.focusPercent}
        />
      ) : (
        resolvedBackground?.src && (
          <SceneBackground
            key={resolvedBackground.src}
            src={resolvedBackground.src}
            kenBurns={
              backgroundKey
                ? BACKGROUND_KEN_BURNS_OVERRIDES[backgroundKey]
                : undefined
            }
          />
        )
      )}
      {/* Ambient sound bed + footstep overlay (see ambientKey/footstepsOn
          above). Both are plain conditional mounts rather than always-
          rendered with a nullable src: SceneAudio's own fade logic runs on
          mount/unmount, so unmounting IS how each layer fades out — the
          reception ambience keeps playing untouched across reception ->
          hallway -> the stairs climb (same src the whole time, never
          remounts), fades out the moment a line cuts it to "none", and the
          footstep loop fades in/out independently on top of whichever
          ambience is currently playing. No key clash with the background
          layer above — SceneAudio renders nothing to the DOM. */}
      {ambientSrc && (
        <SceneAudio
          key="ambient"
          src={ambientSrc}
          volume={muted ? 0 : ambientVolume}
          fadeInMs={1200}
          fadeOutMs={1500}
          paused={paused}
        />
      )}
      {footstepsOn && (
        <SceneAudio
          key="footsteps"
          src={FOOTSTEPS_SFX_SRC}
          volume={muted ? 0 : footstepsVolume}
          fadeInMs={300}
          fadeOutMs={700}
          paused={paused}
        />
      )}
      {/* Floating pause + mute buttons — deliberately separate from the
          header so they stay in the exact same spot regardless of what
          the header is showing (HUD stats, act label, or nothing at all
          on announcement scenes). Live on the left edge, stacked directly
          above CharacterPanel/FieldGuidePanel's own edge tabs as one
          continuous column — pause, mute, team, library, top to bottom —
          rather than floating up near the header/DEV-playtest banner
          where they first landed. Same h-10 w-10 circular-tab style, own
          accent colors, same hover-tooltip pattern as the two tabs below.
          z-20 sits above the background/audio layer and the header,
          below the overlay itself (z-30).

          Position math: CharacterPanel centers on exactly 50% via
          `-translate-y-1/2`, so its top edge sits at `50% - 20px` (half
          its own 40px height). Each button stacks with a consistent 22px
          gap above the one below it (the same gap FieldGuidePanel's tab
          already uses below CharacterPanel) — a 62px center-to-center
          pitch covers one 40px button plus a 22px gap. Mute's top edge:
          `50% - 20 - 22 - 40 = 50% - 82`. Pause's top edge, one more
          pitch up: `50% - 82 - 22 - 40 = 50% - 144`. Mute rides
          SceneAudio's own `volume` prop down to 0 (a ramp, not a hard
          cut) — independent of pause, which does a real .pause()
          instead; see the `muted` state's own comment above for why
          this is session-only, not GameState. */}
      <button
        onClick={() => setPaused(true)}
        aria-label="Pause"
        className="group absolute left-2 top-[calc(50%-144px)] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-amber-700/60 bg-zinc-900/90 text-amber-300 shadow-md transition-colors hover:border-amber-400 hover:text-amber-200"
      >
        <Pause size={18} className="fill-current" />
        <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          Pause
        </span>
      </button>
      <button
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
        className={`group absolute left-2 top-[calc(50%-82px)] z-20 flex h-10 w-10 items-center justify-center rounded-full border bg-zinc-900/90 shadow-md transition-colors ${
          muted
            ? "border-rose-600/70 text-rose-300 hover:border-rose-400 hover:text-rose-200"
            : "border-cyan-700/60 text-cyan-300 hover:border-cyan-400 hover:text-cyan-200"
        }`}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          {muted ? "Unmute sound" : "Mute sound"}
        </span>
      </button>
      <CharacterPanel charactersMet={gameState.charactersMet} />
      <FieldGuidePanel fieldGuideSeen={gameState.fieldGuideSeen} />
      <ProjectArtefactsPanel
        gameState={gameState}
        onOpenDocument={setViewingArtefactId}
      />
      <PauseOverlay open={paused} onResume={() => setPaused(false)} />
      {DEV_MODE && (
        <DevPlaytestNav
            gameState={gameState}
            history={devHistory}
            onJumpToScene={handleDevJumpToScene}
            onRestoreSave={handleDevRestoreSave}
          />
      )}
      <header className="relative z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-4 py-2">
        {isAnnouncement ? (
          <div />
        ) : (
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-500">
              {scene.act}
            </div>
            <div className="text-sm font-semibold text-zinc-100">
              {scene.title}
            </div>
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
            <AnnouncementCard
              lines={displayLines}
              actionContent={actionContent}
            />
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
      <ArtefactsDrawer
        gameState={gameState}
        viewingId={viewingArtefactId}
        onViewingChange={setViewingArtefactId}
      />
    </div>
  );
}
