"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";
import { ResetToolButton } from "./ResetTool";
import { SubmitToolButton } from "./SubmitTool";
import { usePlacementDrag } from "./usePlacementDrag";
import { DragGhost } from "./DragGhost";

interface ToolScreenProps {
  toolScreen: ToolScreenBlock;
  placedCardIds: string[];
  onCorrectPlacement: (cardId: string) => void;
  pmConcept?: string;
  onReset: () => void;
  canSubmit: boolean;
  onSubmit: () => void;
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
  pmConcept,
  onReset,
  canSubmit,
  onSubmit,
}: ToolScreenProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [shake, setShake] = useState<{ cardId: string; attempt: number } | null>(null);
  const hint = useConceptHint(pmConcept);

  // selectedCardId/shake are local UI-only state — clear them alongside
  // the underlying progress so no stale selection/shake animation
  // survives a reset.
  function handleReset() {
    setSelectedCardId(null);
    setShake(null);
    onReset();
  }

  const cards = toolScreen.cards ?? [];
  const buckets = toolScreen.buckets ?? [];
  const placedSet = new Set(placedCardIds);
  const poolCards = cards.filter((card) => !placedSet.has(card.id));

  function handleSelectCard(cardId: string) {
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  }

  // cardIdOverride lets a drag-and-drop completion target a specific card
  // directly, independent of whatever (if anything) is currently
  // tap-selected — both interaction modes share this one function so a
  // wrong-bucket drop bounces back exactly like a wrong-bucket tap does.
  function handleDropOnBucket(bucket: string, cardIdOverride?: string) {
    const cardId = cardIdOverride ?? selectedCardId;
    if (!cardId) return;
    const card = cards.find((c) => c.id === cardId);
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

  const drag = usePlacementDrag({
    onDrop: (cardId, bucket) => handleDropOnBucket(bucket, cardId),
  });
  const draggedCard = drag.draggingId ? cards.find((c) => c.id === drag.draggingId) : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/90 p-4">
      {(toolScreen.instructions || pmConcept) && (
        <div className="flex items-start justify-between gap-3">
          {toolScreen.instructions && (
            <p className="text-sm text-zinc-300">{toolScreen.instructions}</p>
          )}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ConceptHintButton entry={hint.entry} open={hint.open} onToggle={hint.toggle} />
            <ResetToolButton onReset={handleReset} />
          </div>
        </div>
      )}
      <ConceptHintPanel entry={hint.entry} open={hint.open} onClose={hint.close} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {buckets.map((bucket) => {
          const cardsHere = cards.filter(
            (card) => placedSet.has(card.id) && card.correctBucket === bucket
          );
          const isDropHover = drag.hoveredTargetId === bucket;
          return (
            <button
              key={bucket}
              ref={drag.dropTargetRef(bucket)}
              onClick={() => {
                if (drag.wasDrag()) return;
                handleDropOnBucket(bucket);
              }}
              className={`flex min-h-[92px] flex-col gap-1 rounded-md border-2 border-dashed p-2 text-left text-xs transition-colors ${
                selectedCardId || drag.isDragging
                  ? "border-emerald-600 bg-emerald-950/30 hover:bg-emerald-900/40"
                  : "border-zinc-700 bg-zinc-950/40"
              } ${isDropHover ? "ring-4 ring-emerald-400" : ""}`}
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
            const isBeingDragged = drag.isDragging && drag.draggingId === card.id;
            return (
              <button
                key={`${card.id}-${isShaking ? shake?.attempt : 0}`}
                {...drag.dragHandleProps(card.id)}
                onClick={() => {
                  if (drag.wasDrag()) return;
                  handleSelectCard(card.id);
                }}
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  isBeingDragged ? "opacity-30" : ""
                } ${
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

      <SubmitToolButton canSubmit={canSubmit} onSubmit={onSubmit} />

      {draggedCard && (
        <DragGhost pointer={drag.pointer}>
          <span className="rounded-md border border-white/40 bg-zinc-800/95 px-3 py-2 text-xs font-medium text-white shadow-lg">
            {draggedCard.text}
          </span>
        </DragGhost>
      )}
    </div>
  );
}
