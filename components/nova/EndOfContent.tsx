"use client";

import type { GameState } from "@/lib/nova/types";

interface EndOfContentProps {
  gameState: GameState;
  reason: "unbuilt-branch";
  targetScene: string;
  onRestart: () => void;
}

/**
 * Shown whenever the story would advance to a scene outside this build's
 * currently-loaded scene set (see BUILT_ACTS/BUILT_SCENE_OVERRIDES in
 * lib/nova/data.ts for exactly what that covers at any given time) —
 * either the edge of the latest staged act/wave, or an orphaned/unwritten
 * branch in the source data. The engine treats both the same way: stop
 * cleanly instead of crashing, rather than trying to guess which built
 * scene the game is currently up to (that boundary moves every time more
 * content is wired in, so hardcoding an act name here has gone stale more
 * than once already).
 */
export default function EndOfContent({
  gameState,
  targetScene,
  onRestart,
}: EndOfContentProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center">
      <div>
        <h2 className="text-2xl font-bold text-zinc-50">End of built content</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          {`This choice leads to "${targetScene}", a branch that isn't wired up in this build.`}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left text-xs">
        <div className="mb-2 font-semibold text-zinc-300">State at cutoff</div>
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
