"use client";

import { Play } from "lucide-react";

interface PauseOverlayProps {
  open: boolean;
  onResume: () => void;
}

/**
 * Full-screen translucent scrim shown while the game is paused. Deliberately
 * minimal for now (see PauseButton's own doc comment) — just enough to
 * confirm to the player that it's safe to step away and let them get back
 * in. Ambient/music audio is paused independently by GameRoot passing
 * `paused` down to its SceneAudio instances; this component only owns the
 * visual freeze + Resume affordance, not the audio itself.
 */
export default function PauseOverlay({ open, onResume }: PauseOverlayProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-zinc-950/80 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Paused</p>
      <button
        onClick={onResume}
        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
      >
        <Play size={16} className="fill-current" />
        Resume
      </button>
    </div>
  );
}
