"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
import CharacterBoard from "./CharacterBoard";

interface CharacterPanelProps {
  charactersMet: string[];
}

/** Ordered roster shown in the panel — the same 11 people that were
 * previously the one-time tutorial's characterBoardIds, now living here
 * as a fixed constant since the panel isn't scene-configured. */
const CHARACTER_PANEL_IDS = [
  "mike_smith",
  "ben",
  "marcus",
  "camille",
  "vaughn",
  "aisha",
  "priya",
  "daniel",
  "tomasz",
  "whitfield",
  "ellis",
];

/**
 * Persistent "who's who" side panel — a left-edge sibling to the pause
 * button's right-edge toggle, and styled like ArtefactsDrawer's
 * Investigation Board (same self-contained open-state pattern, same
 * zinc chrome), but shaped as an actual slide-in side panel rather than
 * a compact dropdown, since that's the point of this one: available
 * from any scene in the game, not gated behind a one-time tutorial (see
 * the "Persistent character panel" entry in DESIGN_NOTES.md, which
 * supersedes the earlier one-time TUTORIAL_CHARACTER_BOARD scene).
 * Mounted unconditionally in GameRoot, same as ArtefactsDrawer/
 * DebugDrawer — always available once a save exists, never gated by
 * scene, act, or HUD visibility.
 */
export default function CharacterPanel({ charactersMet }: CharacterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open the team panel"
        className="absolute left-2 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      >
        <Users size={11} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-80 max-w-[85vw] flex-col overflow-hidden border-r border-zinc-700 bg-zinc-950/98 shadow-xl sm:w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <span className="text-sm font-semibold text-zinc-200">Team</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close the team panel"
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CharacterBoard characterIds={CHARACTER_PANEL_IDS} metIds={charactersMet} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
