"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import { getCharacter } from "@/lib/nova/data";

interface CharacterBoardProps {
  toolScreen: ToolScreenBlock;
  onContinue: () => void;
}

const AVATAR_HUES: Record<string, string> = {
  mike_smith: "#7d6428",
  ben: "#c4a038",
  marcus: "#7f3346",
  camille: "#2fa891",
  vaughn: "#e8763a",
  aisha: "#3d7b9c",
  priya: "#9662d1",
  daniel: "#a1832f",
  tomasz: "#954059",
  whitfield: "#a8453f",
  ellis: "#786a6d",
};
const DEFAULT_HUE = "#5c96a3";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * "character_board" (TUTORIAL_CHARACTER_BOARD, pre-Act-1) — a browsable,
 * read-only carousel introducing the people the player will be working
 * with. Deliberately reads name/role/publicBio/whatMatters straight off
 * characters.json (via getCharacter) rather than duplicating that text
 * into tool_screens.json — characters.json is the single source of truth
 * for the roster, per the brainstorm that shaped this feature (see the
 * "Tutorial character board" entry in DESIGN_NOTES.md). Avatars are a
 * flat initials circle, not a portrait — several of these characters
 * (mike_smith, priya, tomasz, whitfield, ellis) have no real art yet,
 * and initials read consistently across all of them.
 */
export default function CharacterBoard({ toolScreen, onContinue }: CharacterBoardProps) {
  const ids = toolScreen.characterBoardIds ?? [];
  const metIds = new Set(toolScreen.characterBoardMetIds ?? []);
  const [idx, setIdx] = useState(0);

  const id = ids[idx];
  const character = id ? getCharacter(id) : null;

  function step(dir: number) {
    setIdx((current) => (current + dir + ids.length) % ids.length);
  }

  if (!character) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
        <p className="text-sm text-zinc-400">No characters configured for this board.</p>
      </div>
    );
  }

  const hue = AVATAR_HUES[character.id] ?? DEFAULT_HUE;
  const badge = metIds.has(character.id)
    ? { label: "Already met", bg: "#eaf3de", color: "#3b6d11" }
    : character.id === "ellis"
      ? { label: "Never appears in person", bg: "#efe3c8", color: "#4a3c40" }
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {toolScreen.instructions && <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>}

      <div
        className="rounded border border-[#ddcda3] bg-[#f7f0e0] p-5 text-[#241a1e]"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
            style={{ background: hue }}
          >
            {initials(character.name)}
          </div>
          <div>
            <div className="text-[17px] font-semibold">{character.name}</div>
            {character.role && <div className="text-[13px]" style={{ color: "#4a3c40" }}>{character.role}</div>}
          </div>
        </div>

        {badge && (
          <div className="mb-2.5">
            <span
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
          </div>
        )}

        {character.publicBio && (
          <p className="mb-3 text-[14px] leading-relaxed">{character.publicBio}</p>
        )}

        {character.whatMatters && (
          <div className="border-l-[3px] bg-[#fdf9f0] px-2.5 py-1.5" style={{ borderColor: hue }}>
            <span className="text-[12px] font-semibold" style={{ color: "#4a3c40" }}>
              What matters:{" "}
            </span>
            <span className="text-[12px] italic" style={{ color: "#4a3c40" }}>
              {character.whatMatters}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">
          Entry {idx + 1} of {ids.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            Next
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
