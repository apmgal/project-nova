"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import DecisionAnalysisPaged from "@/components/nova/analysis/DecisionAnalysisPaged";
import type { GameState } from "@/lib/nova/types";
import { loadGame, newGameState } from "@/lib/nova/state";

/**
 * LAYOUT PREVIEW — /prototype/decision-analysis. The guided, five-page version of the Decision Analysis,
 * for comparison with the scrolling one (which is what the game and the inspection-film prototype use).
 * Reads the inspection prototype's working copy if there is one, otherwise the real save — read-only.
 */
function readState(): GameState {
  try {
    const raw = window.localStorage.getItem("projectNova.inspectionPrototype.v1");
    if (raw) return JSON.parse(raw) as GameState;
  } catch { /* fall through */ }
  return loadGame() ?? newGameState();
}

function PagedPreview() {
  const [state] = useState(readState);
  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0e16]">
      <DecisionAnalysisPaged gameState={state} onRestart={() => window.location.assign("/prototype/inspection-film")} />
    </div>
  );
}

export default dynamic(() => Promise.resolve(PagedPreview), { ssr: false, loading: () => <div className="fixed inset-0 bg-[#0b0f16]" /> });
