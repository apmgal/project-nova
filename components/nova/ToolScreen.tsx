"use client";

import { useState } from "react";
import {
  Landmark,
  TrendingUp,
  Users,
  Lightbulb,
  Gavel,
  Recycle,
  Circle,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
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

interface PestleCategoryStyle {
  Icon: LucideIcon;
  barBg: string;
  nameText: string;
  countText: string;
  chipBg: string;
  chipText: string;
}

/**
 * "pestle_category_list" visualStyle — keyed by the exact bucket strings
 * TOOL_ACT1_SCENE03B_PESTLE carries ("Political"/"Economic"/"Social"/
 * "Technological"/"Legal"/"Environmental"). Only PESTLE opts into this via
 * its own visualStyle field; SWOT and any other sort_into_buckets tool
 * keep the plain dashed-bucket grid below untouched.
 */
const PESTLE_CATEGORY_STYLE: Record<string, PestleCategoryStyle> = {
  Political: {
    Icon: Landmark,
    barBg: "bg-blue-900",
    nameText: "text-blue-100",
    countText: "text-blue-300",
    chipBg: "bg-black/25",
    chipText: "text-blue-50",
  },
  Economic: {
    Icon: TrendingUp,
    barBg: "bg-lime-900",
    nameText: "text-lime-100",
    countText: "text-lime-300",
    chipBg: "bg-black/25",
    chipText: "text-lime-50",
  },
  Social: {
    Icon: Users,
    barBg: "bg-amber-950",
    nameText: "text-amber-100",
    countText: "text-amber-300",
    chipBg: "bg-black/25",
    chipText: "text-amber-50",
  },
  Technological: {
    Icon: Lightbulb,
    barBg: "bg-cyan-950",
    nameText: "text-cyan-100",
    countText: "text-cyan-300",
    chipBg: "bg-black/25",
    chipText: "text-cyan-50",
  },
  Legal: {
    Icon: Gavel,
    barBg: "bg-fuchsia-950",
    nameText: "text-fuchsia-100",
    countText: "text-fuchsia-300",
    chipBg: "bg-black/25",
    chipText: "text-fuchsia-50",
  },
  Environmental: {
    Icon: Recycle,
    barBg: "bg-teal-950",
    nameText: "text-teal-100",
    countText: "text-teal-300",
    chipBg: "bg-black/25",
    chipText: "text-teal-50",
  },
};

const FALLBACK_PESTLE_CATEGORY_STYLE: PestleCategoryStyle = {
  Icon: Circle,
  barBg: "bg-zinc-800",
  nameText: "text-zinc-100",
  countText: "text-zinc-400",
  chipBg: "bg-black/25",
  chipText: "text-zinc-100",
};

/**
 * Generic "sort cards into buckets" interaction, driven entirely by a
 * tool_screens.json entry. Nothing here knows about PESTLE or SWOT —
 * bucket names and card text are just data, so the same component will
 * serve later acts' boards (MoSCoW, stakeholder grid, WBS, ...). The one
 * exception is visualStyle: "pestle_category_list" (opted into only by
 * PESTLE's own data), which swaps the plain dashed-bucket grid for a
 * collapsible per-category list with an icon per category — everything
 * else (placement rules, completion, wrong-bucket bounce-back) is
 * identical between the two, only the chrome differs.
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
  // pestle_category_list only: a bucket's row defaults to expanded once it
  // has a card in it, collapsed otherwise — this map only tracks explicit
  // taps on a row's chevron, which override that default in either
  // direction for that one bucket.
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({});
  const hint = useConceptHint(pmConcept);

  // selectedCardId/shake/expandedOverride are local UI-only state — clear
  // them alongside the underlying progress so no stale selection/shake/
  // manually-collapsed-row survives a reset.
  function handleReset() {
    setSelectedCardId(null);
    setShake(null);
    setExpandedOverride({});
    onReset();
  }

  const cards = toolScreen.cards ?? [];
  const buckets = toolScreen.buckets ?? [];
  const placedSet = new Set(placedCardIds);
  const poolCards = cards.filter((card) => !placedSet.has(card.id));
  const isCollapsibleCategoryList = toolScreen.visualStyle === "pestle_category_list";

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

      {isCollapsibleCategoryList ? (
        <div className="flex flex-col gap-1.5">
          {buckets.map((bucket) => {
            const bucketCards = cards.filter((card) => card.correctBucket === bucket);
            const cardsHere = bucketCards.filter((card) => placedSet.has(card.id));
            const style = PESTLE_CATEGORY_STYLE[bucket] ?? FALLBACK_PESTLE_CATEGORY_STYLE;
            const isDropHover = drag.hoveredTargetId === bucket;
            // Defaults to expanded once it has a card in it; an explicit
            // chevron tap overrides that default in either direction for
            // this one bucket.
            const isExpanded = expandedOverride[bucket] ?? cardsHere.length > 0;
            return (
              <div
                key={bucket}
                ref={drag.dropTargetRef(bucket)}
                onClick={() => {
                  if (drag.wasDrag()) return;
                  handleDropOnBucket(bucket);
                }}
                className={`cursor-pointer rounded-lg transition-colors ${style.barBg} ${
                  selectedCardId || drag.isDragging ? "ring-2 ring-white/50" : ""
                } ${isDropHover ? "ring-4 ring-white" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-black/25 ${style.nameText}`}
                    >
                      <style.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className={`truncate text-[12px] font-medium ${style.nameText}`}>
                      {bucket}
                    </span>
                    <span className={`flex-shrink-0 text-[10px] ${style.countText}`}>
                      {cardsHere.length}/{bucketCards.length}
                    </span>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedOverride((prev) => ({ ...prev, [bucket]: !isExpanded }));
                    }}
                    aria-label={isExpanded ? `Collapse ${bucket}` : `Expand ${bucket}`}
                    className={`flex-shrink-0 ${style.countText}`}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {isExpanded && cardsHere.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                    {cardsHere.map((card) => (
                      <span
                        key={card.id}
                        className={`rounded px-2 py-1 text-[11px] ${style.chipBg} ${style.chipText}`}
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
      ) : (
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
      )}

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
