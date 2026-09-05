"use client";

import { useState } from "react";
import { evaluateEnding } from "@/lib/nova/endings";
import type { GameState } from "@/lib/nova/types";
import type { DevPlaytestHistory } from "@/lib/nova/devHistory";

interface DevPlaytestNavProps {
  gameState: GameState;
  history: DevPlaytestHistory;
}

/**
 * Temporary developer-only playtesting control — see lib/nova/devHistory.ts
 * for the full rationale and removal instructions. Deliberately loud,
 * out-of-place styling (solid amber/black, monospace, "DEV / PLAYTEST"
 * label) rather than the app's own zinc design system, so it can never be
 * mistaken for real player UI. Read-only: shows state, doesn't edit it —
 * no state-editing controls here by design.
 */
export default function DevPlaytestNav({ gameState, history }: DevPlaytestNavProps) {
  const [expanded, setExpanded] = useState(false);
  const m = gameState.projectMetrics;
  // Pure function, cheap to call on every render — shown as a live
  // "if the game ended right now" projection from wherever the player
  // currently is, not just once Act 6 is actually reached, since that's
  // the whole point of replaying an earlier choice: seeing how it moves
  // this projection before playing all the way to the real ending.
  const ending = evaluateEnding(gameState);

  return (
    <div className="fixed inset-x-0 top-0 z-[100] select-none font-mono text-[11px] leading-tight text-black shadow-lg">
      <div className="flex flex-wrap items-center gap-2 bg-amber-400 px-2 py-1">
        <span className="rounded bg-black px-1.5 py-0.5 font-bold tracking-wide text-amber-400">
          DEV / PLAYTEST
        </span>
        <button
          type="button"
          onClick={history.goBack}
          disabled={!history.canGoBack}
          className="rounded bg-black/85 px-2 py-0.5 font-semibold text-white disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={history.goForward}
          disabled={!history.canGoForward}
          className="rounded bg-black/85 px-2 py-0.5 font-semibold text-white disabled:opacity-30"
        >
          Next →
        </button>
        <span className="truncate">
          {gameState.currentScene} &middot; {history.position.index}/{history.position.total}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto shrink-0 rounded bg-black/85 px-2 py-0.5 font-semibold text-white"
        >
          {expanded ? "Hide details ▲" : "Show details ▼"}
        </button>
      </div>
      {expanded && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 bg-amber-200 px-2 py-1.5 sm:grid-cols-4">
          <div>Budget: £{(m.budgetRemaining / 1_000_000).toFixed(2)}M</div>
          <div>Schedule: {m.scheduleHealth}</div>
          <div>Risk: {m.riskExposure}</div>
          <div>Reg. Readiness: {m.regulatoryReadiness}</div>
          <div>Benefits: {m.benefitsRealisationScore}</div>
          <div>Board Conf.: {m.boardConfidence}</div>
          <div>Goodwill: {m.stakeholderGoodwill}</div>
          <div>Morale: {m.teamMorale}</div>
          <div className="col-span-2 mt-1 border-t border-black/20 pt-1 sm:col-span-4">
            Projected ending (from current state):{" "}
            <strong>
              {ending.endingFamily}
              {ending.endingVariant ? ` / ${ending.endingVariant}` : ""}
            </strong>{" "}
            — contract {ending.contractGateResult}, batch {ending.batchResult ?? "n/a"}
          </div>
        </div>
      )}
    </div>
  );
}
