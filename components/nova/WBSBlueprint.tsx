"use client";

import { useState } from "react";
import type { ToolScreenBlock } from "@/lib/nova/types";
import { WBS_ZONE_STYLE, FALLBACK_WBS_ZONE_STYLE } from "./wbsZoneStyle";
import { useConceptHint, ConceptHintButton, ConceptHintPanel } from "./ConceptHint";
import { ResetToolButton } from "./ResetTool";
import { SubmitToolButton } from "./SubmitTool";
import { usePlacementDrag } from "./usePlacementDrag";
import { DragGhost } from "./DragGhost";

interface WBSBlueprintProps {
  toolScreen: ToolScreenBlock;
  placedCardIds: string[];
  onCorrectPlacement: (cardId: string) => void;
  pmConcept?: string;
  onReset: () => void;
  canSubmit: boolean;
  onSubmit: () => void;
}

/**
 * "warehouse_blueprint" visualStyle for a sort_into_buckets tool (WBS) —
 * same tap-to-select-then-tap-zone placement logic and completion rules as
 * the plain ToolScreen card grid, presented as a tree: the Warehouse
 * project node at the top, the 6 WBS zones as color-coded branches below
 * it, and a pool of unsorted work packages underneath. A zone fills in
 * (dashed outline -> solid color) once every one of its tasks is
 * correctly placed, and placed tasks appear as small leaves hanging off
 * that zone, foreshadowing the Facility Progress payoff shots.
 */
export default function WBSBlueprint({
  toolScreen,
  placedCardIds,
  onCorrectPlacement,
  pmConcept,
  onReset,
  canSubmit,
  onSubmit,
}: WBSBlueprintProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [shakeZone, setShakeZone] = useState<{ zone: string; attempt: number } | null>(null);
  const hint = useConceptHint(pmConcept);

  // selectedCardId/shakeZone are local UI-only state — clear them
  // alongside the underlying progress so no stale selection/shake
  // animation survives a reset.
  function handleReset() {
    setSelectedCardId(null);
    setShakeZone(null);
    onReset();
  }

  const cards = toolScreen.cards ?? [];
  const zones = toolScreen.buckets ?? [];
  const placedSet = new Set(placedCardIds);
  const poolCards = cards.filter((card) => !placedSet.has(card.id));

  function handleSelectCard(cardId: string) {
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  }

  // cardIdOverride lets a drag-and-drop completion target a specific card
  // directly, independent of whatever (if anything) is currently
  // tap-selected — both interaction modes share this one function so a
  // wrong-zone drop bounces back exactly like a wrong-zone tap does.
  function handleZoneTap(zone: string, cardIdOverride?: string) {
    const cardId = cardIdOverride ?? selectedCardId;
    if (!cardId) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    if (card.correctBucket === zone) {
      onCorrectPlacement(card.id);
      setSelectedCardId(null);
      setShakeZone(null);
      return;
    }

    setShakeZone((prev) => ({
      zone,
      attempt: prev?.zone === zone ? prev.attempt + 1 : 1,
    }));
    setSelectedCardId(null);
  }

  const drag = usePlacementDrag({
    onDrop: (cardId, zone) => handleZoneTap(zone, cardId),
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

      <div className="flex flex-col items-center">
        <div className="w-48 max-w-full rounded-md border border-zinc-600 bg-zinc-800/80 px-4 py-2 text-center">
          <div className="text-sm font-semibold text-zinc-100">Warehouse</div>
          <div className="text-[11px] text-zinc-500">Facility build</div>
        </div>
        <div className="h-4 w-px bg-zinc-700" />
        <div className="h-px w-full max-w-xl bg-zinc-700" />
      </div>

      <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
        {zones.map((zone) => {
          const style = WBS_ZONE_STYLE[zone] ?? FALLBACK_WBS_ZONE_STYLE;
          const zoneCards = cards.filter((card) => card.correctBucket === zone);
          const zoneCardsPlaced = zoneCards.filter((card) => placedSet.has(card.id));
          const isFilled = zoneCards.length > 0 && zoneCardsPlaced.length === zoneCards.length;
          const isShaking = shakeZone?.zone === zone;
          const isDropHover = drag.hoveredTargetId === zone;

          return (
            <div
              key={`${zone}-${isShaking ? shakeZone?.attempt : 0}`}
              className="flex w-[104px] flex-none flex-col items-center gap-1.5"
            >
              <div className="h-4 w-px bg-zinc-700" />
              <button
                ref={drag.dropTargetRef(zone)}
                onClick={() => {
                  if (drag.wasDrag()) return;
                  handleZoneTap(zone);
                }}
                className={`flex min-h-[78px] w-full flex-col items-center gap-1 rounded-md border-2 px-2 py-2 text-center transition-colors ${
                  isFilled
                    ? `${style.ring} ${style.fill}`
                    : selectedCardId || drag.isDragging
                      ? "border-dashed border-emerald-600 bg-emerald-950/20 hover:bg-emerald-900/30"
                      : "border-dashed border-zinc-600 bg-zinc-950/30"
                } ${isShaking ? "animate-nova-bounce-back" : ""} ${
                  isDropHover ? "ring-4 ring-emerald-400" : ""
                }`}
              >
                <style.Icon className={`h-4 w-4 ${style.iconColor}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
                  {zone}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {zoneCardsPlaced.length}/{zoneCards.length}
                </span>
              </button>
              {zoneCardsPlaced.length > 0 && (
                <div className="flex w-full flex-col gap-1">
                  {zoneCardsPlaced.map((card) => (
                    <span
                      key={card.id}
                      className="rounded bg-zinc-800/80 px-1.5 py-1 text-[10px] leading-tight text-zinc-400"
                    >
                      {card.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-wide text-zinc-500">
          <span>Unsorted work packages</span>
          <span>{poolCards.length} remaining</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {poolCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            const isBeingDragged = drag.isDragging && drag.draggingId === card.id;
            return (
              <button
                key={card.id}
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
                }`}
              >
                {card.text}
              </button>
            );
          })}
          {poolCards.length === 0 && (
            <div className="text-xs text-emerald-400">All work packages placed.</div>
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
