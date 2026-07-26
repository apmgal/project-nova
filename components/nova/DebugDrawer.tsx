"use client";

import { useState } from "react";
import type { GameState } from "@/lib/nova/types";

interface DebugDrawerProps {
  gameState: GameState;
  onRestart: () => void;
}

/**
 * Small developer/QA panel: shows the live game state (scene, flags,
 * metrics, relationships) so branches and flag-setting choices can be
 * verified directly in the browser, plus a one-click restart for retrying
 * different branches from a clean save.
 */
export default function DebugDrawer({ gameState, onRestart }: DebugDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2 text-xs">
      {open && (
        <div className="max-h-[70vh] w-80 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950/95 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-zinc-300">QA / Debug</span>
            <button
              onClick={onRestart}
              className="rounded border border-red-700 px-2 py-1 text-red-300 hover:bg-red-900/40"
            >
              Restart game
            </button>
          </div>
          <div className="mb-2">
            <div className="font-semibold text-zinc-400">currentScene</div>
            <div className="text-emerald-400">{gameState.currentScene}</div>
          </div>
          <div className="mb-2">
            <div className="font-semibold text-zinc-400">relationships</div>
            <pre className="whitespace-pre-wrap text-zinc-300">
              {JSON.stringify(gameState.relationships, null, 2)}
            </pre>
          </div>
          <div className="mb-2">
            <div className="font-semibold text-zinc-400">projectMetrics</div>
            <pre className="whitespace-pre-wrap text-zinc-300">
              {JSON.stringify(gameState.projectMetrics, null, 2)}
            </pre>
          </div>
          <div>
            <div className="font-semibold text-zinc-400">flags (true only)</div>
            <pre className="whitespace-pre-wrap text-zinc-300">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(gameState.flags).filter(([, v]) => v)
                ),
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 font-semibold text-zinc-300 shadow hover:bg-zinc-800"
      >
        {open ? "Close debug" : "Debug"}
      </button>
    </div>
  );
}
