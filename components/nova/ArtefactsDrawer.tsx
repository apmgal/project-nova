"use client";

import { useState } from "react";
import Image from "next/image";
import { FolderOpen, X } from "lucide-react";
import type { GameState } from "@/lib/nova/types";
import { ARTEFACT_REGISTRY } from "@/lib/nova/artefacts";

interface ArtefactsDrawerProps {
  gameState: GameState;
}

/**
 * Persistent "documents you've found" drawer — a bottom-left sibling to
 * DebugDrawer's bottom-right QA panel, but player-facing. Stays hidden
 * entirely until gameState.artefacts has at least one entry (nothing to
 * show before the player has found anything, and an empty drawer icon
 * would just be confusing clutter this early). Opening the toggle shows a
 * list of every found artefact; tapping one opens a full-size viewer of
 * whichever image matches its *current* status (incomplete/complete) —
 * the same artefact id can silently upgrade its image mid-game (see
 * setArtefactStatus in lib/nova/state.ts) without ever becoming a second
 * drawer entry.
 */
export default function ArtefactsDrawer({ gameState }: ArtefactsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const foundIds = Object.keys(gameState.artefacts);
  if (foundIds.length === 0) return null;

  const viewing = viewingId ? ARTEFACT_REGISTRY[viewingId] : null;
  const viewingStatus = viewingId ? gameState.artefacts[viewingId] : null;

  return (
    <>
      <div className="fixed bottom-3 left-3 z-50 flex flex-col items-start gap-2 text-xs">
        {open && (
          <div className="w-72 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/95 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
              <span className="font-semibold text-zinc-300">Documents</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close documents drawer"
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {foundIds.map((id) => {
                const def = ARTEFACT_REGISTRY[id];
                const status = gameState.artefacts[id];
                if (!def) return null;
                return (
                  <li key={id}>
                    <button
                      onClick={() => setViewingId(id)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left hover:bg-zinc-800"
                    >
                      <span className="text-[13px] font-medium text-zinc-100">{def.title}</span>
                      <span className="text-[11px] text-zinc-500">{def.subtitle}</span>
                      <span
                        className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          status === "complete"
                            ? "bg-emerald-900/50 text-emerald-400"
                            : "bg-amber-900/50 text-amber-400"
                        }`}
                      >
                        {status === "complete" ? "Complete" : "Incomplete"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 font-semibold text-zinc-300 shadow hover:bg-zinc-800"
        >
          <FolderOpen size={14} />
          {open ? "Close" : `Documents (${foundIds.length})`}
        </button>
      </div>

      {viewing && viewingStatus && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setViewingId(null)}
        >
          <div
            className="flex max-h-full w-full max-w-2xl flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full flex-1 overflow-hidden rounded-lg">
              <Image
                src={viewing.images[viewingStatus]}
                alt={viewing.title}
                width={1600}
                height={1000}
                className="h-auto w-full rounded-lg"
              />
            </div>
            <p className="max-w-lg text-center text-[12px] leading-relaxed text-zinc-400">
              {viewing.caption[viewingStatus]}
            </p>
            <button
              onClick={() => setViewingId(null)}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-[12px] font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
