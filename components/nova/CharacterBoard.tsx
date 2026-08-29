"use client";

import { useState } from "react";
import { getCharacter } from "@/lib/nova/data";

interface CharacterBoardProps {
  characterIds: string[];
  metIds: string[];
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
 * The carousel content inside CharacterPanel.tsx — pure presentation,
 * owns only its own scroll position (idx), nothing about the panel's
 * open/closed state. Reads name/role/publicBio/whatMatters straight off
 * characters.json via getCharacter, so this stays the single source of
 * truth for roster content (see the "Persistent character panel" entry
 * in DESIGN_NOTES.md). metIds is a live prop (gameState.charactersMet),
 * not a fixed snapshot, so the "Already met" badge updates as the
 * player actually progresses through the story.
 */
export default function CharacterBoard({ characterIds, metIds }: CharacterBoardProps) {
  const [idx, setIdx] = useState(0);
  const metSet = new Set(metIds);

  const id = characterIds[idx];
  const character = id ? getCharacter(id) : null;

  function step(dir: number) {
    setIdx((current) => (current + dir + characterIds.length) % characterIds.length);
  }

  if (!character) {
    return <p className="text-sm text-zinc-400">No characters on this roster.</p>;
  }

  const hue = AVATAR_HUES[character.id] ?? DEFAULT_HUE;
  const badge = metSet.has(character.id)
    ? { label: "Already met", bg: "#eaf3de", color: "#3b6d11" }
    : character.id === "ellis"
      ? { label: "Never appears in person", bg: "#efe3c8", color: "#4a3c40" }
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded border border-[#ddcda3] bg-[#f7f0e0] p-4 text-[#241a1e]"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: hue }}
          >
            {initials(character.name)}
          </div>
          <div>
            <div className="text-[15px] font-semibold">{character.name}</div>
            {character.role && <div className="text-[12px]" style={{ color: "#4a3c40" }}>{character.role}</div>}
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
          <p className="mb-3 text-[13px] leading-relaxed">{character.publicBio}</p>
        )}

        {character.whatMatters && (
          <div className="border-l-[3px] bg-[#fdf9f0] px-2.5 py-1.5" style={{ borderColor: hue }}>
            <span className="text-[11px] font-semibold" style={{ color: "#4a3c40" }}>
              What matters:{" "}
            </span>
            <span className="text-[11px] italic" style={{ color: "#4a3c40" }}>
              {character.whatMatters}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">
          {idx + 1} of {characterIds.length}
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
        </div>
      </div>
    </div>
  );
}
