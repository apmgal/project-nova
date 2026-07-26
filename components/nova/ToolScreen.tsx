"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";

interface ToolScreenProps {
  toolScreen: ToolScreenBlock;
  placedCardIds: string[];
  onCorrectPlacement: (cardId: string) => void;
}

/**
 * Generic "sort cards into buckets" interaction, driven entirely by a
 * tool_screens.json entry. Nothing here knows about PESTLE or SWOT —
 * bucket names and card text are just data, so the same component will
 * serve later acts' boards (MoSCoW, stakeholder grid, WBS, ...).
 */
export default function ToolScreen({
  toolScreen,
  placedCardIds,
  onCorrectPlacement,
}: ToolScreenProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [shake, setShake] = useState<{ cardId: string; attempt: number } | null>(null);

  const placedSet = new Set(placedCardIds);
  const poolCards = toolScreen.cards.filter((card) => !placedSet.has(card.id));

  function handleSelectCard(cardId: string) {
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  }

  function handleDropOnBucket(bucket: string) {
    if (!selectedCardId) return;
    const card = toolScreen.cards.find((c) => c.id === selectedCardId);
    if (!card) return;

    if (card.correctBucket === bucket) {
      onCorrectPlacement(card.id);
      setSelectedCardId(null);
      setShake(null);
      return;
    }

    // Wrong bucket: no penalty, card just bounces back to the pool and can
    // be retried immediately.
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {toolScreen.buckets.map((bucket) => {
          const cardsHere = toolScreen.cards.filter(
            (card) => placedSet.has(card.id) && card.correctBucket === bucket
          );
          return (
            <button
              key={bucket}
              onClick={() => handleDropOnBucket(bucket)}
              className={`flex min-h-[92px] flex-col gap-1 rounded-md border-2 border-dashed p-2 text-left text-xs transition-colors ${
                selectedCardId
                  ? "border-emerald-600 bg-emerald-950/30 hover:bg-emerald-900/40"
                  : "border-zinc-700 bg-zinc-950/40"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                {bucket}
              </span>
              {cardsHere.map((card) => (
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
            <div className="text-xs text-emerald-400">All cards placed.</div>
          )}
        </div>
      </div>
    </div>
  );
}
