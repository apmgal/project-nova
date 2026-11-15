// Temporary developer-only playtesting navigation — lets a developer step
// backward/forward through scene history with full GameState snapshots, to
// replay an earlier choice and observe how it changes downstream state and
// the eventual ending. See DESIGN_NOTES.md's "Dev playtest navigation"
// entry for the full rationale.
//
// Isolated by design:
//   - Never calls saveGame, never persists anywhere — in-memory only,
//     lost on reload. Doesn't interact with the real save system at all.
//   - Touches none of the actual transition functions in GameRoot.tsx
//     (enterScene/goToScene/goToRealScene/advanceEventQueue are all
//     untouched) — this only OBSERVES gameState.currentScene changes via
//     a useEffect and restores past snapshots by calling the same
//     setGameState/setLineIndex setters GameRoot already owns.
//   - Every state-producing function elsewhere in lib/nova/state.ts
//     already returns a new GameState via spread rather than mutating in
//     place, so simply keeping a reference to a past GameState object is
//     already a complete, correct, independent snapshot — no cloning
//     needed, and every field (metrics, flags, relationships,
//     statusReports, toolProgress/toolPlacements/toolSelections,
//     decisions, eventsResolved, ...) is captured automatically.
//
// To remove this feature entirely: delete this file and
// components/nova/DevPlaytestNav.tsx, then revert the handful of call
// sites in GameRoot.tsx that reference them (search for "devHistory" or
// "DevPlaytestNav").

import { useEffect, useRef, useState } from "react";
import type { GameState } from "./types";

/** Tied to NODE_ENV so this can never appear in a production build
 * without deliberate extra action — `next build` sets
 * NODE_ENV=production automatically; `next dev` (how this project is
 * actually played during development, per DESIGN_NOTES.md) sets
 * NODE_ENV=development.
 * The deliberate extra action: set NEXT_PUBLIC_DEV_TOOLS=1 for a build (e.g. a
 * Vercel environment variable) to show the DEV / PLAYTEST bar — act jumps,
 * Previous / Next — in that deployment. Read at build time, so redeploy after
 * changing it. */
export const DEV_MODE = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEV_TOOLS === "1";

export interface DevHistoryEntry {
  sceneId: string;
  /** The exact lineIndex GameRoot's own resolveInitialLineIndex computed
   * at the moment this scene was entered — restoring it is what makes
   * "Previous" land back at the true start of a scene's dialogue rather
   * than wherever the player happened to have scrolled to. */
  lineIndex: number;
  snapshot: GameState;
}

interface DevHistoryState {
  entries: DevHistoryEntry[];
  index: number; // -1 = empty
}

const EMPTY_HISTORY: DevHistoryState = { entries: [], index: -1 };

export interface UseDevPlaytestHistoryParams {
  enabled: boolean;
  gameState: GameState | null;
  lineIndex: number;
  setGameState: (state: GameState) => void;
  setLineIndex: (index: number) => void;
  /** Resets whatever per-scene ephemeral UI state GameRoot itself owns
   * (reactionText, endInfo, resolvedChoiceIds, resolvedInvestigationIds,
   * viewingArtefactId, ...) — the same reset goToRealScene already
   * performs on every normal transition, so a dev-nav restore renders
   * identically to arriving at that scene normally. */
  resetEphemeralUI: () => void;
}

export interface DevPlaytestHistory {
  /** 1-based for display (e.g. "12 / 37"); total is entries.length. 0/0
   * when nothing has been recorded yet. */
  position: { index: number; total: number };
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  reset: () => void;
}

export function useDevPlaytestHistory(params: UseDevPlaytestHistoryParams): DevPlaytestHistory {
  const { enabled, gameState, lineIndex, setGameState, setLineIndex, resetEphemeralUI } = params;
  const [state, setState] = useState<DevHistoryState>(EMPTY_HISTORY);
  // Set immediately before goBack/goForward call setGameState, so the
  // recording effect below can tell "this currentScene change is a
  // dev-nav restore" apart from "this is a genuinely new transition" —
  // consumed (reset to false) the first time the effect observes it.
  const restoringRef = useRef(false);

  useEffect(() => {
    if (!enabled || !gameState) return;
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    setState((prev) => {
      // Discards any stale "future" beyond the current position — the
      // branch-and-discard behaviour: going back, then making a
      // different choice, drives a genuinely new transition through the
      // normal goToRealScene path, which this effect observes exactly
      // like any other transition. Truncating here is what stops the
      // old (now-invalid) forward history from accumulating alongside
      // the new branch.
      const truncated = prev.entries.slice(0, prev.index + 1);
      const entries = [...truncated, { sceneId: gameState.currentScene, lineIndex, snapshot: gameState }];
      return { entries, index: entries.length - 1 };
    });
    // Deliberately narrow deps: only a real currentScene change should
    // record a new entry, not every intra-scene setGameState (tool
    // placements, interstitial choice effects, artefact reveals) — that
    // narrowness is exactly what lets "Previous" discard everything
    // since scene entry without needing to hook every individual state
    // update in GameRoot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameState?.currentScene]);

  function restore(targetIndex: number) {
    const entry = state.entries[targetIndex];
    if (!entry) return;
    restoringRef.current = true;
    setGameState(entry.snapshot);
    setLineIndex(entry.lineIndex);
    resetEphemeralUI();
    setState((prev) => ({ ...prev, index: targetIndex }));
  }

  const canGoBack = state.index > 0;
  const canGoForward = state.index >= 0 && state.index < state.entries.length - 1;

  return {
    position: { index: state.index + 1, total: state.entries.length },
    canGoBack,
    canGoForward,
    goBack: () => canGoBack && restore(state.index - 1),
    goForward: () => canGoForward && restore(state.index + 1),
    reset: () => setState(EMPTY_HISTORY),
  };
}
