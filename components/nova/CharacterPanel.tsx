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
 *
 * Open/close is always mounted (never `{open && ...}`) so the
 * transition classes below can actually animate on the `open` flip —
 * a conditionally-mounted element has no "before" state to transition
 * from/to, it just pops. The dim backdrop fades in with the overlay's
 * own opacity transition; the drawer additionally slides in on its own
 * transform, and its elevated shadow is what reads as "floating above
 * the scene" rather than pasted flat on top of it.
 *
 * Edge tab: sky-tinted (vs. FieldGuidePanel's violet) so the two
 * stacked tabs read as distinct destinations at a glance, not just two
 * identical grey dots. The `group`/`group-hover` tooltip span is plain
 * CSS, no portal or JS positioning — it's small and always has room to
 * the right since the tab sits on the left edge.
 */
export default function CharacterPanel({ charactersMet }: CharacterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open the team panel"
        className="group absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-sky-700/60 bg-zinc-900/90 text-sky-300 shadow-md transition-colors hover:border-sky-400 hover:text-sky-200"
      >
        <Users size={18} />
        <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          Meet the Team
        </span>
      </button>

      <div
        className={`fixed inset-0 z-50 flex bg-black/65 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      >
        <div
          className={`flex h-full w-80 max-w-[85vw] flex-col overflow-hidden border-r border-zinc-500/60 bg-zinc-950 shadow-[20px_0_60px_-6px_rgba(0,0,0,0.95)] transition-transform duration-300 ease-out sm:w-96 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-200">
              Meet the Team
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close the team panel"
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CharacterBoard
              characterIds={CHARACTER_PANEL_IDS}
              metIds={charactersMet}
            />
          </div>
        </div>
      </div>
    </>
  );
}
