"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";

interface PriorityBoardProps {
  toolScreen: ToolScreenBlock;
  /** cardId -> bucket, for whichever cards have been placed so far. */
  placements: Record<string, string>;
  onPlace: (cardId: string, bucket: string) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * Generic "assign every card to a bucket, at a real cost" interaction
 * (e.g. MoSCoW prioritisation). Unlike ToolScreen's sort-into-buckets,
 * every bucket is a valid placement here — nothing bounces back — and a
 * card that's already placed can be reselected and moved to a different
 * bucket, refunding its old cost. Driven entirely by a tool_screens.json
 * entry; nothing here knows this is specifically a MoSCoW board.
 */
export default function PriorityBoard({ toolScreen, placements, onPlace }: PriorityBoardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const unplacedCards = toolScreen.cards.filter((card) => !placements[card.id]);

  function handleSelectCard(cardId: string) {
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  }

  function handleAssign(bucket: string) {
    if (!selectedCardId) return;
    onPlace(selectedCardId, bucket);
    setSelectedCardId(null);
  }

  const committed = toolScreen.cards.reduce((sum, card) => {
    const bucket = placements[card.id];
    if (!bucket || !card.costByBucket) return sum;
    return sum + (card.costByBucket[bucket] ?? 0);
  }, 0);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {toolScreen.instructions && (
        <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {toolScreen.buckets.map((bucket) => {
          const cardsHere = toolScreen.cards.filter((card) => placements[card.id] === bucket);
          return (
            <button
              key={bucket}
              onClick={() => handleAssign(bucket)}
              className={`flex min-h-[104px] flex-col gap-1 rounded-md border-2 border-dashed p-2 text-left text-xs transition-colors ${
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
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSelectCard(card.id);
                  }}
                  className={`cursor-pointer rounded px-2 py-1 text-[11px] transition-colors ${
                    selectedCardId === card.id
                      ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                      : "bg-emerald-800/60 text-emerald-100 hover:bg-emerald-700/70"
                  }`}
                >
                  {card.text}
                  {card.costByBucket && (
                    <span className="ml-1 text-emerald-300/80">
                      ({currencyFormatter.format(card.costByBucket[bucket] ?? 0)})
                    </span>
                  )}
                </span>
              ))}
            </button>
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
          <span>Unassigned ({unplacedCards.length})</span>
          <span className="normal-case tracking-normal text-zinc-400">
            Committed so far: {currencyFormatter.format(committed)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {unplacedCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            return (
              <button
                key={card.id}
                onClick={() => handleSelectCard(card.id)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-700/70 text-white ring-2 ring-emerald-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500"
                }`}
              >
                {card.text}
              </button>
            );
          })}
          {unplacedCards.length === 0 && (
            <div className="text-xs text-emerald-400">All cards assigned.</div>
          )}
        </div>
      </div>
    </div>
  );
}
