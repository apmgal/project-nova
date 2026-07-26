"use client";

import type { GameState } from "@/lib/nova/types";

interface EndOfContentProps {
  gameState: GameState;
  reason: "act2-complete" | "unbuilt-branch";
  targetScene: string;
  onRestart: () => void;
}

/**
 * Shown whenever the story would advance to a scene outside this build's
 * loaded Act 1 + Act 2 scene set — either the natural end of Act 2 (handoff
 * to Act 3, not built yet) or an orphaned/unwritten branch in the source
 * data. The engine treats both the same way: stop cleanly instead of
 * crashing.
 */
export default function EndOfContent({
  gameState,
  reason,
  targetScene,
  onRestart,
}: EndOfContentProps) {
  const isAct2Complete = reason === "act2-complete";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center">
      <div>
        <h2 className="text-2xl font-bold text-zinc-50">
          {isAct2Complete ? "Act 2 Complete" : "End of built content"}
        </h2>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          {isAct2Complete
            ? "The story continues into Act 3, which hasn't been built yet in this slice."
            : `This choice leads to "${targetScene}", a branch that isn't wired up in this build.`}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left text-xs">
        <div className="mb-2 font-semibold text-zinc-300">End-of-Act-2 state</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-400">
          {Object.entries(gameState.projectMetrics).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span>{key}</span>
              <span className="text-zinc-200">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 mb-1 font-semibold text-zinc-300">Relationships</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-400">
          {Object.entries(gameState.relationships).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span>{key}</span>
              <span className="text-zinc-200">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onRestart}
        className="rounded-md border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800"
      >
        Back to Title
      </button>
    </div>
  );
}
