"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import { deriveBackgroundKeyFromAssetFilename, resolveBackground } from "@/lib/nova/state";
import { getBackgroundFile } from "@/lib/nova/data";

interface WBSBlueprintProps {
  toolScreen: ToolScreenBlock;
  placedCardIds: string[];
  onCorrectPlacement: (cardId: string) => void;
}

/**
 * "warehouse_blueprint" visualStyle for a sort_into_buckets tool (WBS) —
 * same tap-to-select-then-tap-zone placement logic and completion rules as
 * the plain ToolScreen card grid, just presented as zone outlines over a
 * background image (real art if available, a labeled placeholder rectangle
 * otherwise) instead of buttons in a grid. A zone visually fills in
 * (outline -> solid) once every one of its cards has been correctly
 * placed, foreshadowing the Facility Progress payoff shots.
 */
export default function WBSBlueprint({
  toolScreen,
  placedCardIds,
  onCorrectPlacement,
}: WBSBlueprintProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [shake, setShake] = useState<{ cardId: string; attempt: number } | null>(null);

  const cards = toolScreen.cards ?? [];
  const zones = toolScreen.buckets ?? [];
  const placedSet = new Set(placedCardIds);
  const poolCards = cards.filter((card) => !placedSet.has(card.id));

  const backgroundKey = toolScreen.backgroundAsset
    ? deriveBackgroundKeyFromAssetFilename(toolScreen.backgroundAsset)
    : null;
  const background = resolveBackground(backgroundKey, getBackgroundFile(backgroundKey));

  function handleSelectCard(cardId: string) {
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  }

  function handleDropOnZone(zone: string) {
    if (!selectedCardId) return;
    const card = cards.find((c) => c.id === selectedCardId);
    if (!card) return;

    if (card.correctBucket === zone) {
      onCorrectPlacement(card.id);
      setSelectedCardId(null);
      setShake(null);
      return;
    }

    setShake((prev) => ({
      cardId: card.id,
      attempt: prev?.cardId === card.id ? prev.attempt + 1 : 1,
    }));
    setSelectedCardId(null);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {toolScreen.instructions && (
        <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
      )}

      <div
        className="relative overflow-hidden rounded-md border border-zinc-700"
        style={
          background?.src
            ? { backgroundImage: `url(${background.src})`, backgroundSize: "cover" }
            : undefined
        }
      >
        {!background?.src && (
          <div className="flex h-24 items-center justify-center bg-zinc-800/60 text-[11px] uppercase tracking-wide text-zinc-500">
            Warehouse — Week 1 (placeholder art)
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 bg-zinc-950/50 p-2 sm:grid-cols-3">
          {zones.map((zone) => {
            const zoneCards = cards.filter((card) => card.correctBucket === zone);
            const zoneCardsPlaced = zoneCards.filter((card) => placedSet.has(card.id));
            const isFilled = zoneCards.length > 0 && zoneCardsPlaced.length === zoneCards.length;
            return (
              <button
                key={zone}
                onClick={() => handleDropOnZone(zone)}
                className={`flex min-h-[92px] flex-col gap-1 rounded-md border-2 p-2 text-left text-xs transition-colors ${
                  isFilled
                    ? "border-emerald-500 bg-emerald-950/60"
                    : selectedCardId
                      ? "border-dashed border-emerald-600 bg-emerald-950/20 hover:bg-emerald-900/30"
                      : "border-dashed border-zinc-600 bg-zinc-950/30"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
                  {zone}
                </span>
                {zoneCardsPlaced.map((card) => (
                  <span
                    key={card.id}
                    className="rounded bg-emerald-800/60 px-2 py-1 text-[11px] text-emerald-100"
                  >
                    {card.text}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
          Unsorted ({poolCards.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {poolCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            const isShaking = shake?.cardId === card.id;
            return (
              <button
                key={`${card.id}-${isShaking ? shake?.attempt : 0}`}
                onClick={() => handleSelectCard(card.id)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-700/70 text-white ring-2 ring-emerald-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500"
                } ${isShaking ? "animate-nova-bounce-back" : ""}`}
              >
                {card.text}
              </button>
            );
          })}
          {poolCards.length === 0 && (
            <div className="text-xs text-emerald-400">All tasks placed.</div>
          )}
        </div>
      </div>
    </div>
  );
}
