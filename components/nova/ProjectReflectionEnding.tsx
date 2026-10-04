"use client";

import type { GameState } from "@/lib/nova/types";
import { getProjectArtefactsByPhase } from "@/lib/nova/projectArtefacts";
import { ReflectionScorecardView } from "./ProjectArtefactSnapshots";

interface ProjectReflectionEndingProps {
  gameState: GameState;
  onRestart: () => void;
}

/**
 * The real, intentional end of the game — shown automatically once the
 * player finishes ACT6_SCENE03 (the final ending scene, whose own
 * `nextScenes` is deliberately empty), rather than falling into the
 * generic "End of built content" screen every genuinely-unbuilt branch
 * also uses (see GameRoot.tsx's `story-complete` EndInfo reason). Per
 * direct instruction: a breakdown of how they scored across the (mapped)
 * APM modules, plus an analysis of their pivotal decisions, as part of
 * their Project Reflection.
 *
 * Deliberately reuses `ReflectionScorecardView` wholesale rather than a
 * second, end-game-specific render of the same data — this screen and
 * the Project Artefacts panel's own Phase 5 Closure entry show exactly
 * the same scorecard, so they can never read as two different verdicts
 * on the same playthrough. Pulling the entry out of
 * `getProjectArtefactsByPhase` (rather than calling the (unexported)
 * scorecard builder directly) means this screen is reading the exact
 * same code path the panel uses, not a parallel one.
 */
export default function ProjectReflectionEnding({
  gameState,
  onRestart,
}: ProjectReflectionEndingProps) {
  const closurePhase = getProjectArtefactsByPhase(gameState).find(
    (group) => group.phase.id === "closure",
  );
  const reflectionEntry = closurePhase?.entries.find((e) => e.kind === "reflection");
  const scorecard = reflectionEntry?.kind === "reflection" ? reflectionEntry.scorecard : null;

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto bg-zinc-950 px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-zinc-50">Project Complete</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Here&apos;s how Project Nova actually went — your scorecard, mapped against the APM
            modules it touched, and the decisions that shaped it.
          </p>
        </div>

        {scorecard ? (
          <ReflectionScorecardView scorecard={scorecard} />
        ) : (
          <p className="text-center text-sm text-zinc-500">
            No reflection data available for this playthrough.
          </p>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={onRestart}
            className="rounded-md border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800"
          >
            Back to Title
          </button>
        </div>
      </div>
    </div>
  );
}
