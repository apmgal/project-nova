"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

interface ResetToolButtonProps {
  onReset: () => void;
  label?: string;
}

/**
 * "Undo all" for a single tool screen — a small icon button that sits
 * inline next to the APM concept hint bulb (approved placement), and pops
 * open a confirm-before-wiping panel anchored right under itself.
 *
 * Unlike ConceptHint's button/panel split (needed because that panel is a
 * wide definition block that has to live in a different spot in the page
 * flow than its trigger), this confirm is small enough to anchor directly
 * under its own button, so one self-contained component is enough — no
 * separate host-side slot required.
 *
 * Confirms before wiping since several tools (MoSCoW, Team Selection)
 * already spend real budget and set flags that affect later scenes — an
 * accidental tap shouldn't cost the player real progress.
 */
export function ResetToolButton({ onReset, label = "Reset this activity" }: ResetToolButtonProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setConfirming((current) => !current)}
        aria-label={label}
        aria-expanded={confirming}
        className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
          confirming
            ? "border-red-500 bg-red-950/40 text-red-400 ring-2 ring-red-500/25"
            : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        }`}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {confirming && (
        <div className="absolute right-0 top-8 z-20 w-56 rounded-lg border border-red-800/50 bg-zinc-900 p-3 text-left shadow-xl">
          <p className="text-xs leading-relaxed text-zinc-300">
            Undo everything on this activity and start it over? This can&apos;t be undone.
          </p>
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onReset();
                setConfirming(false);
              }}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-500"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
