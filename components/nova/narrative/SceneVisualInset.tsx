"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { SceneVisual } from "@/lib/nova/narrative/types";

interface SceneVisualInsetProps {
  visual: SceneVisual;
}

/**
 * A screenshot/document a character is showing the player — a SharePoint
 * page, a tracker, a dashboard, a template — presented as a sharp, legible
 * card floating center-stage, deliberately unblurred and undimmed unlike
 * the backdrop, since the whole point is that the player can read it.
 * NarrativeScene mounts/unmounts this per-line (keyed by src), so it fades
 * in when a line sets a `visual` and disappears the moment a line doesn't.
 */
export default function SceneVisualInset({ visual }: SceneVisualInsetProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), 20);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[23%] z-[15] flex justify-center px-4 sm:px-0">
      <div
        className={`flex w-full flex-col items-center gap-2 ${
          visual.large ? "max-w-[620px] sm:max-w-[760px]" : "max-w-[420px] sm:max-w-[480px]"
        }`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(14px) scale(0.97)",
          transitionProperty: "opacity, transform",
          transitionDuration: "420ms",
          transitionTimingFunction: "ease-out",
        }}
      >
        <div
          className="w-full overflow-hidden rounded-xl border border-zinc-300/60 bg-white shadow-[0_20px_45px_rgba(0,0,0,0.55)]"
          style={{ aspectRatio: visual.aspectRatio }}
        >
          <div className="relative h-full w-full">
            <Image src={visual.src} alt={visual.alt ?? ""} fill sizes="480px" className="object-contain" />
          </div>
        </div>
        {visual.label && (
          <span className="rounded-full bg-zinc-900/85 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-300 backdrop-blur-sm">
            {visual.label}
          </span>
        )}
      </div>
    </div>
  );
}
