"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getScene,
  getDialogue,
  getChoiceBlock,
  getToolScreen,
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
  hasReachedToolScreen,
  markToolScreenReached,
  placeToolCard,
  isToolComplete,
} from "@/lib/nova/state";
import type { ChoiceOption, GameState } from "@/lib/nova/types";
import TitleScreen from "./TitleScreen";
import DialogueTranscript from "./DialogueTranscript";
import ChoiceButtons from "./ChoiceButtons";
import ToolScreen from "./ToolScreen";
import DebugDrawer from "./DebugDrawer";
import EndOfContent from "./EndOfContent";

interface EndInfo {
  reason: "act1-complete" | "unbuilt-branch";
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

/** On resume, a tool scene the player already reached (toolProgress has an
 * entry for it, even an empty one) should skip straight back to its action
 * phase instead of replaying dialogue from line one. */
function resolveInitialLineIndex(state: GameState, sceneId: string): number {
  const scene = getScene(sceneId);
  if (scene?.toolId && hasReachedToolScreen(state, scene.toolId)) {
    const dialogue = getDialogue(scene.dialogueId);
    const visible = (dialogue?.lines ?? []).filter((line) =>
      isLineVisible(line.condition, state.flags)
    );
    return visible.length;
  }
  return 0;
}

export default function GameRoot() {
  const isClient = useIsClient();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [reactionText, setReactionText] = useState<string | null>(null);
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);

  function enterScene(state: GameState, sceneId: string): GameState {
    const scene = getScene(sceneId);
    let next: GameState = { ...state, currentScene: sceneId };
    next = applySceneFlagsSet(next, scene?.flagsSet);
    return next;
  }

  function handleNewGame() {
    let state = newGameState();
    state = enterScene(state, state.currentScene);
    saveGame(state);
    setGameState(state);
    setLineIndex(0);
    setReactionText(null);
    setEndInfo(null);
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
        reason: nextSceneId?.startsWith("ACT2") ? "act1-complete" : "unbuilt-branch",
        targetScene: nextSceneId ?? "(none)",
      });
      return;
    }

    const next = enterScene(baseState, nextSceneId);
    saveGame(next);
    setGameState(next);
    setLineIndex(0);
    setReactionText(null);
    setEndInfo(null);
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
      // Re-present the same choice list; do not advance the scene.
      setGameState(next);
      setReactionText(option.reaction ?? null);
      return;
    }

    goToScene(next, option.nextScene);
  }

  if (!isClient) {
    return <div className="flex flex-1 items-center justify-center bg-zinc-950" />;
  }

  if (!gameState) {
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

  const dialogue = getDialogue(scene.dialogueId);
  const visibleLines = (dialogue?.lines ?? []).filter((line) =>
    isLineVisible(line.condition, gameState.flags)
  );
  const inDialogue = lineIndex < visibleLines.length;
  // Lines revealed so far in this scene's transcript: up to and including
  // the currently displayed line while in dialogue, or all of them once
  // the action phase (choices/tool/continue) has been reached.
  const revealedCount = inDialogue ? lineIndex + 1 : visibleLines.length;

  const toolScreen = !inDialogue ? getToolScreen(scene.toolId) : null;
  const choiceBlock = !inDialogue && !toolScreen ? getChoiceBlock(scene.choicesId) : null;

  function handleAdvanceLine() {
    if (!gameState || !scene) return;
    const nextIndex = Math.min(lineIndex + 1, visibleLines.length);
    setLineIndex(nextIndex);

    if (
      nextIndex >= visibleLines.length &&
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

    if (isToolComplete(next, toolId, toolScreen.cards.length)) {
      goToScene(next, toolScreen.onComplete?.nextScene ?? scene.nextScenes?.[0] ?? null);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950">
      <header className="relative z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-4 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-500">
            {scene.act}
          </div>
          <div className="text-sm font-semibold text-zinc-100">{scene.title}</div>
        </div>
        <button
          onClick={handleRestart}
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        >
          Title
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end px-4 py-6">
        <DialogueTranscript
          sceneAct={scene.act}
          sceneTitle={scene.title}
          lines={visibleLines}
          revealedCount={revealedCount}
          relationships={gameState.relationships}
          inDialogue={inDialogue}
          onAdvance={handleAdvanceLine}
          actionContent={
            toolScreen ? (
              <ToolScreen
                toolScreen={toolScreen}
                placedCardIds={gameState.toolProgress[toolScreen.toolId] ?? []}
                onCorrectPlacement={handleToolCardPlaced}
              />
            ) : choiceBlock ? (
              <ChoiceButtons
                options={choiceBlock.options}
                reactionText={reactionText}
                onSelect={(option) => handleSelectChoice(option, choiceBlock.choiceId)}
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
            )
          }
        />
      </main>

      <DebugDrawer gameState={gameState} onRestart={handleRestart} />
    </div>
  );
}
