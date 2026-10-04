"use client";

import Image from "next/image";
import type { GameState } from "@/lib/nova/types";
import { ARTEFACT_REGISTRY } from "@/lib/nova/artefacts";

interface ArtefactsDrawerProps {
  gameState: GameState;
  /** Which artefact's full-size viewer is showing, controlled by the
   * parent so callers outside this component (e.g. SharePointBrowserPanel's
   * DocumentDiscoveredCard, and now ProjectArtefactsPanel's own Initiation/
   * Planning entries, via GameRoot) can jump straight to the viewer. */
  viewingId: string | null;
  onViewingChange: (id: string | null) => void;
}

/**
 * Full-size document viewer only — the former "Investigation Board" edge
 * tab + drawer list that used to live here has been retired: PID and the
 * Benefits Register are now entries inside ProjectArtefactsPanel's own
 * phase-grouped gallery (Initiation and Planning respectively), per direct
 * instruction to merge found-documents and the player's own tool outputs
 * into one panel. This component now does exactly one job — render the
 * full-size incomplete/complete image + caption for whichever artefact id
 * `viewingId` names, however that id was set (ProjectArtefactsPanel,
 * DocumentDiscoveredCard, etc.) — so every existing call site that jumps
 * straight to the viewer keeps working unchanged.
 */
export default function ArtefactsDrawer({ gameState, viewingId, onViewingChange }: ArtefactsDrawerProps) {
  const viewing = viewingId ? ARTEFACT_REGISTRY[viewingId] : null;
  const viewingStatus = viewingId ? gameState.artefacts[viewingId] : null;

  if (!viewing || !viewingStatus) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
      onClick={() => onViewingChange(null)}
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
          onClick={() => onViewingChange(null)}
          className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-[12px] font-semibold text-zinc-300 hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}
