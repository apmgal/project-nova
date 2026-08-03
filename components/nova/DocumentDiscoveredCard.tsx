"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import type { ArtefactStatus } from "@/lib/nova/types";
import { ARTEFACT_REGISTRY } from "@/lib/nova/artefacts";

interface DocumentDiscoveredCardProps {
  artefactId: string;
  status: ArtefactStatus;
  onOpen: () => void;
  onReadLater: () => void;
}

/**
 * "NEW DOCUMENT DISCOVERED" reveal — fires in front of the SharePoint
 * browser when the player taps the row that carries a
 * revealsArtefactId (currently only the PID). Open jumps straight into the
 * ArtefactsDrawer viewer for it; Read Later just adds it to the drawer
 * without opening the viewer. Either way the artefact is added — this is a
 * moment of ceremony around a find that's about to happen either way, not
 * a choice about whether it happens.
 */
export default function DocumentDiscoveredCard({
  artefactId,
  status,
  onOpen,
  onReadLater,
}: DocumentDiscoveredCardProps) {
  const def = ARTEFACT_REGISTRY[artefactId];
  if (!def) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-emerald-700/50 bg-zinc-900 p-6 shadow-2xl">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
          <FileText size={13} />
          New document discovered
        </span>
        <div className="relative w-40 overflow-hidden rounded-md border border-zinc-700 shadow-lg">
          <Image
            src={def.images[status]}
            alt={def.title}
            width={400}
            height={520}
            className="h-auto w-full"
          />
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="text-sm font-semibold text-zinc-100">{def.title}</span>
          <span className="text-[12px] text-zinc-500">{def.subtitle}</span>
        </div>
        <p className="text-center text-[11px] text-zinc-500">Added to your Investigation Board.</p>
        <div className="flex w-full gap-2">
          <button
            onClick={onReadLater}
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-[13px] font-semibold text-zinc-300 hover:bg-zinc-700"
          >
            Read Later
          </button>
          <button
            onClick={onOpen}
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-500"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
