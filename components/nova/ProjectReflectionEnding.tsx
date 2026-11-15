"use client";

import type { GameState } from "@/lib/nova/types";
import DecisionAnalysis from "./analysis/DecisionAnalysis";

interface ProjectReflectionEndingProps {
  gameState: GameState;
  onRestart: () => void;
}

/**
 * The real, intentional end of the game — shown automatically once the player finishes ACT6_SCENE03 (the
 * final ending scene, whose own `nextScenes` is deliberately empty), rather than falling into the generic
 * "End of built content" screen every genuinely-unbuilt branch also uses (see GameRoot.tsx's
 * `story-complete` EndInfo reason). Also the destination of the prototype's failed-inspection epilogue.
 *
 * Renders the Decision Analysis (components/nova/analysis/DecisionAnalysis.tsx): the project outcome, the
 * existing Project Reflection category ratings (computeProjectReflectionScorecard, unchanged), the decision
 * journey, the APM module mapping and the takeaways — all read from the saved game. The Project Artefacts
 * panel's Phase 5 Closure entry keeps the compact ReflectionScorecardView of the same scorecard.
 */
export default function ProjectReflectionEnding({ gameState, onRestart }: ProjectReflectionEndingProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0f16]">
      <DecisionAnalysis gameState={gameState} onRestart={onRestart} />
    </div>
  );
}
